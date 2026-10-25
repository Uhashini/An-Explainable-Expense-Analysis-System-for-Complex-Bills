# Image Preprocessing

## Overview

The Image Preprocessing module enhances the visual quality of receipt images before they are passed to the geometric correction and OCR stages. In the current system, preprocessing is performed using **Contrast Limited Adaptive Histogram Equalization (CLAHE)** to improve image contrast while preserving important text details.

Receipt images captured using mobile devices often suffer from uneven illumination, shadows, and faded thermal printing, which can significantly reduce OCR accuracy. Applying CLAHE enhances the readability of the receipt text, resulting in more accurate text extraction.

---

## Objectives

The preprocessing module aims to:

- Improve local image contrast.
- Enhance faded receipt text.
- Reduce the effects of uneven lighting.
- Improve text visibility for OCR.

---

## Position in Pipeline

```
Input Image
      │
      ▼
Contrast Enhancement (CLAHE)
      │
      ▼
Geometric Correction
      │
      ▼
Denoise & Sharpen
      │
      ▼
OCR Engine
```

---

## Input

- OpenCV image (NumPy Array)

---

## Output

- Contrast-enhanced, geometrically corrected, and sharpened image suitable for OCR.

---

## Preprocessing Technique

### Contrast Limited Adaptive Histogram Equalization (CLAHE)

The proposed system applies Contrast Limited Adaptive Histogram Equalization (CLAHE) as the preprocessing technique.

Unlike conventional histogram equalization, which adjusts the contrast of the entire image, CLAHE divides the image into smaller regions called **tiles** and enhances the contrast of each tile independently. To prevent excessive amplification of noise, the contrast enhancement is limited using a predefined clip limit.

Since receipt images frequently contain faded text and inconsistent lighting conditions, CLAHE improves the visibility of printed characters without introducing significant image artifacts. This enhancement enables the OCR engine to detect text more accurately.

The implementation converts the input image from the BGR color space to the LAB color space, applies CLAHE only to the **L (Lightness)** channel, and then converts the enhanced image back to the BGR color space. Enhancing only the luminance component preserves the original color information while improving brightness and contrast.

Configuration used in the system:

| Parameter | Value |
|-----------|------:|
| Clip Limit | 3.0 |
| Tile Grid Size | 8 × 8 |

### Denoise & Sharpen

After geometric correction, the image undergoes a second preprocessing phase designed specifically to optimize character edges for the OCR engine:

1. **Non-Local Means Denoising**: Removes camera grain and background noise while preserving sharp text boundaries.
2. **Unsharp Masking**: A slightly blurred copy of the denoised image is mathematically subtracted from itself. This dramatically crisps up the edges of text characters, preventing the OCR engine from misinterpreting fuzzy borders.

This combination has been proven to significantly reduce the Character Error Rate (CER) during final text extraction.

---

## Processing Workflow

```
Input Image
      │
      ▼
Convert BGR → LAB
      │
      ▼
Apply CLAHE on L Channel
      │
      ▼
Merge LAB Channels
      │
      ▼
Convert LAB → BGR
      │
      ▼
Enhanced Image (Passed to Geometric Correction)
      │
      ▼
Geometric Correction
      │
      ▼
Denoise (Non-Local Means)
      │
      ▼
Sharpen (Unsharp Masking)
      │
      ▼
Final OCR Input
```

---

## Algorithm

1. Receive the input image in OpenCV format.
2. Convert the image from the BGR color space to the LAB color space.
3. Separate the Lightness (L), A, and B channels.
4. Apply CLAHE to the L channel using a clip limit of 3.0 and a tile grid size of 8 × 8.
5. Merge the enhanced L channel with the original A and B channels.
6. Convert the enhanced LAB image back to the BGR color space.
7. Perform Geometric Correction on the enhanced image.
8. Apply Non-Local Means Denoising to the corrected image.
9. Apply Unsharp Masking using a Gaussian Blur and weighted addition to crisp character edges.
10. Return the final preprocessed image for OCR extraction.

---

## Dependencies

| Library | Purpose |
|---------|---------|
| OpenCV (`cv2`) | Image color space conversion, CLAHE implementation, and image processing operations. |
| NumPy | Represents images as multidimensional arrays for processing. |
| Logging | Records processing information and errors during execution. |

---

## Mathematical Background

Contrast Limited Adaptive Histogram Equalization (CLAHE) is an extension of Adaptive Histogram Equalization that improves local image contrast while preventing excessive amplification of noise.

For an image with intensity values in the range \(0\) to \(L-1\), the probability of occurrence of an intensity level \(r_k\) is given by:

\[
p(r_k)=\frac{n_k}{N}
\]

where:

- \(n_k\) is the number of pixels having intensity \(r_k\),
- \(N\) is the total number of pixels.

The cumulative distribution function (CDF) is computed as:

\[
CDF(r_k)=\sum_{j=0}^{k}p(r_j)
\]

The enhanced pixel intensity is then obtained by:

\[
s_k=(L-1)\times CDF(r_k)
\]

Unlike standard histogram equalization, CLAHE performs this computation independently for each image tile and clips the histogram at a predefined threshold before redistribution. This prevents over-enhancement of noise while improving local contrast.

---

## Advantages

- Improves visibility of faded thermal receipt text.
- Enhances contrast under uneven lighting conditions.
- Preserves original color information by processing only the luminance channel.
- Improves OCR text recognition accuracy.

---

## Limitations

- Does not remove severe image blur.
- Cannot recover missing or damaged text.
- Enhancement quality depends on the original image resolution.