import os
import json
import argparse
import logging
from PIL import Image
import numpy as np
import torch
from torch.utils.data import DataLoader
from transformers import AutoProcessor, AutoModelForTokenClassification
from seqeval.metrics import classification_report, accuracy_score
from train_layoutlmv3 import CORDLayoutLMDataset, CORD_LABELS, label2id, id2label

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def evaluate_split(model, processor, device, split_path: str, split_name: str, num_samples: int = None) -> str:
    logger.info(f"--- Evaluating {split_name} split from: {split_path} ---")
    if not os.path.exists(split_path):
        logger.warning(f"Split directory {split_path} not found. Skipping.")
        return f"[{split_name} Split] Directory not found: {split_path}\n"
        
    dataset = CORDLayoutLMDataset(split_path, processor, max_samples=num_samples)
    
    def collate_fn(batch):
        return {
            key: torch.stack([d[key] for d in batch])
            for key in batch[0].keys()
        }
        
    dataloader = DataLoader(dataset, batch_size=2, collate_fn=collate_fn)
    
    all_predictions = []
    all_labels = []
    
    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            bbox = batch["bbox"].to(device)
            pixel_values = batch["pixel_values"].to(device)
            labels = batch["labels"].to(device)
            
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                bbox=bbox,
                pixel_values=pixel_values
            )
            
            logits = outputs.logits
            predictions = torch.argmax(logits, dim=-1).cpu().numpy()
            labels = labels.cpu().numpy()
            
            # Map IDs to IOB tag strings for clean seqeval formatting (preventing trimmed characters)
            for prediction, label in zip(predictions, labels):
                pred_list = []
                label_list = []
                for p, l in zip(prediction, label):
                    if l != -100: # Skip padding / subwords
                        p_tag = CORD_LABELS[p]
                        l_tag = CORD_LABELS[l]
                        pred_list.append(f"B-{p_tag}" if p_tag != "O" else "O")
                        label_list.append(f"B-{l_tag}" if l_tag != "O" else "O")
                all_predictions.append(pred_list)
                all_labels.append(label_list)
                
    report = classification_report(all_labels, all_predictions, zero_division=0)
    acc = accuracy_score(all_labels, all_predictions)
    
    output_text = (
        f"--------------------------------------------------------------------------------\n"
        f"                  SPLIT EVALUATION: {split_name.upper()} (Samples: {len(dataset)})\n"
        f"--------------------------------------------------------------------------------\n"
        f"Overall Sequence Accuracy : {acc:.2%}\n\n"
        f"Classification Report by Category:\n"
        f"{report}\n\n"
    )
    return output_text

def evaluate(model_path: str, data_dir: str, num_samples: int = None, eval_all_splits: bool = False, root_dir: str = r"E:\6th sem\final yr project\CORD"):
    logger.info(f"Loading fine-tuned model and processor from: {model_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model path {model_path} does not exist. Run training first.")
        
    processor = AutoProcessor.from_pretrained(model_path)
    model = AutoModelForTokenClassification.from_pretrained(model_path)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Running evaluation on device: {device}")
    model.to(device)
    model.eval()
    
    report_text = (
        "================================================================================\n"
        "           LAYOUTLMV3 COMPREHENSIVE SPLITS EVALUATION REPORT\n"
        "================================================================================\n\n"
    )
    
    if eval_all_splits:
        splits = [
            ("Train (Training Set)", os.path.join(root_dir, "train")),
            ("Validation (Dev Set)", os.path.join(root_dir, "dev")),
            ("Test (Testing Set)", os.path.join(root_dir, "test")),
        ]
        for split_title, split_path in splits:
            report_text += evaluate_split(model, processor, device, split_path, split_title, num_samples)
    else:
        split_title = "Single Split (" + os.path.basename(data_dir.rstrip("/\\")) + ")"
        report_text += evaluate_split(model, processor, device, data_dir, split_title, num_samples)
        
    report_text += "================================================================================\n"
    print("\n" + report_text)
    
    # Ensure evaluation output directory exists
    eval_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "evaluation")
    os.makedirs(eval_dir, exist_ok=True)
    
    report_file_eval = os.path.join(eval_dir, "layoutlmv3_splits_evaluation_report.txt")
    with open(report_file_eval, 'w', encoding='utf-8') as f:
        f.write(report_text)
        
    report_file_model = os.path.join(model_path, "evaluation_report.txt")
    with open(report_file_model, 'w', encoding='utf-8') as f:
        f.write(report_text)
        
    logger.info(f"Comprehensive evaluation report saved to:\n  1. {report_file_eval}\n  2. {report_file_model}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Fine-tuned LayoutLMv3 Model across dataset splits")
    parser.add_argument("--model_path", type=str, default="./layoutlmv3-finetuned", help="Path to fine-tuned model")
    parser.add_argument("--data_dir", type=str, default=r"E:\6th sem\final yr project\CORD\test", help="Path to CORD split directory")
    parser.add_argument("--num_samples", type=int, default=10, help="Number of samples to evaluate per split")
    parser.add_argument("--all_splits", action="store_true", default=True, help="Evaluate across Train, Dev (Validation), and Test splits")
    parser.add_argument("--root_dir", type=str, default=r"E:\6th sem\final yr project\CORD", help="Root directory of CORD dataset")
    args = parser.parse_args()
    
    evaluate(args.model_path, args.data_dir, args.num_samples, args.all_splits, args.root_dir)
