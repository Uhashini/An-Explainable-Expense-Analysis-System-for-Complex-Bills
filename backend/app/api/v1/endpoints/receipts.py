from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.ocr_service import ocr_service
from app.services.product_matcher import product_matcher

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

        # (Matching removed here to separate the concerns as requested)

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing receipt: {str(e)}",
        )

class MatchProductsRequest(BaseModel):
    items: List[Dict[str, Any]]

@router.post("/match-products", tags=["Receipts"])
async def match_products(request: MatchProductsRequest):
    """
    Enhance a list of receipt items by matching them against the food database.
    """
    try:
        from fastapi.concurrency import run_in_threadpool
        
        def _match_items():
            enriched_items = []
            for item in request.items:
                match = product_matcher.match_item(item.get("name", ""))
                if match:
                    item["food_id"] = match.get("food_id")
                    item["matched_name"] = match.get("matched_name")
                    item["display_name"] = match.get("display_name")
                    item["category"] = match.get("category")
                    item["subcategory"] = match.get("subcategory")
                    item["serving_size"] = match.get("serving_size")
                    item["serving_unit"] = match.get("serving_unit")
                    item["nutrition"] = match.get("nutrition")
                    item["health"] = match.get("health")
                enriched_items.append(item)
            return enriched_items
            
        enriched_items = await run_in_threadpool(_match_items)
        return {"status": "success", "items": enriched_items}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error matching products: {str(e)}",
        )

