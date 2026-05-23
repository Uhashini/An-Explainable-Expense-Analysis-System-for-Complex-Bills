import fitz  # PyMuPDF
from PIL import Image
import io
import os
import logging
from typing import List, Tuple, Dict, Any

logger = logging.getLogger(__name__)

class PDFProcessor:
    """
    Intelligent PDF handling for receipts.
    Detects native vs scanned PDFs and handles extraction accordingly.
    """

    @staticmethod
    def is_native_pdf(pdf_path: str) -> bool:
        """
        Detects if a PDF has a text layer (native) or is purely image-based.
        """
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                if page.get_text():
                    doc.close()
                    return True
            doc.close()
            return False
        except Exception as e:
            logger.error(f"Error checking PDF type: {e}")
            return False

    def extract_native_text(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extracts text, coordinates, and font info from a native PDF.
        """
        extracted_data = []
        doc = fitz.open(pdf_path)
        for page_num, page in enumerate(doc):
            text_instances = page.get_text("dict")["blocks"]
            for block in text_instances:
                if "lines" in block:
                    for line in block["lines"]:
                        for span in line["spans"]:
                            extracted_data.append({
                                "text": span["text"],
                                "bbox": span["bbox"],
                                "page": page_num + 1,
                                "font": span["font"],
                                "size": span["size"]
                            })
        doc.close()
        return extracted_data

    def pdf_to_images(self, pdf_path: str, dpi: int = 300) -> List[Image.Image]:
        """
        Converts PDF pages to high-resolution images for OCR.
        """
        images = []
        doc = fitz.open(pdf_path)
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(dpi/72, dpi/72))
            img_data = pix.tobytes("png")
            images.append(Image.open(io.BytesIO(img_data)))
        doc.close()
        return images

    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Main entry point for PDF processing.
        """
        is_native = self.is_native_pdf(pdf_path)
        
        result = {
            "is_native": is_native,
            "metadata": {},
            "content": []
        }

        if is_native:
            logger.info(f"Processing native PDF: {pdf_path}")
            result["content"] = self.extract_native_text(pdf_path)
        else:
            logger.info(f"Processing scanned PDF: {pdf_path}")
            # Page images will be passed to the OCR service downstream
            result["images"] = self.pdf_to_images(pdf_path)

        return result
