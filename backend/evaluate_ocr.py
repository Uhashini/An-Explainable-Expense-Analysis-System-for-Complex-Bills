import os
import json
import io
import jiwer
from datasets import load_dataset
from PIL import Image
from app.services.ocr_service import ocr_service

def flatten_gt(gt_parse):
    """
    Recursively flattens the gt_parse nested dictionary into a single space-separated string.
    This is used to create a reference string for WER/CER calculation.
    """
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
        # Load the first 3 samples for a robust but quick evaluation
        ds = load_dataset("naver-clova-ix/cord-v2", split="train", streaming=True)
        samples = []
        it = iter(ds)
        for _ in range(3):
            samples.append(next(it))
        
        all_refs = []
        all_hyps = []
        
        print(f"\nEvaluating {len(samples)} samples...")
        
        for idx, sample in enumerate(samples):
            image = sample['image']
            gt_parse = json.loads(sample['gt_parse']) if isinstance(sample['gt_parse'], str) else sample['gt_parse']
            
            # 1. Prepare reference text
            ref_text = flatten_gt(gt_parse)
            all_refs.append(ref_text)
            
            # 2. Run OCR Extraction
            img_byte_arr = io.BytesIO()
            if image.mode != 'RGB':
                image = image.convert('RGB')
            image.save(img_byte_arr, format='JPEG')
            image_bytes = img_byte_arr.getvalue()
            
            output = ocr_service.extract_structured_data(image_bytes)
            hyp_text = " ".join(output["words"])
            all_hyps.append(hyp_text)
            
            print(f"Sample {idx+1} processed.")

        # 3. Calculate Metrics
        wer = jiwer.wer(all_refs, all_hyps)
        cer = jiwer.cer(all_refs, all_hyps)
        
        print("\n" + "="*40)
        print("         OCR EVALUATION RESULTS")
        print("="*40)
        print(f"Total Samples Evaluated: {len(samples)}")
        print(f"Word Error Rate (WER):  {wer:.2%}")
        print(f"Character Error Rate (CER): {cer:.2%}")
        print("="*40)
        
        if cer < 0.15:
            print("Status: SUCCESS (OCR meets quality threshold for LayoutLMv3)")
        else:
            print("Status: WARNING (OCR accuracy is low. May need further tuning)")
            
    except Exception as e:
        print(f"Error during evaluation: {e}")

if __name__ == "__main__":
    run_evaluation()
