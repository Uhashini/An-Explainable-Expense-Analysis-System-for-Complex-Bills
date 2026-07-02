import os
import json
import argparse
import logging
from PIL import Image
import numpy as np
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoProcessor, 
    AutoModelForTokenClassification, 
    TrainingArguments, 
    Trainer,
    DataCollatorForTokenClassification
)
from seqeval.metrics import precision_score, recall_score, f1_score, accuracy_score

# Setup Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# List of 22 CORD Categories
CORD_LABELS = [
    'O', 
    'menu.cnt', 'menu.discountprice', 'menu.nm', 'menu.num', 'menu.price', 
    'menu.sub_cnt', 'menu.sub_nm', 'menu.sub_price', 'menu.unitprice', 'menu.vatyn', 
    'sub_total.discount_price', 'sub_total.service_price', 'sub_total.subtotal_price', 'sub_total.tax_price', 
    'total.cashprice', 'total.changeprice', 'total.creditcardprice', 'total.emoneyprice', 
    'total.menuqty_cnt', 'total.menutype_cnt', 'total.total_etc', 'total.total_price'
]

label2id = {l: i for i, l in enumerate(CORD_LABELS)}
id2label = {i: l for i, l in enumerate(CORD_LABELS)}

class CORDLayoutLMDataset(Dataset):
    """Custom Dataset to parse local CORD images and JSON files for LayoutLMv3."""
    
    def __init__(self, data_dir: str, processor: AutoProcessor, max_samples: int = None):
        self.data_dir = data_dir
        self.processor = processor
        
        self.image_dir = os.path.join(data_dir, "image")
        self.json_dir = os.path.join(data_dir, "json")
        
        if not os.path.exists(self.image_dir) or not os.path.exists(self.json_dir):
            raise FileNotFoundError(f"Missing image or json folder in {data_dir}")
            
        self.filenames = []
        all_json = sorted([os.path.splitext(f)[0] for f in os.listdir(self.json_dir) if f.endswith('.json')])
        for name in all_json:
            img_path = os.path.join(self.image_dir, f"{name}.png")
            if os.path.exists(img_path):
                self.filenames.append(name)
        
        if max_samples:
            self.filenames = self.filenames[:max_samples]
            
        logger.info(f"Loaded {len(self.filenames)} matched samples from {data_dir}")
        
    def __len__(self):
        return len(self.filenames)
        
    def __getitem__(self, idx):
        filename = self.filenames[idx]
        
        # 1. Paths
        image_path = os.path.join(self.image_dir, f"{filename}.png")
        json_path = os.path.join(self.json_dir, f"{filename}.json")
        
        # 2. Load Image
        image = Image.open(image_path).convert("RGB")
        width, height = image.size
        
        # 3. Load JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        words = []
        boxes = []
        labels = []
        
        for line in data.get("valid_line", []):
            category = line.get("category", "O")
            # Map category to ID, default to 'O' if category is unknown
            label_id = label2id.get(category, 0)
            
            for word_info in line.get("words", []):
                text = word_info.get("text", "").strip()
                if not text:
                    continue
                    
                quad = word_info.get("quad", {})
                
                # CORD quad points: x1, y1 (top-left), x2, y2 (top-right), x3, y3 (bottom-right), x4, y4 (bottom-left)
                x_coords = [quad.get("x1", 0), quad.get("x2", 0), quad.get("x3", 0), quad.get("x4", 0)]
                y_coords = [quad.get("y1", 0), quad.get("y2", 0), quad.get("y3", 0), quad.get("y4", 0)]
                
                x_min = min(x_coords)
                y_min = min(y_coords)
                x_max = max(x_coords)
                y_max = max(y_coords)
                
                # Normalize coordinates to 0-1000 scale
                x0 = int(1000 * x_min / width)
                y0 = int(1000 * y_min / height)
                x1 = int(1000 * x_max / width)
                y1 = int(1000 * y_max / height)
                
                # Clip bounds to ensure they remain inside 0-1000
                x0 = min(max(0, x0), 1000)
                y0 = min(max(0, y0), 1000)
                x1 = min(max(0, x1), 1000)
                y1 = min(max(0, y1), 1000)
                
                words.append(text)
                boxes.append([x0, y0, x1, y1])
                labels.append(label_id)
                
        # Handle cases with no valid lines (fallback to single O token)
        if not words:
            words = ["pad"]
            boxes = [[0, 0, 0, 0]]
            labels = [0]
            
        # 4. Multimodal Tokenization (Process Image + Layout + Text)
        encoding = self.processor(
            image, 
            words, 
            boxes=boxes, 
            truncation=True, 
            padding="max_length", 
            max_length=512,
            return_tensors="pt"
        )
        
        # Remove batch dimension added by return_tensors="pt"
        item = {key: val.squeeze(0) for key, val in encoding.items()}
        
        # 5. Token-to-Word Label Alignment
        # The tokenizer splits words into wordpieces (e.g. "GANACHE" -> "GAN", "##ACHE").
        # We need to map word-level labels to token-level labels.
        word_ids = encoding.word_ids()
        token_labels = []
        previous_word_idx = None
        
        for word_idx in word_ids:
            if word_idx is None:
                # Special tokens like [CLS] or [SEP] or padding tokens get -100
                token_labels.append(-100)
            elif word_idx != previous_word_idx:
                # Assign the word label to the first token of the word
                token_labels.append(labels[word_idx])
            else:
                # Assign -100 to subsequent tokens of a split word to ignore them in loss
                token_labels.append(-100)
            previous_word_idx = word_idx
            
        item["labels"] = torch.tensor(token_labels, dtype=torch.long)
        return item

def compute_metrics(eval_preds):
    predictions, labels = eval_preds
    predictions = np.argmax(predictions, axis=2)

    # Remove ignored index -100
    true_predictions = [
        [CORD_LABELS[p] for (p, l) in zip(prediction, label) if l != -100]
        for prediction, label in zip(predictions, labels)
    ]
    true_labels = [
        [CORD_LABELS[l] for (p, l) in zip(prediction, label) if l != -100]
        for prediction, label in zip(predictions, labels)
    ]

    return {
        "precision": precision_score(true_labels, true_predictions, zero_division=0),
        "recall": recall_score(true_labels, true_predictions, zero_division=0),
        "f1": f1_score(true_labels, true_predictions, zero_division=0),
        "accuracy": accuracy_score(true_labels, true_predictions),
    }

def main():
    parser = argparse.ArgumentParser(description="LayoutLMv3 CORD Fine-Tuning Script")
    parser.add_argument("--smoke_test", action="store_true", help="Run a quick smoke test on CPU")
    args = parser.parse_args()
    
    # 1. Initialize Processor and Model
    model_name = "microsoft/layoutlmv3-base"
    logger.info(f"Initializing {model_name} processor and model...")
    processor = AutoProcessor.from_pretrained(model_name, apply_ocr=False)
    
    model = AutoModelForTokenClassification.from_pretrained(
        model_name,
        num_labels=len(CORD_LABELS),
        id2label=id2label,
        label2id=label2id
    )
    
    # 2. Check Device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Primary training device: {device}")
    
    # 3. Setup datasets based on arguments
    cord_base_path = r"E:\6th sem\final yr project\CORD"
    train_dir = os.path.join(cord_base_path, "train")
    dev_dir = os.path.join(cord_base_path, "dev")
    
    if args.smoke_test:
        logger.info("SMOKE TEST MODE ENABLED (Running locally on 2 samples, 1 epoch)")
        train_dataset = CORDLayoutLMDataset(train_dir, processor, max_samples=2)
        eval_dataset = CORDLayoutLMDataset(dev_dir, processor, max_samples=2)
        epochs = 1
        batch_size = 1
        logging_steps = 1
        output_dir = "./layoutlmv3-smoke-test"
        eval_strategy = "no"
        save_strategy = "no"
    else:
        logger.info("PRODUCTION TRAINING MODE ENABLED")
        train_dataset = CORDLayoutLMDataset(train_dir, processor)
        eval_dataset = CORDLayoutLMDataset(dev_dir, processor)
        epochs = 15
        batch_size = 4 if device == "cuda" else 1
        logging_steps = 50
        output_dir = "./layoutlmv3-finetuned"
        eval_strategy = "epoch"
        save_strategy = "epoch"

    # 4. Setup Training Arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=1e-5,
        evaluation_strategy=eval_strategy,
        save_strategy=save_strategy,
        load_best_model_at_end=(save_strategy == "epoch"),
        metric_for_best_model="f1" if save_strategy == "epoch" else None,
        logging_steps=logging_steps,
        dataloader_num_workers=0, # Recommended for Windows path stability
        use_cpu=(device == "cpu")
    )
    
    # 5. Collator and Trainer Setup
    # Data collator aligns pads for batch shapes
    data_collator = DataCollatorForTokenClassification(processor.tokenizer)
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        compute_metrics=compute_metrics
    )
    
    # 6. Train!
    logger.info("Starting training loop...")
    trainer.train()
    
    # 7. Save Best Checkpoint
    logger.info(f"Saving best model checkpoint and config files to {output_dir}")
    trainer.save_model(output_dir)
    processor.save_pretrained(output_dir)
    logger.info("Saving complete. System ready!")

if __name__ == "__main__":
    main()
