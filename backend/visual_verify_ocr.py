import os
import warnings
import time
import uuid
import cv2
import json
import numpy as np
from app.services.document_intelligence import (
    PreprocessingService, 
    PerspectiveCorrector, 
    InputClassifier, 
    OCREngine, 
    VotingEngine
)
from app.utils import OCRLogger

# Suppress warnings
warnings.filterwarnings("ignore", category=UserWarning)

def draw_results(image, results, output_name="verification_output.jpg"):
    """
    Draws bounding boxes and text on the image for manual verification.
    """
    viz_img = image.copy()
    for res in results:
        bbox = np.array(res["bbox"], dtype=np.int32)
        cv2.polylines(viz_img, [bbox], isClosed=True, color=(0, 255, 0), thickness=2)
        cv2.putText(viz_img, res["text"], (bbox[0][0], bbox[0][1] - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
    
    cv2.imwrite(output_name, viz_img)
    return output_name

def run_visual_test(image_path: str):
    print(f"--- Starting Visual OCR Verification ---")
    
    # 1. Initialize
    ocr = OCREngine(lang='en')
    preprocessor = PreprocessingService()
    corrector = PerspectiveCorrector()
    
    # 2. Process
    img = cv2.imread(image_path)
    enhanced = preprocessor.apply_clahe(img)
    corrected = corrector.detect_and_correct(enhanced)
    
    # 3. Extract
    print("Running OCR...")
    results = ocr.extract_text(corrected)
    
    # 4. Visualize
    if results:
        out_file = draw_results(corrected, results)
        print(f"SUCCESS: Extracted {len(results)} blocks.")
        print(f"Verification image saved to: {out_file}")
    else:
        print("FAILURE: No text blocks detected.")
        # Save preprocessed image to see why it failed
        cv2.imwrite("failed_preprocess.jpg", corrected)
        print("Saved 'failed_preprocess.jpg' for troubleshooting.")

if __name__ == "__main__":
    target = "backend/test_image/sample_receipt.jpg"
    if os.path.exists(target):
        run_visual_test(target)
    else:
        print(f"File not found: {target}")
