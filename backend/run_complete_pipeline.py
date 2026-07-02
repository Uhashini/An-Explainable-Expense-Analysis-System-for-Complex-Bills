#!/usr/bin/env python3
"""
Download a sample receipt and run the full pipeline
"""

import os
import json
import cv2
import numpy as np
from PIL import Image
import logging

logging.basicConfig(level=logging.WARNING)

print("=" * 80)
print("DOWNLOADING SAMPLE RECEIPT & RUNNING PIPELINE")
print("=" * 80)

# Step 1: Download sample receipt
print("\n[STEP 0] Downloading Sample Receipt from Dataset...")
try:
    from datasets import load_dataset
    
    print("   Downloading from Voxel51 dataset...")
    ds = load_dataset("Voxel51/consolidated_receipt_dataset", split="train", streaming=True)
    sample = next(iter(ds))
    image_pil = sample['image']
    
    if image_pil.mode != 'RGB':
        image_pil = image_pil.convert('RGB')
    
    # Save image
    image_path = "./test_image/image.png"
    os.makedirs("./test_image", exist_ok=True)
    image_pil.save(image_path, quality=95)
    
    print(f"✅ Sample receipt downloaded and saved: {image_path}")
    print(f"   Image size: {image_pil.size} pixels")
    
except Exception as e:
    print(f"❌ Failed to download: {e}")
    exit(1)

# Step 2: Load image
print("\n[STEP 1] Loading Receipt Image...")
image = cv2.imread(image_path)
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

print(f"✅ Image loaded")
print(f"   Size: {image.shape[1]} x {image.shape[0]} pixels")

# Step 3: Run OCR
print("\n[STEP 2] Running OCR (PaddleOCR)...")
try:
    from paddleocr import PaddleOCR
    
    ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    result = ocr.ocr(image_path, cls=True)
    
    print(f"✅ OCR completed")
    
    # Extract words and boxes
    words = []
    boxes = []
    confidences = []
    
    for line in result:
        for item in line:
            text = item[1]
            confidence = item[2]
            bbox_points = item[0]
            
            xs = [p[0] for p in bbox_points]
            ys = [p[1] for p in bbox_points]
            x_min, x_max = min(xs), max(xs)
            y_min, y_max = min(ys), max(ys)
            
            h, w = image.shape[:2]
            scale = 1000 / max(w, h)
            
            x1_norm = int(x_min * scale)
            y1_norm = int(y_min * scale)
            x2_norm = int(x_max * scale)
            y2_norm = int(y_max * scale)
            
            words.append(text)
            boxes.append([x1_norm, y1_norm, x2_norm, y2_norm])
            confidences.append(confidence)
    
    print(f"   ✅ Words detected: {len(words)}")
    if confidences:
        print(f"   ✅ Average OCR confidence: {sum(confidences)/len(confidences):.1%}")
    
except Exception as e:
    print(f"❌ OCR failed: {e}")
    exit(1)

# Step 4: Apply LayoutLMv3
print("\n[STEP 3] Running LayoutLMv3 Entity Classification...")
predictions = []
try:
    from app.services.document_intelligence.layoutlm_service import LayoutLMService
    
    layoutlm = LayoutLMService()
    
    if not layoutlm.enabled:
        print("⚠️  LayoutLMv3 not available")
    else:
        print(f"✅ LayoutLMv3 initialized on: {layoutlm.device}")
        
        image_np = np.array(image_rgb)
        predictions = layoutlm.predict_entities(image_np, words, boxes)
        
        print(f"   ✅ Entities extracted: {len(predictions)}")
        
except Exception as e:
    print(f"⚠️  LayoutLMv3 error: {e}")

# Step 5: Display Results
print("\n" + "=" * 80)
print("📖 OCR RESULTS (First 25 words)")
print("=" * 80)

for i in range(min(25, len(words))):
    word = words[i]
    conf = confidences[i] if i < len(confidences) else 0.0
    print(f"{i+1:2d}. '{word:20s}' │ Conf: {conf:5.0%}")

if len(words) > 25:
    print(f"\n... and {len(words) - 25} more words")

print("\n" + "=" * 80)
print("🏷️  ENTITY CLASSIFICATION RESULTS")
print("=" * 80)

if predictions and len(predictions) > 0:
    print(f"\nTotal entities found: {len(predictions)}\n")
    
    # Group by entity type
    entity_groups = {}
    for pred in predictions:
        etype = pred.get('entity_type', 'UNKNOWN')
        if etype not in entity_groups:
            entity_groups[etype] = []
        entity_groups[etype].append(pred)
    
    print("Entity Breakdown:")
    for etype in sorted(entity_groups.keys()):
        ents = entity_groups[etype]
        print(f"\n  🔹 {etype} (Found: {len(ents)})")
        
        for j, ent in enumerate(ents[:4], 1):
            text = ent.get('text', '?')
            score = ent.get('confidence', 0.0)
            print(f"     {j}. {text:30s} │ Score: {score:.1%}")
        
        if len(ents) > 4:
            print(f"     ... and {len(ents) - 4} more")

else:
    print("\n⚠️  No entities extracted by LayoutLMv3")

# Step 6: Save Output
print("\n" + "=" * 80)
output = {
    "image_metadata": {
        "path": image_path,
        "size": {"width": image.shape[1], "height": image.shape[0]},
    },
    "ocr_results": {
        "total_words": len(words),
        "words_sample": words[:30],
        "all_words": words,
        "all_boxes": boxes,
        "confidence_scores": [float(c) for c in confidences]
    },
    "layoutlmv3_results": {
        "total_entities": len(predictions),
        "entities": predictions[:50]  # First 50
    },
    "statistics": {
        "avg_ocr_confidence": sum(confidences) / len(confidences) if confidences else 0,
        "avg_entity_confidence": sum([p.get('confidence', 0) for p in predictions]) / len(predictions) if predictions else 0
    }
}

output_path = "./test_image/FULL_PIPELINE_RESULTS.json"
with open(output_path, 'w') as f:
    json.dump(output, f, indent=2)

print(f"✅ Full results saved: {output_path}")

# Final Summary
print("\n" + "=" * 80)
print("✅ FULL PIPELINE EXECUTION COMPLETE")
print("=" * 80)
print(f"\n📊 STATISTICS:")
print(f"   OCR Words Detected: {len(words)}")
print(f"   OCR Avg Confidence: {sum(confidences)/len(confidences):.1%}" if confidences else "   N/A")
print(f"   LayoutLMv3 Entities: {len(predictions)}")
print(f"\n📁 Output Files:")
print(f"   Image: {image_path}")
print(f"   Results: {output_path}")
print("\n" + "=" * 80)
