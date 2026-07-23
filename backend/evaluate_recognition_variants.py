"""Evaluate recognition-only improvements without changing production inference."""

import argparse
from pathlib import Path

import cv2
import jiwer
import numpy as np

from app.services.ocr_service import ocr_service
from evaluate_ocr import (
    load_local_samples,
    match_detections,
    metric_summary,
    normalize_text,
    production_geometry,
    sort_words,
    to_xyxy,
    transform_points,
)


def denoise_and_sharpen(image):
    """Apply one conservative denoise + unsharp-mask experiment to OCR input."""
    denoised = cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)
    blurred = cv2.GaussianBlur(denoised, (0, 0), 1.0)
    return cv2.addWeighted(denoised, 1.25, blurred, -0.25, 0)


def load_receipt_lexicon(evaluation_dir):
    """Load an optional user-maintained lexicon; never derive it from GT labels."""
    lexicon_path = evaluation_dir / "receipt_lexicon.txt"
    if not lexicon_path.exists():
        return []
    return [line.strip() for line in lexicon_path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")]


def correct_low_confidence_words(ocr_results, lexicon, confidence_threshold=0.80):
    """Safely correct only low-confidence alphabetic tokens with a close lexicon match."""
    if not lexicon:
        return ocr_results
    corrected = []
    for result in ocr_results:
        replacement = result["text"]
        if result["confidence"] < confidence_threshold and result["text"].isalpha():
            candidates = [word for word in lexicon if word.lower() != result["text"].lower()]
            if candidates:
                # A single edit protects valid product names from broad rewriting.
                import difflib
                match = difflib.get_close_matches(result["text"], candidates, n=1, cutoff=0.85)
                if match:
                    replacement = match[0]
        corrected.append({**result, "text": replacement})
    return corrected


def words_from_production_output(data, width, height):
    """Convert production's 0-1000 LayoutLM boxes back to corrected-image points."""
    return sort_words([
        {"text": text, "points": [
            [box[0] * width / 1000, box[1] * height / 1000],
            [box[2] * width / 1000, box[1] * height / 1000],
            [box[2] * width / 1000, box[3] * height / 1000],
            [box[0] * width / 1000, box[3] * height / 1000]
        ]}
        for text, box in zip(data["words"], data["boxes"])
    ])


def words_from_ocr_results(results):
    """Preserve spaces by sorting detected words before joining their text."""
    return sort_words([{"text": result["text"], "points": result["bbox"]} for result in results])


def score_variant(references, hypotheses):
    """Calculate strict and normalized recognition metrics for one variant."""
    normalized_references = [normalize_text(text) for text in references]
    normalized_hypotheses = [normalize_text(text) for text in hypotheses]
    alignment = jiwer.process_words(normalized_references, normalized_hypotheses)
    total_words = alignment.hits + alignment.substitutions + alignment.deletions
    return {
        "strict_wer": jiwer.wer(references, hypotheses),
        "strict_cer": jiwer.cer(references, hypotheses),
        "normalized_wer": jiwer.wer(normalized_references, normalized_hypotheses),
        "normalized_cer": jiwer.cer(normalized_references, normalized_hypotheses),
        "accuracy": alignment.hits / total_words if total_words else 0.0,
    }


def run_experiments(sample_limit=None):
    """Compare controlled recognition experiments; production code is never changed."""
    evaluation_dir = Path(__file__).resolve().parent / "evaluation"
    samples, lexicon = load_local_samples(), load_receipt_lexicon(evaluation_dir)
    if not samples:
        raise FileNotFoundError("No matching CORD test image/JSON pairs found.")
    if sample_limit is not None:
        samples = samples[:sample_limit]

    references = []
    hypotheses = {"production baseline": [], "denoise + sharpen": [], "denoise + sharpen + lexicon": []}
    detection_counts = {name: [0, 0, 0] for name in hypotheses}
    for sample in samples:
        image_bytes = sample["image_path"].read_bytes()
        # Baseline is the unmodified production call.
        production_data = ocr_service.extract_structured_data(image_bytes)["data"]
        corrected_image, matrix = production_geometry(image_bytes)
        height, width = corrected_image.shape[:2]
        ground_truth = sort_words([
            {"text": word["text"], "points": transform_points(word["points"], matrix)}
            for word in sample["ground_truth_words"]
        ])
        references.append(" ".join(word["text"] for word in ground_truth))
        target_boxes = [to_xyxy(word["points"]) for word in ground_truth]
        baseline_words = words_from_production_output(production_data, width, height)
        hypotheses["production baseline"].append(" ".join(word["text"] for word in baseline_words))
        tp, fp, fn = match_detections([to_xyxy(word["points"]) for word in baseline_words], target_boxes, 0.5)
        detection_counts["production baseline"] = [
            detection_counts["production baseline"][0] + tp,
            detection_counts["production baseline"][1] + fp,
            detection_counts["production baseline"][2] + fn,
        ]

        # Experiments use the same corrected production image, changing only the
        # temporary OCR input. They never modify OCRService or runtime behavior.
        variant_results = ocr_service.ocr.extract_text(denoise_and_sharpen(corrected_image))
        variant_words = words_from_ocr_results(variant_results)
        hypotheses["denoise + sharpen"].append(" ".join(word["text"] for word in variant_words))
        tp, fp, fn = match_detections([to_xyxy(word["points"]) for word in variant_words], target_boxes, 0.5)
        detection_counts["denoise + sharpen"] = [
            detection_counts["denoise + sharpen"][0] + tp,
            detection_counts["denoise + sharpen"][1] + fp,
            detection_counts["denoise + sharpen"][2] + fn,
        ]
        corrected_results = correct_low_confidence_words(variant_results, lexicon)
        corrected_words = words_from_ocr_results(corrected_results)
        hypotheses["denoise + sharpen + lexicon"].append(" ".join(word["text"] for word in corrected_words))
        tp, fp, fn = match_detections([to_xyxy(word["points"]) for word in corrected_words], target_boxes, 0.5)
        detection_counts["denoise + sharpen + lexicon"] = [
            detection_counts["denoise + sharpen + lexicon"][0] + tp,
            detection_counts["denoise + sharpen + lexicon"][1] + fp,
            detection_counts["denoise + sharpen + lexicon"][2] + fn,
        ]

    report = ["RECOGNITION EXPERIMENT RESULTS", "-" * 40, f"Samples: {len(samples)}"]
    baseline_metrics = None
    for name, predictions in hypotheses.items():
        metrics = score_variant(references, predictions)
        if baseline_metrics is None:
            baseline_metrics = metrics
        report.extend([
            f"\n{name}",
            f"  Normalized CER: {metrics['normalized_cer']:.2%}",
            f"  Normalized accuracy: {metrics['accuracy']:.2%}",
            f"  CER change vs baseline: {metrics['normalized_cer'] - baseline_metrics['normalized_cer']:+.2%}",
        ])
        precision, recall, f1_score = metric_summary(*detection_counts[name])
        report.append(f"  Detection @ IoU 0.5: precision={precision:.2%}, recall={recall:.2%}, F1={f1_score:.2%}")
        report.append(f"  Normalized WER: {metrics['normalized_wer']:.2%}")
    report.append("\nAdopt a variant only if normalized CER improves consistently on a larger held-out set.")
    report_text = "\n".join(report)
    print(report_text)
    (evaluation_dir / "recognition_experiment_report.txt").write_text(report_text + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compare OCR recognition variants on local CORD pairs.")
    parser.add_argument("--limit", type=int, default=None, help="Evaluate only the first N matching receipt pairs.")
    arguments = parser.parse_args()
    run_experiments(sample_limit=arguments.limit)
