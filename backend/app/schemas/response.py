from pydantic import BaseModel, Field
from typing import Any, Optional


class Scores(BaseModel):
    educational: float = Field(..., ge=0.0, le=1.0)
    high_emotion: float = Field(..., ge=0.0, le=1.0)
    credibility_risk: float = Field(..., ge=0.0, le=1.0)


class AnalysisResponse(BaseModel):
    category: str           # e.g. "Educational", "Entertainment"
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str             # one-sentence human-readable explanation
    scores: Scores


class SessionMetrics(BaseModel):
    """Computed aggregate metrics over the session history."""
    total: int                                    # total items analysed
    top_category: str                             # most frequent category
    category_distribution: dict[str, float]       # category -> fraction (0-1)
    top_creators: list[str]                       # up to 3, by frequency
    repetition_score: float = Field(..., ge=0.0, le=1.0)   # fraction from dominant creator
    diversity_score: float = Field(..., ge=0.0, le=1.0)    # entropy-based, 1 = perfectly diverse
    educational_ratio: float = Field(..., ge=0.0, le=1.0)
    high_emotion_ratio: float = Field(..., ge=0.0, le=1.0)


class SessionInsightResponse(BaseModel):
    """Full session analysis returned by POST /analyze/session."""
    metrics: SessionMetrics
    label: str                  # e.g. "Entertainment Loop", "Learning Mode"
    insights: list[str]         # 3 short descriptive bullets
    recommendations: list[str]  # 1-3 action-oriented strings
    summary: str                # 1-2 sentence narrative (Gemini or canned)


class ClassifiedVideo(BaseModel):
    title: str
    channel: str
    url: str
    watched_at: str | None = None
    video_id: str | None = None
    category: str
    confidence: float
    scores: Scores


class TakeoutUploadResponse(BaseModel):
    videos: list[ClassifiedVideo]
    stats: dict[str, Any]
    category_counts: dict[str, int]
    hour_distribution: dict[int, int]
    top_channels: list[dict[str, Any]]
