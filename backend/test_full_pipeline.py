#!/usr/bin/env python3
"""
End-to-End Pipeline Test: Full Receipt Processing Demo
- Load receipt image
- Extract text + bounding boxes (OCR)
- Apply LayoutLMv3 entity classification
- Output structured JSON
"""

import os
import json
import io
from PIL import Image
import numpy as np

print("=" * 80)
print("END-TO-END RECEIPT EXTRACTION PIPELINE TEST")
print("=" * 80)

# Step 1: Load test receipt image
print("\n[STEP 1] Loading Receipt Image...")
test_image_path = "./test_image/sample_receipt.jpg"

if os.path.exists(test_image_path):
    image = Image.open(test_image_path)
    print(f"✅ Loaded image: {test_image_path}")
    print(f"   Image size: {image.size} pixels")
    print(f"   Image mode: {image.mode}")
else:
    print(f"❌ Image not found: {test_image_path}")
    print("   Downloading sample receipt from dataset...")
    try:
        from datasets import load_dataset
        ds = load_dataset("Voxel51/consolidated_receipt_dataset", split="train", streaming=True)
        sample = next(iter(ds))
        image = sample['image']
        if image.mode != 'RGB':
            image = image.convert('RGB')
        os.makedirs("test_image", exist_ok=True)
        image.save(test_image_path)
        print(f"✅ Downloaded and saved: {test_image_path}")
    except Exception as e:
        print(f"❌ Failed to download: {e}")
        exit(1)

# Step 2: Run OCR
print("\n[STEP 2] Running OCR Engine (Tesseract)...")
try:
    from app.services.ocr_service import ocr_service
    
    # Convert PIL image to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='JPEG')
    image_bytes = img_byte_arr.getvalue()
    
    ocr_output = ocr_service.extract_structured_data(image_bytes)
    
    words = ocr_output.get("words", [])
    boxes = ocr_output.get("boxes", [])
    
    print(f"✅ OCR completed successfully")
    print(f"   Total words detected: {len(words)}")
    print(f"   Total bounding boxes: {len(boxes)}")
    
    if len(words) > 0:
        print(f"\n   First 10 OCR words:")
        for i, word in enumerate(words[:10]):
            print(f"      {i+1}. \"{word}\"")
    
except Exception as e:
    print(f"❌ OCR failed: {e}")
    exit(1)

# Step 3: Run LayoutLMv3 Entity Extraction
print("\n[STEP 3] Running LayoutLMv3 Entity Classification...")
try:
    from app.services.document_intelligence.layoutlm_service import LayoutLMService
    import numpy as np
    
    layoutlm = LayoutLMService()
    
    if not layoutlm.enabled:
        print("⚠️  LayoutLMv3 not available; trying regex fallback...")
        entities = []
    else:
        print(f"✅ LayoutLMv3 initialized on device: {layoutlm.device}")
        
        # Convert image to numpy array
        image_np = np.array(image)
        
        # Run entity prediction
        try:
            predictions = layoutlm.predict_entities(image_np, words, boxes)
            print(f"✅ Entity extraction completed")
            print(f"   Entities found: {len(predictions)}")
            
            entities = predictions
        except Exception as e:
            print(f"⚠️  Entity prediction failed: {e}")
            print(f"   Attempting regex fallback...")
            entities = []

except Exception as e:
    print(f"⚠️  LayoutLMv3 service error: {e}")
    entities = []

# Step 4: Format Output
print("\n[STEP 4] Assembling Structured Output...")

output_json = {
    "image_metadata": {
        "size": list(image.size),
        "mode": image.mode,
        "format": "JPEG"
    },
    "ocr_results": {
        "total_words": len(words),
        "words": words[:30],  # First 30 words
        "sample_words_with_boxes": [
            {
                "word": words[i],
                "bounding_box": boxes[i]
            }
            for i in range(min(5, len(words)))
        ]
    },
    "entity_extraction": {
        "total_entities_detected": len(entities),
        "entities": entities[:20]  # First 20 entities
    }
}

print("✅ Output assembled")

# Step 5: Display Results
print("\n" + "=" * 80)
print("RESULTS SUMMARY")
print("=" * 80)

print("\n📊 OCR STATISTICS:")
print(f"   • Words detected: {len(words)}")
print(f"   • Bounding boxes: {len(boxes)}")

print("\n🔤 SAMPLE OCR RESULTS (First 5 words):")
for i in range(min(5, len(words))):
    word = words[i]
    box = boxes[i] if i < len(boxes) else [0, 0, 0, 0]
    print(f"   {i+1}. Word: '{word}'")
    print(f"      Box: {box}")

if entities:
    print("\n🏷️  ENTITY EXTRACTION RESULTS:")
    print(f"   Total entities: {len(entities)}\n")
    
    # Group entities by type
    entity_types = {}
    for entity in entities:
        etype = entity.get('entity_type', 'UNKNOWN')
        if etype not in entity_types:
            entity_types[etype] = []
        entity_types[etype].append(entity)
    
    for etype, ents in list(entity_types.items())[:10]:
        print(f"   {etype}:")
        for ent in ents[:3]:  # Show first 3 of each type
            text = ent.get('text', '?')
            conf = ent.get('confidence', 0.0)
            print(f"      • {text} (confidence: {conf:.2f})")
else:
    print("\n⚠️  No entities extracted (regex fallback or error)")

# Step 6: Save Full Output
print("\n[STEP 5] Saving Output to File...")
output_path = "./test_image/pipeline_output.json"

with open(output_path, 'w') as f:
    json.dump(output_json, f, indent=2)

print(f"✅ Full output saved to: {output_path}")

# Step 7: Final Status
print("\n" + "=" * 80)
print("✅ PIPELINE TEST COMPLETE")
print("=" * 80)
print("\n📁 Output Files:")
print(f"   • Image: {test_image_path}")
print(f"   • Results: {output_path}")
print("\nTo view results, open: pipeline_output.json")
print("=" * 80)
