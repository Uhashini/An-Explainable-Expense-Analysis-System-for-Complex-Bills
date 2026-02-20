import pytesseract
from PIL import Image
import io

class OCRService:
    @staticmethod
    def extract_structured_data(image_bytes: bytes) -> dict:
        """
        Extracts words and their bounding boxes from image bytes using Tesseract OCR.
        Normalizes boxes to a 0-1000 scale for LayoutLMv3.
        """
        try:
            # Open the image using PIL
            image = Image.open(io.BytesIO(image_bytes))
            width, height = image.size
            
            # Use Tesseract to extract data as a DataFrame-compatible format
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            words = []
            boxes = []
            
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                # Skip empty text or very low confidence
                if int(float(data['conf'][i])) < 0 or not data['text'][i].strip():
                    continue
                
                word = data['text'][i]
                # Bounding box: [left, top, width, height]
                left = data['left'][i]
                top = data['top'][i]
                w = data['width'][i]
                h = data['height'][i]
                
                # Normalize to 0-1000 scale for LayoutLMv3
                # Format: [x1, y1, x2, y2]
                x1 = int(1000 * (left / width))
                y1 = int(1000 * (top / height))
                x2 = int(1000 * ((left + w) / width))
                y2 = int(1000 * ((top + h) / height))
                
                # Ensure values are within [0, 1000]
                x1 = max(0, min(1000, x1))
                y1 = max(0, min(1000, y1))
                x2 = max(0, min(1000, x2))
                y2 = max(0, min(1000, y2))
                
                words.append(word)
                boxes.append([x1, y1, x2, y2])
            
            return {
                "words": words,
                "boxes": boxes,
                "image_size": {"width": width, "height": height}
            }
        except Exception as e:
            raise Exception(f"Structured OCR extraction failed: {str(e)}")

# Create a singleton instance
ocr_service = OCRService()
