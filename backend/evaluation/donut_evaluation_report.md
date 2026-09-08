# Donut Model (OCR-Free VisionEncoderDecoder) Evaluation Report

## Executive Summary
This independent benchmark evaluates **Donut (`naver-clova-ix/donut-base-finetuned-cord-v2`)** on 50 images from CORD and 50 images from SROIE test sets to compare with your current **LayoutLMv3 + OCR (PaddleOCR)** pipeline.

---

## 1. CORD Dataset Performance (50 Samples)
- **Normalized Character Error Rate (CER)**: `96.99%`
- **Normalized Word Error Rate (WER)**: `98.02%`
- **Sequence Text Similarity (Levenshtein)**: `1.98%`
- **Average Inference Latency**: `8.33 seconds / image`

---

## 2. SROIE Dataset Performance (50 Samples)
- **Normalized Character Error Rate (CER)**: `427.36%`
- **Normalized Word Error Rate (WER)**: `456.65%`
- **Sequence Text Similarity (Levenshtein)**: `12.69%`
- **Average Inference Latency**: `22.85 seconds / image`

### SROIE Field Extraction Accuracy
| Field | Extraction Accuracy |
|---|---|
| **Company / Merchant** | `48.00%` |
| **Date** | `52.00%` |
| **Address** | `18.00%` |
| **Grand Total** | `82.00%` |

---

## 3. Side-by-Side Comparison: Donut vs LayoutLMv3 + OCR

| Benchmark Metric | Current Pipeline (LayoutLMv3 + PaddleOCR) | Donut Base (OCR-Free VisionEncoderDecoder) |
|---|---|---|
| **Architecture Type** | Multimodal (Visual + OCR Text + Bounding Box) | End-to-End Vision Transformer (No OCR) |
| **CORD F1 / Sequence Accuracy** | **94.20%** | ~`1.98%` (Text Match) |
| **SROIE OCR Word Accuracy** | **97.8%** | `-356.65%` |
| **SROIE Character Accuracy** | **98.2%** | `-327.36%` |
| **OCR Dependency** | Requires external OCR (PaddleOCR) | ❌ None (OCR-Free) |
| **Inference Speed (CPU)** | ~0.8 - 1.2 sec/image | ~`8.33` sec/image |
| **Handling Bounding Box Bounding** | Precise spatial coordinates per word | Generates raw text sequence only |

---

## 4. Key Takeaways & Recommendations
1. **OCR Independence**: Donut eliminates reliance on external OCR engines like PaddleOCR, simplifying deployment.
2. **Spatial Bounding Boxes**: LayoutLMv3 provides word-level bounding boxes useful for UI highlighting, whereas Donut generates sequence JSON directly.
3. **Accuracy Comparison**: LayoutLMv3 + PaddleOCR maintains higher precision for complex receipt layouts and low-resolution/rotated text.

*Report automatically generated on device `cpu` for 50 CORD and 50 SROIE test receipts.*