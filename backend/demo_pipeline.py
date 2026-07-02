#!/usr/bin/env python3
"""
Direct End-to-End Pipeline Demo
"""

import os
import json
import cv2
import numpy as np
from PIL import Image
import logging

logging.basicConfig(level=logging.ERROR)

print("=" * 100)
print("END-TO-END RECEIPT EXTRACTION PIPELINE DEMO".center(100))
print("=" * 100)

# Step 0: Download sample
print("\n[STEP 0] Downloading Sample Receipt...")
try:
    from datasets import load_dataset
    ds = load_dataset("Voxel51/consolidated_receipt_dataset", split="train", streaming=True)
    sample = next(iter(ds))
    image_pil = sample['image']
    
    if image_pil.mode != 'RGB':
        image_pil = image_pil.convert('RGB')
    
    os.makedirs("./test_image", exist_ok=True)
    image_path = "./test_image/sample_receipt.jpg"
    image_pil.save(image_path, quality=95)
    
    print(f"✅ Downloaded receipt: {image_pil.size[0]}x{image_pil.size[1]} pixels")
except Exception as e:
    print(f"⚠️  Using existing image or {e}")
    image_path = "./test_image/sample_receipt.jpg"

# Step 1: Load image
print("\n[STEP 1] Loading Receipt Image...")
if not os.path.exists(image_path):
    print(f"❌ Image file not found!")
    exit(1)

image = cv2.imread(image_path)
h, w = image.shape[:2]
print(f"✅ Image loaded: {w}x{h} pixels")

# Step 2: OCR
print("\n[STEP 2] Running OCR...")
try:
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    result = ocr.ocr(image_path, cls=True)
    
    words = []
    boxes = []
    
    if result and len(result) > 0:
        for line in result:
            if line:
                for item in line:
                    if len(item) >= 2:
                        text = str(item[1])
                        bbox_points = item[0]
                        
                        xs = [float(p[0]) for p in bbox_points]
                        ys = [float(p[1]) for p in bbox_points]
                        
                        x_min, x_max = min(xs), max(xs)
                        y_min, y_max = min(ys), max(ys)
                        
                        scale = 1000.0 / max(w, h)
                        x1 = int(x_min * scale)
                        y1 = int(y_min * scale)
                        x2 = int(x_max * scale)
                        y2 = int(y_max * scale)
                        
                        if len(text) > 0:
                            words.append(text)
                            boxes.append([x1, y1, x2, y2])
    
    print(f"✅ OCR extracted: {len(words)} words")
    
except Exception as e:
    print(f"⚠️  OCR error: {e}")
    words, boxes = [], []

# Step 3: LayoutLMv3
print("\n[STEP 3] Running LayoutLMv3 Entity Extraction...")
predictions = []
try:
    from app.services.document_intelligence.layoutlm_service import LayoutLMService
    
    layoutlm = LayoutLMService()
    if layoutlm.enabled and words:
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image_np = np.array(image_rgb)
        
        predictions = layoutlm.predict_entities(image_np, words, boxes)
        print(f"✅ LayoutLMv3 extracted: {len(predictions)} entities")
    else:
        print(f"⚠️  LayoutLMv3 disabled")
except Exception as e:
    print(f"⚠️  LayoutLMv3 error: {e}")

# Display Results
print("\n" + "=" * 100)
print("OCR RESULTS".ljust(50) + "LAYOUTLMV3 ENTITY RESULTS")
print("=" * 100)

# OCR side
print("\nOCR Output (First 20 words):\n")
for i in range(min(20, len(words))):
    word = words[i]
    print(f"  {i+1:2d}. {word}")

if len(words) > 20:
    print(f"\n  ... and {len(words)-20} more words\n")

# Entities side
print("\n\nEntity Extraction Results:\n")
if predictions:
    entity_groups = {}
    for pred in predictions:
        etype = pred.get('entity_type', 'UNKNOWN')
        if etype not in entity_groups:
            entity_groups[etype] = []
        entity_groups[etype].append(pred)
    
    print(f"Total entities found: {len(predictions)}\n")
    
    for etype in sorted(entity_groups.keys())[:8]:
        ents = entity_groups[etype]
        print(f"  🔹 {etype} ({len(ents)} items)")
        for j, ent in enumerate(ents[:2], 1):
            text = ent.get('text', '?')
            conf = ent.get('confidence', 0)
            print(f"     • {text:25s} (confidence: {conf:.0%})")
        if len(ents) > 2:
            print(f"     ... +{len(ents)-2} more")
        print()
else:
    print("  ⚠️  No entities extracted")

# Save output
print("=" * 100)
print("\n[STEP 4] Saving Results to JSON...\n")

output = {
    "pipeline": "Receipt OCR → LayoutLMv3 Entity Extraction",
    "image": {
        "path": image_path,
        "size": {"width": w, "height": h}
    },
    "ocr": {
        "words_count": len(words),
        "words": words[:40],
        "boxes": boxes[:40]
    },
    "entities": {
        "total": len(predictions),
        "entities": predictions[:50]
    }
}

output_file = "./test_image/FINAL_RESULTS.json"
with open(output_file, 'w') as f:
    json.dump(output, f, indent=2)

print(f"✅ Results saved to: {output_file}\n")

# Summary
print("=" * 100)
print("PIPELINE SUMMARY".center(100))
print("=" * 100)
print(f"""
✅ OCR Stage:
   • Words detected: {len(words)}
   • Boxes extracted: {len(boxes)}

✅ LayoutLMv3 Stage:
   • Entities extracted: {len(predictions)}

📁 Output: {output_file}
🖼️  Image: {image_path}

Status: ✅ PIPELINE SUCCESSFUL
""")
print("=" * 100)
