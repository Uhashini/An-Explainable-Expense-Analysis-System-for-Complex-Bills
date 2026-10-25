# Geometric Correction

## Overview

The Geometric Correction module removes perspective distortion and skew from receipt images before OCR processing.

Receipts captured using mobile cameras are often photographed at an angle, resulting in trapezoidal distortion. Such distortions negatively impact OCR accuracy because text lines become non-horizontal and character shapes are deformed.

This module detects the receipt boundary and transforms the image into a top-down view using perspective transformation.

---

## Objectives

- Detect receipt boundaries.
- Correct perspective distortion.
- Correct skew.
- Improve OCR readability.

---

## Position in Pipeline

```
Image Preprocessing
        │
        ▼
Geometric Correction
        │
        ▼
OCR
```

---

## Input

Enhanced OpenCV image.

---

## Output

Perspective-corrected receipt image.

---
## Dependencies

The Geometric Correction module is implemented using the following libraries:

| Library | Purpose |
|---------|---------|
| OpenCV (`cv2`) | Performs image processing operations including grayscale conversion, Gaussian blurring, edge detection, contour detection, polygon approximation, and perspective transformation. |
| NumPy | Handles matrix operations, coordinate manipulation, and distance calculations required for perspective correction. |
| Logging | Records processing information and fallback conditions during execution. |

---

## Mathematical Background

### Euclidean Distance

To determine the dimensions of the corrected receipt image, the distances between the detected corner points are computed using the Euclidean distance formula.

\[
d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}
\]

The maximum width and height calculated from the opposing edges are used as the dimensions of the transformed image.

---

### Polygon Approximation

After detecting contours, each contour is approximated using the Douglas–Peucker algorithm implemented through OpenCV's `approxPolyDP()` function.

The approximation tolerance is defined as:

\[
\varepsilon = 0.02 \times P
\]

where:

- \(P\) is the contour perimeter.
- \(\varepsilon\) controls the approximation accuracy.

Contours approximated to four vertices are considered potential receipt boundaries.

---

### Perspective Transformation

Once the four corner points are identified, a perspective transformation matrix is computed to map the detected receipt corners to a rectangular plane.

The transformation is represented by a homography matrix:

\[
\begin{bmatrix}
x'\\
y'\\
w'
\end{bmatrix}
=
H
\begin{bmatrix}
x\\
y\\
1
\end{bmatrix}
\]

where:

- \(H\) is the \(3 \times 3\) perspective transformation matrix.
- \((x,y)\) are the original image coordinates.
- \((x',y')\) are the transformed coordinates.

The final coordinates are obtained by normalizing with the homogeneous coordinate:

\[
X=\frac{x'}{w'}, \qquad
Y=\frac{y'}{w'}
\]

This transformation removes perspective distortion and generates a top-down view of the receipt suitable for OCR.

---

## Processing Steps

### 1. Grayscale Conversion

The enhanced receipt image is converted from the BGR color space to grayscale to simplify subsequent edge detection operations.

---

### 2. Gaussian Blur

A Gaussian filter with a kernel size of **5 × 5** is applied to suppress high-frequency noise and smooth the image before edge detection.

---

### 3. Canny Edge Detection

The Canny edge detector identifies significant intensity gradients corresponding to the boundaries of the receipt.

Configuration used in the system:

| Parameter | Value |
|-----------|------:|
| Lower Threshold | 75 |
| Upper Threshold | 200 |

---

### 4. Contour Detection

All contours are extracted using OpenCV's contour detection algorithm (`RETR_LIST`). The detected contours are sorted according to their area, and only the five largest contours are retained for further analysis.

---

### 5. Polygon Approximation and Receipt Detection

Each candidate contour is approximated using the Douglas–Peucker algorithm. The first contour consisting of four vertices is selected as the potential receipt boundary.

---

### 6. Area Validation

To avoid false detections, the identified quadrilateral must occupy at least **30% of the total image area**. Smaller contours are rejected, and perspective correction is skipped.

---

### 7. Corner Point Ordering

The four detected vertices are ordered into a consistent sequence:

- Top Left
- Top Right
- Bottom Right
- Bottom Left

Consistent ordering is essential for correctly computing the perspective transformation matrix.

---

### 8. Perspective Transformation

The ordered corner points are mapped to the corners of a rectangular image using OpenCV's `getPerspectiveTransform()` function.

The resulting transformation matrix is then applied using `warpPerspective()` to generate a top-down view of the receipt.

---

## Processing Workflow

```
Input Image
      │
      ▼
Grayscale Conversion
      │
      ▼
Gaussian Blur
      │
      ▼
Canny Edge Detection
      │
      ▼
Contour Detection
      │
      ▼
Polygon Approximation
      │
      ▼
Area Validation
      │
      ▼
Corner Point Ordering
      │
      ▼
Perspective Transformation
      │
      ▼
Corrected Receipt Image
```

---

## Algorithm

1. Receive the enhanced receipt image.
2. Convert the image to grayscale.
3. Apply Gaussian blur to suppress noise.
4. Detect edges using the Canny edge detector.
5. Extract all contours and sort them by area.
6. Approximate each contour using the Douglas–Peucker algorithm.
7. Select the first contour with four vertices.
8. Validate that the detected contour occupies at least 30% of the image area.
9. Order the corner points into a consistent sequence.
10. Compute the perspective transformation matrix.
11. Apply perspective warping to obtain a top-down view.
12. Return the corrected image. If no valid receipt contour is detected, return the original image.

---

## Advantages

- Corrects perspective distortion caused by angled image capture.
- Produces a top-down view that improves OCR accuracy.
- Rejects small or incorrect contours using area validation.
- Automatically handles moderately rotated receipts.
- Preserves the geometric structure of the receipt for subsequent text extraction.

---

## Limitations

- Requires a clearly visible receipt boundary.
- May fail when the receipt is heavily occluded or folded.
- Perspective correction is skipped if no valid quadrilateral satisfying the area threshold is detected.
- Extremely blurred or low-contrast images may reduce contour detection accuracy.