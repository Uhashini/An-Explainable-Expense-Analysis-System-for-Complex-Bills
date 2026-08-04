import json
import math
import re
import string
import time
from pathlib import Path

import cv2
import jiwer
import numpy as np

from app.services.ocr_service import ocr_service
from app.services.document_intelligence.perspective_corrector import PerspectiveCorrector
from app.services.document_intelligence.preprocessing_service import PreprocessingService
from evaluate_ocr import (
    normalize_text,
    box_iou,
    to_xyxy,
    sort_words,
    production_geometry,
    transform_points,
    match_detections,
    metric_summary
)

# Exact SROIE 2019 benchmark folder paths specified for the project repository
SROIE_IMAGES_DIR = Path(r"E:\6th sem\final yr project\SROIE2019\test\img")
SROIE_BOXES_DIR = Path(r"E:\6th sem\final yr project\SROIE2019\test\box")


def parse_sroie_box_file(annotation_path: Path):
    """
    Parse standard SROIE ICDAR 2019 Task 1 & 2 box annotation file (.txt).
    Standard TXT format per line: x1, y1, x2, y2, x3, y3, x4, y4, text transcript
    Returns a list of word dictionaries with text and 4 corner points.
    """
    words = []
    with annotation_path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # Split on the first 8 commas (coordinates)
            parts = line.split(",", 8)
            if len(parts) < 9:
                continue
            try:
                coords = [int(float(p.strip())) for p in parts[:8]]
                text = parts[8].strip()
                if not text:
                    continue
                
                # Proportional word decomposition so SROIE line bounding boxes match LayoutLMv3 word tokens
                sub_tokens = text.split()
                if not sub_tokens:
                    continue
                
                x1 = min(coords[0], coords[6])
                y1 = min(coords[1], coords[3])
                x2 = max(coords[2], coords[4])
                y2 = max(coords[5], coords[7])
                total_w = max(1, x2 - x1)
                
                total_chars = sum(len(p) for p in sub_tokens) + max(0, len(sub_tokens) - 1)
                if total_chars == 0:
                    total_chars = 1
                
                curr_x = x1
                for sub_text in sub_tokens:
                    sub_w = int(total_w * (len(sub_text) / total_chars))
                    word_points = [
                        [curr_x, y1],
                        [curr_x + sub_w, y1],
                        [curr_x + sub_w, y2],
                        [curr_x, y2]
                    ]
                    words.append({"text": sub_text, "points": word_points})
                    space_w = int(total_w * (1 / total_chars))
                    curr_x += sub_w + space_w

            except ValueError:
                continue
                
    return words


def load_sroie_samples(images_dir=SROIE_IMAGES_DIR, boxes_dir=SROIE_BOXES_DIR):
    """Pair each SROIE box annotation with its corresponding image."""
    samples = []
    if not boxes_dir.exists():
        return samples

    for box_path in sorted(boxes_dir.glob("*.txt")):
        stem = box_path.stem
        image_path = next((images_dir / f"{stem}{suffix}" for suffix in (".jpg", ".JPG", ".png", ".PNG", ".jpeg")
                           if (images_dir / f"{stem}{suffix}").exists()), None)
        if image_path is None:
            continue
            
        ground_truth_words = parse_sroie_box_file(box_path)
        if not ground_truth_words:
            continue
            
        samples.append({
            "image_path": image_path, 
            "ground_truth_words": ground_truth_words
        })
    return samples


def draw_debug_overlay(image, target_boxes, predicted_boxes, save_path):
    """Render green boxes for GT and blue boxes for predictions."""
    canvas = image.copy()
    for box in target_boxes:
        x1, y1, x2, y2 = [int(round(v)) for v in box]
        cv2.rectangle(canvas, (x1, y1), (x2, y2), (0, 180, 0), 2)
    for box in predicted_boxes:
        x1, y1, x2, y2 = [int(round(v)) for v in box]
        cv2.rectangle(canvas, (x1, y1), (x2, y2), (255, 120, 0), 1)
    cv2.imwrite(str(save_path), canvas)


def run_sroie_evaluation(images_dir=SROIE_IMAGES_DIR, boxes_dir=SROIE_BOXES_DIR, sample_limit=None):
    """Evaluate SROIE dataset purely for OCR Text & Bounding Box Detection accuracy (no semantic evaluation)."""
    evaluation_dir = Path(__file__).resolve().parent / "evaluation"
    debug_dir = evaluation_dir / "sroie_debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Loading SROIE 2019 benchmark dataset from:\n  Images: {images_dir}\n  Boxes : {boxes_dir}")
    samples = load_sroie_samples(images_dir=images_dir, boxes_dir=boxes_dir)
    if not samples:
        print(f"\n[ERROR] No matching SROIE image/box pairs were found in {images_dir} and {boxes_dir}!")
        return

    if sample_limit is not None:
        samples = samples[:sample_limit]
        print(f"Limiting evaluation to the first {len(samples)} samples.")

    strict_refs, strict_hyps, normalized_refs, normalized_hyps = [], [], [], []
    thresholds = (0.5, 0.4, 0.3)
    counts = {threshold: [0, 0, 0] for threshold in thresholds}
    start_time = time.time()

    for index, sample in enumerate(samples, start=1):
        image_bytes = sample["image_path"].read_bytes()
        # SROIE images are already flatbed digital scans; disable perspective table warping
        production_output = ocr_service.extract_structured_data(image_bytes, preprocess=False)
        data = production_output["data"]
        words = data.get("words", [])
        boxes = data.get("boxes", [])
        
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_original = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        orig_h, orig_w = img_original.shape[:2]
            
        ground_truth_words = sort_words(sample["ground_truth_words"])

        predicted_words = sort_words([
            {"text": text, "points": [
                [box[0] * orig_w / 1000, box[1] * orig_h / 1000],
                [box[2] * orig_w / 1000, box[1] * orig_h / 1000],
                [box[2] * orig_w / 1000, box[3] * orig_h / 1000],
                [box[0] * orig_w / 1000, box[3] * orig_h / 1000]
            ]}
            for text, box in zip(words, boxes)
        ])

        reference = " ".join(word["text"] for word in ground_truth_words)
        hypothesis = " ".join(word["text"] for word in predicted_words)
        strict_refs.append(reference)
        strict_hyps.append(hypothesis)
        normalized_refs.append(normalize_text(reference))
        normalized_hyps.append(normalize_text(hypothesis))

        target_boxes = [to_xyxy(word["points"]) for word in ground_truth_words]
        predicted_boxes = [to_xyxy(word["points"]) for word in predicted_words]
        for threshold in thresholds:
            tp, fp, fn = match_detections(predicted_boxes, target_boxes, threshold)
            counts[threshold][0] += tp
            counts[threshold][1] += fp
            counts[threshold][2] += fn

        draw_debug_overlay(img_original, target_boxes, predicted_boxes, debug_dir / f"{sample['image_path'].stem}_sroie_eval.png")
        if index % 25 == 0 or index == len(samples):
            print(f"Processed {index}/{len(samples)} samples...")

    strict_wer, strict_cer = jiwer.wer(strict_refs, strict_hyps), jiwer.cer(strict_refs, strict_hyps)
    normalized_wer, normalized_cer = jiwer.wer(normalized_refs, normalized_hyps), jiwer.cer(normalized_refs, normalized_hyps)
    alignment = jiwer.process_words(normalized_refs, normalized_hyps)
    total_words = alignment.hits + alignment.substitutions + alignment.deletions
    word_accuracy = alignment.hits / total_words if total_words else 0.0
    char_accuracy = max(0.0, 1.0 - normalized_cer)
    
    elapsed = time.time() - start_time
    report = [
        "SROIE 2019 (ENGLISH GROCERY & RETAIL) OCR EVALUATION", "=" * 55,
        f"Total Samples Evaluated       : {len(samples)}",
        f"Image Source Folder           : {images_dir}",
        f"Box Annotation Folder         : {boxes_dir}",
        f"Total Execution Time          : {elapsed:.2f} seconds",
        "Production OCR Pipeline       : Active (PaddleOCR -> TokenCleaner)",
        "Perspective Correction        : Bypassed (Digital flatbed scans)",
        "",
        "--- TASK 1 & 2: OCR TEXT RECOGNITION METRICS ---",
        f"Strict Word Error Rate         : {strict_wer:.2%}",
        f"Strict Character Error Rate    : {strict_cer:.2%}",
        f"Normalized Word Error Rate     : {normalized_wer:.2%}",
        f"Normalized Character Error Rate: {normalized_cer:.2%}",
        f"OCR Word Accuracy (Normalized) : {word_accuracy:.2%}",
        f"OCR Character Accuracy (Norm)  : {char_accuracy:.2%}",
        ""
    ]
    
    report.append("--- TASK 1 & 2: BOUNDING BOX DETECTION METRICS ---")
    for threshold in thresholds:
        tp, fp, fn = counts[threshold]
        precision, recall, f1_score = metric_summary(tp, fp, fn)
        report.append(f"Detection @ IoU {threshold:.1f}           : precision={precision:.2%}, recall={recall:.2%}, F1={f1_score:.2%}")
    
    report.append("")
    report.append(f"Debug Overlays Saved To        : {debug_dir}")
    
    report_text = "\n".join(report)
    print("\n" + report_text)
    
    report_file = evaluation_dir / "sroie_evaluation_report.txt"
    report_file.write_text(report_text + "\n", encoding="utf-8")
    print(f"\n[SUCCESS] SROIE OCR evaluation report saved separately to: {report_file}")


import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate exact production OCR path on SROIE 2019 English dataset (no semantic evaluation).")
    parser.add_argument("--limit", type=int, default=None, help="Evaluate only the first N matching receipt pairs.")
    parser.add_argument("--images_dir", type=str, default=str(SROIE_IMAGES_DIR), help="Path to folder containing SROIE receipt images (.jpg).")
    parser.add_argument("--boxes_dir", type=str, default=str(SROIE_BOXES_DIR), help="Path to folder containing SROIE ground truth bounding boxes (.txt).")
    arguments = parser.parse_args()
    run_sroie_evaluation(
        images_dir=Path(arguments.images_dir),
        boxes_dir=Path(arguments.boxes_dir),
        sample_limit=arguments.limit
    )
