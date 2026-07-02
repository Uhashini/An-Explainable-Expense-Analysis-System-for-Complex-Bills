#!/usr/bin/env python3
"""
Simplified End-to-End Pipeline Test
Direct OCR + LayoutLMv3 on receipt image
"""

import os
import json
import cv2
import numpy as np
from PIL import Image
import logging

logging.basicConfig(level=logging.WARNING)

print("=" * 80)
print("SIMPLIFIED RECEIPT EXTRACTION PIPELINE")
print("=" * 80)

# Step 1: Load image
print("\n[STEP 1] Loading Receipt Image...")
image_path = "./test_image/sample_receipt.jpg"

if not os.path.exists(image_path):
    print(f"❌ Image not found: {image_path}")
    exit(1)

image = cv2.imread(image_path)
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
pil_image = Image.fromarray(image_rgb)

print(f"✅ Image loaded: {image_path}")
print(f"   Size: {image.shape[1]} x {image.shape[0]} pixels")

# Step 2: Run OCR directly
print("\n[STEP 2] Running OCR (PaddleOCR)...")
try:
    from paddleocr import PaddleOCR
    
    ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    result = ocr.ocr(image_path, cls=True)
    
    print(f"✅ OCR completed")
    print(f"   Raw OCR results: {len(result)} text regions detected")
    
    # Flatten results
    words = []
    boxes = []
    confidences = []
    
    for line in result:
        for item in line:
            text = item[1]  # Text
            confidence = item[2]  # Confidence
            bbox_points = item[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            
            # Convert quadrilateral to rectangular bbox
            xs = [p[0] for p in bbox_points]
            ys = [p[1] for p in bbox_points]
            x_min, x_max = min(xs), max(xs)
            y_min, y_max = min(ys), max(ys)
            
            # Normalize to 0-1000 scale
            h, w = image.shape[:2]
            scale = 1000 / max(w, h)
            
            x1_norm = int(x_min * scale)
            y1_norm = int(y_min * scale)
            x2_norm = int(x_max * scale)
            y2_norm = int(y_max * scale)
            
            words.append(text)
            boxes.append([x1_norm, y1_norm, x2_norm, y2_norm])
            confidences.append(confidence)
    
    print(f"   Words extracted: {len(words)}")
    if len(words) > 0:
        print(f"   Average confidence: {sum(confidences) / len(confidences):.2%}")
    
except Exception as e:
    print(f"❌ OCR failed: {e}")
    exit(1)

# Step 3: Apply LayoutLMv3
print("\n[STEP 3] Running LayoutLMv3 Entity Classification...")
try:
    from app.services.document_intelligence.layoutlm_service import LayoutLMService
    
    layoutlm = LayoutLMService()
    
    if not layoutlm.enabled:
        print("⚠️  LayoutLMv3 disabled")
        predictions = []
    else:
        print(f"✅ LayoutLMv3 initialized on: {layoutlm.device}")
        
        # Run inference
        image_np = np.array(pil_image)
        predictions = layoutlm.predict_entities(image_np, words, boxes)
        
        print(f"✅ Entity extraction completed")
        print(f"   Entities predicted: {len(predictions)}")
        
except Exception as e:
    print(f"⚠️  LayoutLMv3 error: {e}")
    predictions = []

# Step 4: Display Results
print("\n" + "=" * 80)
print("OCR RESULTS (First 20 words)")
print("=" * 80)

for i in range(min(20, len(words))):
    word = words[i]
    box = boxes[i]
    conf = confidences[i] if i < len(confidences) else 0.0
    print(f"{i+1:2d}. '{word:15s}' | Box: {box} | Confidence: {conf:.2%}")

if len(words) > 20:
    print(f"\n... and {len(words) - 20} more words")

print("\n" + "=" * 80)
print("ENTITY EXTRACTION RESULTS")
print("=" * 80)

if predictions:
    print(f"\nTotal entities found: {len(predictions)}\n")
    
    # Group by entity type
    entity_groups = {}
    for pred in predictions:
        etype = pred.get('entity_type', 'UNKNOWN')
        if etype not in entity_groups:
            entity_groups[etype] = []
        entity_groups[etype].append(pred)
    
    # Display top entities
    for etype in sorted(entity_groups.keys()):
        ents = entity_groups[etype]
        print(f"🏷️  {etype} ({len(ents)} found):")
        
        for ent in ents[:3]:  # Show first 3
            text = ent.get('text', '?')
            score = ent.get('confidence', 0.0)
            print(f"   • {text:30s} (confidence: {score:.2%})")
        
        if len(ents) > 3:
            print(f"   ... and {len(ents) - 3} more")
        print()
else:
    print("⚠️  No entities extracted")

# Step 5: Save Results
print("=" * 80)
print("SAVING OUTPUT")
print("=" * 80)

output = {
    "image_metadata": {
        "path": image_path,
        "size": {"width": image.shape[1], "height": image.shape[0]},
        "pixels": image.shape[1] * image.shape[0]
    },
    "ocr_results": {
        "total_words": len(words),
        "sample_words": words[:20],
        "full_words": words,
        "full_boxes": boxes,
        "confidences": [float(c) for c in confidences]
    },
    "layoutlmv3_results": {
        "total_entities": len(predictions),
        "entities": predictions
    }
}

output_path = "./test_image/PIPELINE_RESULTS.json"
with open(output_path, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n✅ Results saved to: {output_path}")

# Step 6: Summary
print("\n" + "=" * 80)
print("PIPELINE SUMMARY")
print("=" * 80)
print(f"\n📊 OCR Stage:")
print(f"   ✅ Words detected: {len(words)}")
print(f"   ✅ Bounding boxes: {len(boxes)}")
print(f"   ✅ Average confidence: {sum(confidences)/len(confidences):.1%}" if confidences else "   ⚠️  No confidence data")

print(f"\n🤖 LayoutLMv3 Stage:")
print(f"   ✅ Entities extracted: {len(predictions)}")

if predictions:
    # Show main entity types
    types = list(set([p.get('entity_type', 'UNKNOWN') for p in predictions]))
    print(f"   ✅ Entity types found: {', '.join(types[:5])}")
    if len(types) > 5:
        print(f"      ... and {len(types) - 5} more")

print(f"\n📁 Output file: {output_path}")
print("\n✅ PIPELINE TEST COMPLETE")
print("=" * 80)
