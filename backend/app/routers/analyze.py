from fastapi import APIRouter
from app.schemas.request import ContentPayload
from app.schemas.response import AnalysisResponse
from app.services.classifier import classify

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("/live", response_model=AnalysisResponse)
async def analyze_live(payload: ContentPayload) -> AnalysisResponse:
    """
    Classify a content item detected by the extension in real time.
    Accepts the normalized ScrollSense payload and returns a classification.
    """
    return await classify(payload)
