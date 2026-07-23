"""Evaluate the exact production OCR path against local image/JSON pairs."""

import json
import re
import string
from pathlib import Path

import cv2
import jiwer
import numpy as np

from app.services.ocr_service import ocr_service


# External CORD test set supplied for representative evaluation. It is read-only;
# reports and debug overlays continue to be written inside this repository.
CORD_IMAGES_DIR = Path(r"E:\6th sem\final yr project\CORD\test\image")
CORD_JSONS_DIR = Path(r"E:\6th sem\final yr project\CORD\test\json")


def normalize_text(text):
    """Create the secondary, formatting-tolerant text representation."""
    text = re.sub(r"(?<=\d)(?=[A-Za-z])|(?<=[A-Za-z])(?=\d)", " ", text)
    text = text.translate(str.maketrans("", "", string.punctuation))
    return " ".join(text.lower().split())


def box_iou(box_a, box_b):
    """Return IoU for [x1, y1, x2, y2] boxes in one coordinate system."""
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    intersection = max(0, min(ax2, bx2) - max(ax1, bx1)) * max(0, min(ay2, by2) - max(ay1, by1))
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - intersection
    return intersection / union if union else 0.0


def to_xyxy(points):
    """Convert a four-point quadrilateral to its enclosing axis-aligned box."""
    return [min(point[0] for point in points), min(point[1] for point in points),
            max(point[0] for point in points), max(point[1] for point in points)]


def sort_words(words):
    """Return word dictionaries in natural top-to-bottom, left-to-right order."""
    if not words:
        return []
    heights = [max(point[1] for point in word["points"]) - min(point[1] for point in word["points"]) for word in words]
    row_tolerance = max(8.0, float(np.median(heights)) * 0.6)
    rows = []
    for word in sorted(words, key=lambda item: sum(point[1] for point in item["points"]) / 4):
        center_y = sum(point[1] for point in word["points"]) / 4
        for row in rows:
            if abs(center_y - row["center_y"]) <= row_tolerance:
                row["words"].append(word)
                row["center_y"] = sum(sum(point[1] for point in item["points"]) / 4 for item in row["words"]) / len(row["words"])
                break
        else:
            rows.append({"center_y": center_y, "words": [word]})
    return [word for row in sorted(rows, key=lambda item: item["center_y"])
            for word in sorted(row["words"], key=lambda item: min(point[0] for point in item["points"]))]


def quad_to_points(quad):
    """Convert the local CORD-style named quadrilateral into four points."""
    return [[quad[f"x{index}"], quad[f"y{index}"]] for index in range(1, 5)]


def load_local_samples(images_dir=CORD_IMAGES_DIR, jsons_dir=CORD_JSONS_DIR):
    """Pair each CORD annotation with an image of the same filename stem."""
    samples = []
    for annotation_path in sorted(jsons_dir.glob("*.json")):
        image_path = next((images_dir / f"{annotation_path.stem}{suffix}" for suffix in (".png", ".jpg", ".jpeg")
                           if (images_dir / f"{annotation_path.stem}{suffix}").exists()), None)
        if image_path is None:
            print(f"Skipping {annotation_path.name}: matching image not found.")
            continue
        with annotation_path.open(encoding="utf-8") as annotation_file:
            annotation = json.load(annotation_file)
        words = []
        for line in annotation.get("valid_line", []):
            for word in line.get("words", []):
                if word.get("text") and word.get("quad"):
                    words.append({"text": word["text"], "points": quad_to_points(word["quad"])})
        samples.append({"image_path": image_path, "ground_truth_words": words})
    return samples


def production_geometry(image_bytes):
    """Reproduce production CLAHE/correction solely to map GT boxes for evaluation.

    The service itself remains the source of OCR results. This helper mirrors the
    corrector's contour decision in order to obtain the homography that its public
    method does not expose.
    """
    original = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    enhanced = ocr_service.preprocessor.apply_clahe(original)
    gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
    edged = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 75, 200)
    contours = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = contours[0] if len(contours) == 2 else contours[1]
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    for contour in contours:
        candidate = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(candidate) == 4 and cv2.contourArea(candidate) > 0.3 * enhanced.shape[0] * enhanced.shape[1]:
            rect = ocr_service.corrector.order_points(candidate.reshape(4, 2))
            tl, tr, br, bl = rect
            width = max(int(np.linalg.norm(br - bl)), int(np.linalg.norm(tr - tl)))
            height = max(int(np.linalg.norm(tr - br)), int(np.linalg.norm(tl - bl)))
            destination = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32")
            matrix = cv2.getPerspectiveTransform(rect, destination)
            return cv2.warpPerspective(enhanced, matrix, (width, height)), matrix
    return enhanced, None


def transform_points(points, matrix):
    """Move original-image annotations into the corrected-image coordinate system."""
    if matrix is None:
        return points
    return cv2.perspectiveTransform(np.asarray([points], dtype=np.float32), matrix)[0].tolist()


def match_detections(predicted_boxes, target_boxes, threshold):
    """Greedily apply one-to-one matching at the requested IoU threshold."""
    matched, true_positives = set(), 0
    for predicted in predicted_boxes:
        candidates = [(box_iou(predicted, target), index) for index, target in enumerate(target_boxes) if index not in matched]
        if candidates:
            iou, index = max(candidates)
            if iou >= threshold:
                matched.add(index)
                true_positives += 1
    return true_positives, len(predicted_boxes) - true_positives, len(target_boxes) - true_positives


def draw_debug_image(image, ground_truth_words, predicted_boxes, output_path):
    """Save a corrected-coordinate overlay: GT green, production OCR red."""
    debug_image = image.copy()
    for word in ground_truth_words:
        cv2.polylines(debug_image, [np.asarray(word["points"], dtype=np.int32)], True, (0, 255, 0), 2)
    for box in predicted_boxes:
        x1, y1, x2, y2 = map(int, box)
        cv2.rectangle(debug_image, (x1, y1), (x2, y2), (0, 0, 255), 2)
    cv2.imwrite(str(output_path), debug_image)


def metric_summary(tp, fp, fn):
    """Calculate precision, recall and F1 from aggregate detection counts."""
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return precision, recall, 2 * precision * recall / (precision + recall) if precision + recall else 0.0


def run_evaluation(sample_limit=None):
    """Evaluate local data through the exact production extract_structured_data call."""
    evaluation_dir = Path(__file__).resolve().parent / "evaluation"
    debug_dir = evaluation_dir / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    samples = load_local_samples()
    if not samples:
        raise FileNotFoundError(f"No matching image/JSON pairs were found in {CORD_IMAGES_DIR} and {CORD_JSONS_DIR}.")

    if sample_limit is not None:
        samples = samples[:sample_limit]

    strict_refs, strict_hyps, normalized_refs, normalized_hyps = [], [], [], []
    thresholds = (0.5, 0.4, 0.3)
    confidence_scores = []
    counts = {threshold: [0, 0, 0] for threshold in thresholds}
    legacy_counts = {threshold: [0, 0, 0] for threshold in thresholds}
    correction_count = 0
    for index, sample in enumerate(samples, start=1):
        image_bytes = sample["image_path"].read_bytes()

        # This is the production call: CLAHE -> perspective correction -> OCR -> LayoutLM.
        production_output = ocr_service.extract_structured_data(image_bytes)
        data = production_output["data"]

        # Recreate the same geometry only to transform GT annotations and render debug images.
        corrected_image, matrix = production_geometry(image_bytes)
        correction_count += matrix is not None
        corrected_h, corrected_w = corrected_image.shape[:2]
        ground_truth_words = sort_words([
            {"text": word["text"], "points": transform_points(word["points"], matrix)}
            for word in sample["ground_truth_words"]
        ])

        # The service returns LayoutLM-normalized boxes. Convert them back using
        # corrected dimensions, which is mathematically correct after correction.
        predicted_words = sort_words([
            {"text": text, "points": [
                [box[0] * corrected_w / 1000, box[1] * corrected_h / 1000],
                [box[2] * corrected_w / 1000, box[1] * corrected_h / 1000],
                [box[2] * corrected_w / 1000, box[3] * corrected_h / 1000],
                [box[0] * corrected_w / 1000, box[3] * corrected_h / 1000]
            ]}
            for text, box in zip(data["words"], data["boxes"])
        ])
        reference = " ".join(word["text"] for word in ground_truth_words)
        hypothesis = " ".join(word["text"] for word in predicted_words)
        strict_refs.append(reference)
        strict_hyps.append(hypothesis)
        normalized_refs.append(normalize_text(reference))
        normalized_hyps.append(normalize_text(hypothesis))

        target_boxes = [to_xyxy(word["points"]) for word in ground_truth_words]
        predicted_boxes = [to_xyxy(word["points"]) for word in predicted_words]
        for threshold, totals in counts.items():
            tp, fp, fn = match_detections(predicted_boxes, target_boxes, threshold)
            totals[0] += tp
            totals[1] += fp
            totals[2] += fn

        # Simulate the historical bug for an apples-to-apples before/after
        # report: prior code treated coordinates from a 2x OCR image as though
        # they belonged to the unscaled corrected image, then clipped at 1000.
        resize_scale = 2.0 if max(corrected_h, corrected_w) < 1500 else 1.0
        legacy_boxes = [
            [min(corrected_w, box[0] * resize_scale), min(corrected_h, box[1] * resize_scale),
             min(corrected_w, box[2] * resize_scale), min(corrected_h, box[3] * resize_scale)]
            for box in predicted_boxes
        ]
        for threshold, totals in legacy_counts.items():
            tp, fp, fn = match_detections(legacy_boxes, target_boxes, threshold)
            totals[0] += tp
            totals[1] += fp
            totals[2] += fn
        draw_debug_image(corrected_image, ground_truth_words, predicted_boxes, debug_dir / f"{sample['image_path'].stem}_debug.png")

        # Confidence is collected on the same corrected image that production OCR receives.
        confidence_scores.extend(item["confidence"] for item in ocr_service.ocr.extract_text(corrected_image))
        print(f"Sample {index}/{len(samples)} processed: {sample['image_path'].name}")

    strict_wer, strict_cer = jiwer.wer(strict_refs, strict_hyps), jiwer.cer(strict_refs, strict_hyps)
    normalized_wer, normalized_cer = jiwer.wer(normalized_refs, normalized_hyps), jiwer.cer(normalized_refs, normalized_hyps)
    alignment = jiwer.process_words(normalized_refs, normalized_hyps)
    total_words = alignment.hits + alignment.substitutions + alignment.deletions
    accuracy = alignment.hits / total_words if total_words else 0.0
    report = [
        "OCR EVALUATION RESULTS", "-" * 40,
        f"Total Samples                 : {len(samples)}",
        f"Evaluation images             : {CORD_IMAGES_DIR}",
        f"Evaluation annotations        : {CORD_JSONS_DIR}",
        "Production pipeline evaluated : yes (CLAHE -> perspective correction -> PaddleOCR -> LayoutLMv3)",
        f"Perspective correction applied: {correction_count}/{len(samples)} images",
        f"Strict Word Error Rate         : {strict_wer:.2%}",
        f"Strict Character Error Rate    : {strict_cer:.2%}",
        f"Normalized Word Error Rate     : {normalized_wer:.2%}",
        f"Normalized Character Error Rate: {normalized_cer:.2%}",
        f"OCR Accuracy (normalized)     : {accuracy:.2%}",
    ]
    for threshold, (tp, fp, fn) in counts.items():
        precision, recall, f1_score = metric_summary(tp, fp, fn)
        report.append(f"Detection @ IoU {threshold:.1f}           : precision={precision:.2%}, recall={recall:.2%}, F1={f1_score:.2%}")
    legacy_precision, legacy_recall, legacy_f1 = metric_summary(*legacy_counts[0.5])
    current_precision, current_recall, current_f1 = metric_summary(*counts[0.5])
    report.extend([
        "Coordinate-scaling comparison (@ IoU 0.5):",
        f"  Before (simulated 2x-coordinate bug): precision={legacy_precision:.2%}, recall={legacy_recall:.2%}, F1={legacy_f1:.2%}",
        f"  After  (scaled back before normalization): precision={current_precision:.2%}, recall={current_recall:.2%}, F1={current_f1:.2%}",
    ])
    report.append(f"Average Confidence            : {sum(confidence_scores) / len(confidence_scores):.3f}" if confidence_scores else "Average Confidence            : unavailable")
    report.append(f"Debug overlays                : {debug_dir}")
    report_text = "\n".join(report)
    print("\n" + report_text)
    (evaluation_dir / "evaluation_report.txt").write_text(report_text + "\n", encoding="utf-8")


import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate exact production OCR path.")
    parser.add_argument("--limit", type=int, default=None, help="Evaluate only the first N matching receipt pairs.")
    arguments = parser.parse_args()
    run_evaluation(sample_limit=arguments.limit)
