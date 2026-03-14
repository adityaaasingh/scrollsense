from pydantic import BaseModel, Field

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
    total: int                                    # total items in the request (incl. unclassified)
    top_category: str                             # most frequent category
    category_distribution: dict[str, float]       # category → fraction (0–1), ordered by frequency
    platform_mix: dict[str, float]                # platform → fraction (0–1), e.g. {"youtube": 0.8}
    top_creators: list[str]                       # up to 3 creators, by frequency
    creator_concentration_score: float = Field(  # normalised HHI over creators (0 = diverse, 1 = one creator)
        ..., ge=0.0, le=1.0
    )
    repetition_score: float = Field(             # fraction of items from the single most-watched creator
        ..., ge=0.0, le=1.0
    )
    diversity_score: float = Field(              # normalised entropy over categories (0 = single cat, 1 = even spread)
        ..., ge=0.0, le=1.0
    )
    educational_ratio: float = Field(..., ge=0.0, le=1.0)
    high_emotion_ratio: float = Field(..., ge=0.0, le=1.0)


class SessionInsightResponse(BaseModel):
    """Full session analysis returned by POST /analyze/session."""
    metrics: SessionMetrics
    label: str                  # e.g. "Entertainment Loop", "Learning Mode"
    insights: list[str]         # exactly 3 short descriptive bullets
    recommendations: list[str]  # 1–3 action-oriented strings
    summary: str                # 1–2 sentence narrative (Gemini or canned fallback)


class TimeBlockStatement(BaseModel):
    """Insight for a single time-of-day block (Morning / Afternoon / Evening / Late Night)."""
    block: str             # "Morning" | "Afternoon" | "Evening" | "Late Night"
    hours: str             # human-readable range, e.g. "6am–12pm"
    dominant_category: str
    emotional_score: float = Field(..., ge=0.0, le=1.0)
    statement: str         # plain-English summary sentence
    traffic_light: str     # "green" | "amber" | "red"


class DashboardResponse(BaseModel):
    """Returned by POST /analyze/dashboard."""
    time_blocks: list[TimeBlockStatement]
    overall_statement: str  # 1-sentence arc for the full history
