from PIL import Image
from PIL.ExifTags import TAGS
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class InputClassifier:
    """
    Examines input metadata to categorize the source (Mobile Camera, Scanner, Screenshot).
    This helps in choosing the best preprocessing filters.
    """

    def extract_exif(self, image_path: str) -> Dict[str, Any]:
        """
        Extracts human-readable EXIF data from an image.
        """
        exif_data = {}
        try:
            with Image.open(image_path) as img:
                info = img._getexif()
                if info:
                    for tag, value in info.items():
                        decoded = TAGS.get(tag, tag)
                        exif_data[decoded] = value
        except Exception as e:
            logger.warning(f"Could not extract EXIF from {image_path}: {e}")
        
        return exif_data

    def classify_source(self, image_path: str) -> Dict[str, Any]:
        """
        Heuristic-based classification of the image source.
        """
        exif = self.extract_exif(image_path)
        
        # Default classification
        source = "unknown"
        confidence = 0.5
        
        # Logic for Camera
        if "Make" in exif or "Model" in exif:
            source = "camera"
            confidence = 0.9
        
        # Logic for Screenshot (often missing EXIF, specific aspect ratios, or sRGB profiles)
        elif not exif:
            # Check aspect ratio or common screenshot filenames (though unreliable)
            source = "screenshot_or_scanned"
            confidence = 0.6

        return {
            "source": source,
            "confidence": confidence,
            "metadata": {
                "make": exif.get("Make"),
                "model": exif.get("Model"),
                "software": exif.get("Software"),
                "datetime": exif.get("DateTime")
            }
        }

    def get_quality_metrics(self, image_path: str) -> Dict[str, Any]:
        """
        Basic image quality assessment (resolution, format).
        """
        try:
            with Image.open(image_path) as img:
                width, height = img.size
                return {
                    "resolution": f"{width}x{height}",
                    "format": img.format,
                    "mode": img.mode,
                    "is_high_res": (width * height) > (2000 * 2000)
                }
        except Exception as e:
            logger.error(f"Error getting quality metrics: {e}")
            return {}
