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

def evaluate(model_path: str, data_dir: str, num_samples: int = None):
    # 1. Load fine-tuned processor and model
    logger.info(f"Loading fine-tuned model and processor from: {model_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model path {model_path} does not exist. Run training first.")
        
    processor = AutoProcessor.from_pretrained(model_path)
    model = AutoModelForTokenClassification.from_pretrained(model_path)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Running evaluation on device: {device}")
    model.to(device)
    model.eval()
    
    # 2. Load CORD Test dataset
    logger.info(f"Loading test split from: {data_dir}")
    dataset = CORDLayoutLMDataset(data_dir, processor, max_samples=num_samples)
    
    # Custom collate function to handle batches of dicts of tensors
    def collate_fn(batch):
        return {
            key: torch.stack([d[key] for d in batch])
            for key in batch[0].keys()
        }
        
    dataloader = DataLoader(dataset, batch_size=2, collate_fn=collate_fn)
    
    all_predictions = []
    all_labels = []
    
    # 3. Inference loop
    logger.info("Starting inference on test set...")
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
            
            # Map IDs to classification strings
            for prediction, label in zip(predictions, labels):
                pred_list = []
                label_list = []
                for p, l in zip(prediction, label):
                    if l != -100: # Skip padding / subwords
                        pred_list.append(CORD_LABELS[p])
                        label_list.append(CORD_LABELS[l])
                all_predictions.append(pred_list)
                all_labels.append(label_list)
                
    # 4. Compute Metrics
    logger.info("Computing metrics...")
    
    # Classification Report
    report = classification_report(all_labels, all_predictions, zero_division=0)
    acc = accuracy_score(all_labels, all_predictions)
    
    # Format results
    print("\n" + "="*50)
    print("        LAYOUTLMV3 EVALUATION REPORT")
    print("="*50)
    print(f"Overall Sequence Accuracy: {acc:.2%}")
    print("\nClassification Report by Category:")
    print(report)
    print("="*50)
    
    # Save report to a text file for presentation/reporting
    report_file = os.path.join(model_path, "evaluation_report.txt")
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("="*50 + "\n")
        f.write("        LAYOUTLMV3 EVALUATION REPORT\n")
        f.write("="*50 + "\n")
        f.write(f"Overall Sequence Accuracy: {acc:.2%}\n\n")
        f.write("Classification Report by Category:\n")
        f.write(report)
        f.write("="*50 + "\n")
        
    logger.info(f"Evaluation report successfully saved to {report_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Fine-tuned LayoutLMv3 Model")
    parser.add_argument(
        "--model_path", 
        type=str, 
        default="./layoutlmv3-finetuned", 
        help="Path to the fine-tuned model checkpoint directory"
    )
    parser.add_argument(
        "--data_dir", 
        type=str, 
        default=r"E:\6th sem\final yr project\CORD\test", 
        help="Path to CORD dataset split directory (e.g. CORD/test)"
    )
    parser.add_argument(
        "--num_samples", 
        type=int, 
        default=None, 
        help="Limit number of evaluation samples (useful for fast check)"
    )
    args = parser.parse_args()
    
    evaluate(args.model_path, args.data_dir, args.num_samples)
