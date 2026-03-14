"""
bill.py — The Attention Bill endpoint
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

from app.services.bill_calculator import calculate_bill

router = APIRouter(prefix="/bill", tags=["bill"])


class BillRequest(BaseModel):
    classified_videos: list[dict[str, Any]]
    platform: str = "youtube"
    avg_watch_minutes: float = 8.0


@router.post("/calculate")
async def calculate_attention_bill(req: BillRequest):
    """
    Calculate the attention bill from classified video history.
    Takes the output from /takeout/upload and computes monetary value + trade equivalents.
    """
    return calculate_bill(
        classified_videos=req.classified_videos,
        platform=req.platform,
        avg_watch_minutes=req.avg_watch_minutes,
    )
