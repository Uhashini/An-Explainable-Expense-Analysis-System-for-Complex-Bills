# LayoutLMv3 Input Preparation

## Overview

The LayoutLMv3 Input Preparation module transforms the raw OCR output into the format required by the LayoutLMv3 model. Since LayoutLMv3 expects text tokens, normalized bounding boxes, and the corresponding document image as input, the OCR results undergo additional preprocessing before semantic classification.

OCR engines often merge adjacent words, numbers, or symbols into a single token. Such merged tokens do not match the tokenization format used during LayoutLMv3 training (CORD dataset). Therefore, this module separates merged tokens, updates their corresponding bounding boxes, and prepares the multimodal input for inference.

---

## Objectives

The input preparation module aims to:

- Normalize OCR tokens for LayoutLMv3.
- Split merged text and alphanumeric tokens.
- Preserve spatial alignment after token splitting.
- Prepare multimodal inputs for LayoutLMv3 inference.

---

## Position in Pipeline

```text
Perspective Corrected Image
            │
            ▼
        PaddleOCR
            │
            ▼
 OCR Output Formatting
            │
            ▼
LayoutLMv3 Input Preparation
            │
            ▼
       LayoutLMv3
```

---

## Input

- Perspective-corrected receipt image.
- OCR words extracted by PaddleOCR.
- Normalized bounding boxes (0–1000 coordinate system).

---

## Output

Prepared LayoutLMv3 inputs consisting of:

- Image
- Tokenized words
- Updated normalized bounding boxes

---

# Processing Steps

## 1. OCR Output Formatting

The OCR module returns each detected text region as a structured object containing:

- Recognized text
- Confidence score
- Bounding box coordinates

Only the recognized words and normalized bounding boxes are required for LayoutLMv3 inference.

---

## 2. Token Splitting

OCR engines occasionally merge multiple words or alphanumeric values into a single token.

Examples:

```
Qty1.00
```

↓

```
Qty
1.00
```

```
MILK 35.00
```

↓

```
MILK
35.00
```

The module separates:

- Words connected by spaces.
- Alphabetic prefixes followed by numeric suffixes.

This preprocessing aligns the tokenization with the format used during LayoutLMv3 training.

---

## 3. Bounding Box Redistribution

When a merged token is divided into multiple tokens, the original bounding box is also divided.

The width of the original bounding box is distributed proportionally according to the length of each generated token.

For example,

```
Original Token

Qty1.00

Bounding Box

────────────────────
```

becomes

```
Qty

────────

1.00

────────────
```

This preserves the spatial relationship between tokens and their locations in the document.

---

## 4. LayoutLMv3 Encoding

After token preparation, the image, processed words, and normalized bounding boxes are combined using the LayoutLMv3 processor.

The processor converts the multimodal inputs into tensors required by the neural network.

The prepared input consists of:

- Document image
- Text tokens
- Bounding boxes
- Attention masks
- Token IDs

These encoded tensors are then forwarded to the LayoutLMv3 model for semantic entity classification.

---

# Processing Workflow

```text
Perspective Corrected Image
            │
            ▼
PaddleOCR Results
            │
            ▼
Extract Words & Bounding Boxes
            │
            ▼
Split Merged Tokens
            │
            ▼
Redistribute Bounding Boxes
            │
            ▼
Generate LayoutLMv3 Encoding
            │
            ▼
Prepared Model Input
```

---

# Algorithm

1. Receive the OCR words and normalized bounding boxes.
2. Identify merged text and alphanumeric tokens.
3. Split merged tokens into individual words or values.
4. Estimate new bounding boxes for each generated token.
5. Preserve the normalized coordinate system.
6. Combine the image, processed tokens, and bounding boxes.
7. Encode the multimodal inputs using the LayoutLMv3 processor.
8. Return the prepared tensors for LayoutLMv3 inference.

---

# Dependencies

| Library | Purpose |
|---------|---------|
| Transformers (Hugging Face) | Provides the LayoutLMv3 processor for multimodal input encoding. |
| NumPy | Performs coordinate manipulation and array operations. |
| Regular Expressions (`re`) | Identifies merged alphanumeric tokens for splitting. |
| Logging | Records processing events and debugging information. |

---

# Mathematical Background

## Bounding Box Normalization

LayoutLMv3 requires bounding box coordinates to lie within a fixed range of **0–1000**.

For an image of width \(W\) and height \(H\), each bounding box coordinate is normalized as:

\[
x'=\frac{x}{W}\times1000
\]

\[
y'=\frac{y}{H}\times1000
\]

where:

- \(x,y\) are the original pixel coordinates.
- \(x',y'\) are the normalized coordinates used by LayoutLMv3.

---

## Bounding Box Redistribution

When a merged token is split into multiple tokens, the original bounding box width is divided proportionally according to the character length of each token.

If

- \(L_i\) is the number of characters in token \(i\),
- \(L_{total}\) is the total number of characters,

then the width allocated to token \(i\) is

\[
w_i=\frac{L_i}{L_{total}}\times W
\]

where:

- \(W\) is the width of the original bounding box.

This approximation preserves the relative spatial positions of the generated tokens.

## Domain-Specific Supermarket Token Splitting
In commercial supermarket environments, POS thermal receipt printers often operate with high character density and narrow font tracking. Consequently, raw OCR engines frequently extract multi-word produce item names or compound unit price ratings as singular merged tokens.

Our `TokenCleaner.split_and_clean_tokens()` layer injects domain-specific pattern boundaries prior to bounding box redistribution:
- **Produce Description Separation:** Automatically splits merged item designations such as `BRUSSELSPROUTS` $\rightarrow$ `["BRUSSEL", "SPROUTS"]`, `LETTUCEICEBERG` $\rightarrow$ `["LETTUCE", "ICEBERG"]`, `POTATOESBRUSHED` $\rightarrow$ `["POTATOES", "BRUSHED"]`, and `BANANACAVENDISH` $\rightarrow$ `["BANANA", "CAVENDISH"]`. Each sub-word receives a horizontally scaled bounding box $w_i \propto L_i$, ensuring accurate LayoutLMv3 positional representation.
- **Unit Pricing & Symbol Disambiguation:** Resolves optical symbols on scale labels, such as converting `NET0$2.99/kg` or `NETO$2.99/kg` into separate tokens `["NET", "@", "$2.99/kg"]`. This separation allows LayoutLMv3 to recognize `$2.99/kg` directly as `menu.unitprice` rather than misinterpreting the entire concatenated string as an inventory code (`menu.num`).

---

# Advantages

- Produces LayoutLMv3-compatible input.
- Aligns OCR tokens with the CORD dataset tokenization.
- Preserves document layout after token splitting.
- Maintains spatial consistency between text and bounding boxes.
- Improves semantic entity classification accuracy.

---

# Limitations

- Bounding box redistribution is an approximation based on character length.
- Incorrect OCR recognition may still propagate to LayoutLMv3.
- Extremely irregular token spacing may reduce alignment accuracy.

---

# Summary

The LayoutLMv3 Input Preparation module bridges the gap between OCR output and semantic document understanding. It restructures OCR tokens, redistributes their spatial coordinates, and encodes the document image, text, and layout information into the multimodal format required by LayoutLMv3. This preprocessing ensures that the model receives inputs consistent with its training data, thereby improving the accuracy of downstream entity classification.