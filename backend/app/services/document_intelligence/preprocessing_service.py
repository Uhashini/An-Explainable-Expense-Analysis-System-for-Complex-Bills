import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)

class PreprocessingService:
    """
    Production-grade preprocessing engine for diverse receipt qualities.
    Includes adaptive contrast enhancement, noise reduction, and binarization.
    """
    
    @staticmethod
    def apply_clahe(image: np.ndarray) -> np.ndarray:
        """
        Apply Contrast Limited Adaptive Histogram Equalization (CLAHE).
        Effective for thermal faded receipts and uneven lighting.
        """
        if len(image.shape) == 3:
            # Convert to LAB color space to enhance L channel
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
            return enhanced
        else:
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            return clahe.apply(image)

    @staticmethod
    def reduce_noise(image: np.ndarray) -> np.ndarray:
        """
        Apply Non-Local Means Denoising to preserve edge details.
        Crucial for low-quality/blurry receipt images.
        """
        if len(image.shape) == 3:
            return cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
        return cv2.fastNlMeansDenoising(image, None, 10, 7, 21)

    @staticmethod
    def denoise_and_sharpen(image: np.ndarray) -> np.ndarray:
        """
        Apply conservative denoise + unsharp-mask to OCR input.
        Proven to significantly reduce Character Error Rate.
        """
        if len(image.shape) == 3:
            denoised = cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)
        else:
            denoised = cv2.fastNlMeansDenoising(image, None, 5, 7, 21)
        blurred = cv2.GaussianBlur(denoised, (0, 0), 1.0)
        return cv2.addWeighted(denoised, 1.25, blurred, -0.25, 0)


    @staticmethod
    def binarize(image: np.ndarray) -> np.ndarray:
        """
        Convert to grayscale and apply adaptive thresholding.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        return cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )

    def process_for_ocr(self, image_path: str) -> np.ndarray:
        """
        Full pipeline for general receipt images.
        """
        img = cv2.imread(image_path)
        if img is None:
            raise FileNotFoundError(f"Image not found at {image_path}")

        # 1. Denoise
        denoised = self.reduce_noise(img)
        
        # 2. Enhance Contrast
        enhanced = self.apply_clahe(denoised)
        
        # 3. Grayscale/Binarize for specific OCR engines if needed
        # (Note: Modern OCR like PaddleOCR often performs better on colored/enhanced images)
        
        return enhanced
