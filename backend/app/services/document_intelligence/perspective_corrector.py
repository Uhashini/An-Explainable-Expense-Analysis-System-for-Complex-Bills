import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

class PerspectiveCorrector:
    """
    Module to handle skewed, rotated and perspective-distorted receipts.
    Uses edge detection and four-point transformation.
    """

    def order_points(self, pts):
        """
        Orders coordinates as (top-left, top-right, bottom-right, bottom-left).
        """
        rect = np.zeros((4, 2), dtype="float32")
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]
        
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]
        rect[3] = pts[np.argmax(diff)]
        return rect

    def four_point_transform(self, image, pts):
        """
        Applies perspective warp to get a top-down view.
        """
        rect = self.order_points(pts)
        (tl, tr, br, bl) = rect

        # Compute width of new image
        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))

        # Compute height of new image
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

    def detect_and_correct(self, image: np.ndarray) -> np.ndarray:
        """
        Detects receipt contours and attempts perspective correction.
        """
        # 1. Edge detection
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 75, 200)

        # 2. Find contours
        cnts = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:5]

        screenCnt = None
        for c in cnts:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                screenCnt = approx
                break

        if screenCnt is not None:
            # Check if the detected contour is large enough to be the actual receipt page.
            # Accidental small contours will be rejected to avoid warping errors.
            h, w = image.shape[:2]
            img_area = h * w
            contour_area = cv2.contourArea(screenCnt)
            
            if contour_area > 0.3 * img_area:
                logger.info(f"Applying perspective correction for contour area: {contour_area:.0f} px ({contour_area/img_area:.1%})")
                return self.four_point_transform(image, screenCnt.reshape(4, 2))
            else:
                logger.info(f"Skipping perspective correction. Detected contour area too small: {contour_area:.0f} px ({contour_area/img_area:.1%})")
        
        # Fallback: return original if no valid contour found
        return image
