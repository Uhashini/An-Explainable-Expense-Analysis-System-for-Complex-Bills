from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ocr_service import ocr_service

router = APIRouter()

@router.post("/upload", tags=["Receipts"])
async def upload_receipt(file: UploadFile = File(...)):
    """
    Upload a receipt image, extract structured data (text + boxes) using OCR,
    and return the result formatted for LayoutLMv3.
    """
    # Check file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=400, 
            detail="File must be a JPEG or PNG image."
        )
    
    try:
        # Read file contents
        contents = await file.read()
        
        # Extract structured data using OCR service
        structured_data = ocr_service.extract_structured_data(contents)
        
        # Override filename for reporting
        structured_data["filename"] = file.filename
        
        return structured_data
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing receipt: {str(e)}"
        )
