import pytesseract
from PIL import Image
import io
import cv2
import numpy as np

class OCRService:
    @staticmethod
    def _correct_skew(image: np.ndarray) -> np.ndarray:
        """
        Detects and corrects the tilt/skew of the text in the image.
        """
        # Edge Detection
        edges = cv2.Canny(image, 50, 150, apertureSize=3)
        
        # Hough Line Transform to find lines
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
        
        if lines is not None:
            angles = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
                # Only consider near-horizontal lines
                if -45 < angle < 45:
                    angles.append(angle)
            
            if angles:
                median_angle = np.median(angles)
                # Rotate the image to correct the tilt
                (h, w) = image.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
                image = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return image

    @staticmethod
    def _correct_perspective(image: np.ndarray) -> np.ndarray:
        """
        Detects the document (receipt) contour and warps perspective to a flat view.
        Highly useful for camera-captured photos.
        """
        # Find contours
        # We use a copy to preserve the original for warping
        orig_h, orig_w = image.shape[:2]
        
        # Blur and detect edges
        blurred = cv2.GaussianBlur(image, (5, 5), 0)
        edged = cv2.Canny(blurred, 75, 200)
        
        # Find contours and keep the largest ones
        cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:5]
        
        for c in cnts:
            # Approximate the contour
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            
            # If our approximated contour has four points, we assume we have found the receipt
            if len(approx) == 4:
                # Prepare points for perspective transform
                pts = approx.reshape(4, 2)
                
                # Sort points: [top-left, top-right, bottom-right, bottom-left]
                rect = np.zeros((4, 2), dtype="float32")
                s = pts.sum(axis=1)
                rect[0] = pts[np.argmin(s)]
                rect[2] = pts[np.argmax(s)]
                diff = np.diff(pts, axis=1)
                rect[1] = pts[np.argmin(diff)]
                rect[3] = pts[np.argmax(diff)]
                
                (tl, tr, br, bl) = rect
                
                # Compute width and height of the new image
                widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
                widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
                maxWidth = max(int(widthA), int(widthB))
                
                heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
                heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
                maxHeight = max(int(heightA), int(heightB))
                
                dst = np.array([
                    [0, 0],
                    [maxWidth - 1, 0],
                    [maxWidth - 1, maxHeight - 1],
                    [0, maxHeight - 1]], dtype="float32")
                
                M = cv2.getPerspectiveTransform(rect, dst)
                warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
                return warped
                
        return image

    @staticmethod
    def _morphological_cleanup(image: np.ndarray) -> np.ndarray:
        """
        Uses Opening (noise removal) and Closing (gap filling) to refine text structure.
        """
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        
        # Closing: Dilation followed by Erosion. Fills small holes/gaps in characters.
        image = cv2.morphologyEx(image, cv2.MORPH_CLOSE, kernel)
        
        # Opening: Erosion followed by Dilation. Removes small "salt" noise.
        image = cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)
        
        return image

    @staticmethod
    def _sharpen_image(image: np.ndarray) -> np.ndarray:
        """
        Applies Unsharp Masking to enhance character edges.
        """
        # Create a blurred version of the image
        blurred = cv2.GaussianBlur(image, (0, 0), 3)
        # Add the weighted blur subtracted from original to the original
        sharpened = cv2.addWeighted(image, 1.5, blurred, -0.5, 0)
        return sharpened

    @staticmethod
    def _preprocess_image(image: Image.Image) -> np.ndarray:
        """
        Professional OCR Preprocessing Pipeline (Phase 4):
        1. Perspective correction (Warping)
        2. Denoising (NLM)
        3. Contrast enhancement (CLAHE)
        4. Sharpening (Unsharp masking)
        5. Deskewing (Tilt correction)
        6. Morphological cleanup
        7. Binarization (Otsu)
        """
        # Convert PIL to BGR
        img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # 1. Perspective Correction (if document contour found)
        # Needs grayscale input for edge detection internally, but we use it on BGR
        gray_temp = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        img = OCRService._correct_perspective(img) # Perspective warp usually stays in color if possible
        
        # 2. Rescaling to 300 DPI equivalent
        h, w = img.shape[:2]
        if h < 1200 or w < 1200:
            scale = 1500 / max(h, w)
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        
        # 3. Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 4. Professional Denoising
        gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        
        # 5. Contrast Enhancement (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        
        # 6. Sharpening
        gray = OCRService._sharpen_image(gray)
        
        # 7. Deskewing
        gray = OCRService._correct_skew(gray)
        
        # 8. Binarization (Otsu)
        binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        
        # 9. Morphological Cleanup
        processed_img = OCRService._morphological_cleanup(binary)
        
        return processed_img

    @staticmethod
    def extract_structured_data(image_bytes: bytes) -> dict:
        """
        Extracts words and their bounding boxes from image bytes using Tesseract OCR.
        Normalizes boxes to a 0-1000 scale for LayoutLMv3.
        """
        try:
            # Open the image using PIL
            image = Image.open(io.BytesIO(image_bytes))
            
            # Ensure image is in RGB for preprocessing
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            width, height = image.size
            
            # Preprocess the image
            processed_img = OCRService._preprocess_image(image)
            
            # Use Tesseract with custom config
            # --psm 6: Assume a single uniform block of text.
            # --oem 3: Default OCR engine (LSTM).
            custom_config = r'--oem 3 --psm 6'
            data = pytesseract.image_to_data(processed_img, output_type=pytesseract.Output.DICT, config=custom_config)
            
            words = []
            boxes = []
            
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                # Skip low confidence or empty text
                # -1 confidence often indicates metadata/blocks
                conf = int(float(data['conf'][i]))
                text = data['text'][i].strip()
                
                if conf < 10 or not text:
                    continue
                
                # Bounding box: [left, top, width, height]
                left = data['left'][i]
                top = data['top'][i]
                w = data['width'][i]
                h = data['height'][i]
                
                # Normalize to 0-1000 scale for LayoutLMv3
                x1 = int(1000 * (left / width))
                y1 = int(1000 * (top / height))
                x2 = int(1000 * ((left + w) / width))
                y2 = int(1000 * ((top + h) / height))
                
                # Bounds checking
                x1 = max(0, min(1000, x1))
                y1 = max(0, min(1000, y1))
                x2 = max(0, min(1000, x2))
                y2 = max(0, min(1000, y2))
                
                words.append(text)
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
