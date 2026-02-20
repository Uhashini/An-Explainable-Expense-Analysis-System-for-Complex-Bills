import os
import json
import io
from datasets import load_dataset
from PIL import Image
from app.services.ocr_service import ocr_service

def run_test():
    print("Loading dataset: Voxel51/consolidated_receipt_dataset...")
    try:
        # Load only the first sample to be fast
        ds = load_dataset("Voxel51/consolidated_receipt_dataset", split="train", streaming=True)
        sample = next(iter(ds))
        
        # The dataset 'image' field contains a PIL image
        image = sample['image']
        
        # Convert to RGB if necessary (e.g. from P mode) to support JPEG
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Save to test_image folder
        if not os.path.exists("test_image"):
            os.makedirs("test_image")
        
        image_path = os.path.join("test_image", "sample_receipt.jpg")
        image.save(image_path)
        print(f"Sample image saved to: {image_path}")
        
        # Convert PIL image to bytes for the OCR service
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        image_bytes = img_byte_arr.getvalue()
        
        print("Running structured OCR extraction...")
        output = ocr_service.extract_structured_data(image_bytes)
        
        # Print a subset of the output to avoid overwhelming the console
        # but show enough to demonstrate it works
        print("\n--- OCR OUTPUT PREVIEW (First 10 words) ---")
        preview = {
            "words": output["words"][:10],
            "boxes": output["boxes"][:10],
            "image_size": output["image_size"],
            "total_words_count": len(output["words"])
        }
        print(json.dumps(preview, indent=2))
        
        # Print full output for the user
        print("\n--- FULL OCR OUTPUT ---")
        print(json.dumps(output, indent=2))
        
        # Save to JSON file
        json_path = os.path.join("test_image", "ocr_output.json")
        with open(json_path, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"\nFull OCR result saved to: {json_path}")
        
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    run_test()
