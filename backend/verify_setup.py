#!/usr/bin/env python3
"""Quick verification that the fine-tuned model is properly loaded."""

import os
import sys

print("=" * 60)
print("LAYOUTLMV3 FINE-TUNED MODEL VERIFICATION")
print("=" * 60)

# Check 1: Fine-tuned model folder exists
finetuned_path = "./layoutlmv3-finetuned"
print(f"\n✓ Checking for fine-tuned model folder: {finetuned_path}")
if os.path.exists(finetuned_path):
    print(f"  ✅ Found: {finetuned_path}")
    files = os.listdir(finetuned_path)
    print(f"  Contains {len(files)} files/folders: {', '.join(files[:5])}...")
else:
    print(f"  ❌ NOT FOUND: {finetuned_path}")
    sys.exit(1)

# Check 2: Verify model.safetensors exists
model_file = os.path.join(finetuned_path, "model.safetensors")
print(f"\n✓ Checking for model weights: {model_file}")
if os.path.exists(model_file):
    size_mb = os.path.getsize(model_file) / (1024 * 1024)
    print(f"  ✅ Found: {size_mb:.1f} MB")
else:
    print(f"  ❌ NOT FOUND")
    sys.exit(1)

# Check 3: Try loading the model
print(f"\n✓ Attempting to load model...")
try:
    from transformers import LayoutLMv3ForTokenClassification, LayoutLMv3Processor
    print(f"  Loading processor...")
    processor = LayoutLMv3Processor.from_pretrained(finetuned_path, apply_ocr=False)
    print(f"  ✅ Processor loaded")
    
    print(f"  Loading model...")
    model = LayoutLMv3ForTokenClassification.from_pretrained(finetuned_path)
    print(f"  ✅ Model loaded")
    
    print(f"\n✅ ALL CHECKS PASSED - Ready for evaluation!")
    print(f"   You can now run: python evaluate_layoutlmv3.py")
    
except Exception as e:
    print(f"  ❌ ERROR: {e}")
    sys.exit(1)

print("=" * 60)
