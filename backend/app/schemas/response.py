from pydantic import BaseModel, Field
from typing import Optional


class Scores(BaseModel):
    educational: float = Field(..., ge=0.0, le=1.0)
    high_emotion: float = Field(..., ge=0.0, le=1.0)
    credibility_risk: float = Field(..., ge=0.0, le=1.0)


class AnalysisResponse(BaseModel):
    category: str           # e.g. "educational", "entertainment", "misleading", "ragebait"
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str             # one-sentence human-readable explanation
    scores: Scores
