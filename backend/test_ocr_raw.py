import os
import json
import io
import jiwer
from datasets import load_dataset
from PIL import Image
import numpy as np
import cv2
from app.services.ocr_service import ocr_service

def flatten_gt(gt_parse):
    text = []
    if isinstance(gt_parse, dict):
        for key, value in gt_parse.items():
            text.append(flatten_gt(value))
    elif isinstance(gt_parse, list):
        for item in gt_parse:
            text.append(flatten_gt(item))
    else:
        text.append(str(gt_parse))
    
    return " ".join([t for t in text if t.strip()])

def run_evaluation():
    print("Loading dataset: naver-clova-ix/cord-v2...")
    try:
        ds = load_dataset("naver-clova-ix/cord-v2", split="train", streaming=True)
        samples = []
        it = iter(ds)
        for _ in range(3):
            samples.append(next(it))
        
        all_refs = []
        all_hyps = []
        
        print(f"\nEvaluating {len(samples)} samples WITHOUT preprocessing...")
        
        for idx, sample in enumerate(samples):
            image = sample['image']
            gt_parse = json.loads(sample['gt_parse']) if isinstance(sample['gt_parse'], str) else sample['gt_parse']
            
            ref_text = flatten_gt(gt_parse)
            all_refs.append(ref_text)
            
            # Convert PIL image to numpy BGR for CV2
            if image.mode != 'RGB':
                image = image.convert('RGB')
            open_cv_image = np.array(image)
            # Convert RGB to BGR
            open_cv_image = open_cv_image[:, :, ::-1].copy()
            
            # Run OCR directly on the raw image!
            raw_results = ocr_service.ocr.extract_text(open_cv_image)
            
            hyp_text = " ".join([res["text"] for res in raw_results])
            all_hyps.append(hyp_text)
            
            print(f"Sample {idx+1} processed.")

        # Calculate Metrics
        wer = jiwer.wer(all_refs, all_hyps)
        cer = jiwer.cer(all_refs, all_hyps)
        
        print("\n" + "="*40)
        print("     RAW OCR EVALUATION RESULTS (NO PREPROCESS)")
        print("="*40)
        print(f"Total Samples Evaluated: {len(samples)}")
        print(f"Word Error Rate (WER):  {wer:.2%}")
        print(f"Character Error Rate (CER): {cer:.2%}")
        print("="*40)
            
    except Exception as e:
        print(f"Error during evaluation: {e}")

if __name__ == "__main__":
    run_evaluation()
