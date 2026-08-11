from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ocr_service import ocr_service

router = APIRouter()

@router.post("/upload", tags=["Receipts"])
async def upload_receipt(file: UploadFile = File(...)):
    """
    Upload a receipt image and return structured receipt data.

    Response shape:
    {
        "status": "success",
        "filename": "...",
        "data": {
            "receipt_info": {
                "merchant_name": str,
                "date": str,
                "total_amount": float,
                "items": [{ "name", "quantity", "unit_price", "total_price" }]
            },
            "words": [...],
            "boxes": [...],
            "entities": [...],
            "image_size": { "width": int, "height": int }
        }
    }
    """
    # Be permissive — React Native sometimes sends no content type or image/octet-stream
    if file.content_type and not file.content_type.startswith("image/") and file.content_type != "application/octet-stream":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Must be an image.",
        )

    try:
        from fastapi.concurrency import run_in_threadpool
        
        contents = await file.read()

        # Full OCR + LayoutLM pipeline (run in threadpool to prevent blocking the async event loop)
        result = await run_in_threadpool(ocr_service.extract_structured_data, contents)

        # Stamp the original filename
        result["filename"] = file.filename

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing receipt: {str(e)}",
        )

