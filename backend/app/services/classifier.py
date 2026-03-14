"""
classifier.py — three-stage hybrid classification pipeline:

  Stage 1 — Rules baseline (rules.py)
    Fast, free, synchronous keyword matching.
    If high_confidence=True → return immediately, skip Gemini.
    If high_confidence=False → rules result held as fallback.

  Stage 2 — Gemini refinement (gemini_client.py)
    Called when no high-confidence rule fires and GEMINI_API_KEY is set.
    Hard timeout of GEMINI_TIMEOUT_S seconds — if Gemini is slow or hangs,
    asyncio.TimeoutError is caught and we fall through immediately.

  Stage 3 — Deterministic fallback
    Returns the rules result (always present for YouTube) or a bare
    "Other" response. Never raises, never hangs.
"""
import asyncio
import json
import logging

from app.core.config import get_settings
from app.schemas.request import ContentPayload
from app.schemas.response import AnalysisResponse, Scores
from app.services import gemini_client
from app.services.rules import check_rules, CAT_OTHER

logger = logging.getLogger(__name__)

# Hard ceiling on how long we'll wait for Gemini before falling back.
# Keeps the side panel responsive even on cold-start or rate-limited API.
GEMINI_TIMEOUT_S = 8.0

VALID_CATEGORIES = {
    "Educational",
    "Entertainment",
    "Credible News",
    "Opinion / Commentary",
    "High-Emotion / Rage-Bait",
    "Other",
}

_PROMPT = """\
Classify the content item below into EXACTLY ONE of these categories:
  Educational | Entertainment | Credible News | Opinion / Commentary | High-Emotion / Rage-Bait | Other

Respond with ONLY valid JSON — no markdown, no extra text:
{{
  "category": "<one of the categories above>",
  "confidence": <float 0.0–1.0>,
  "reason": "<one concise sentence, no overclaiming>",
  "scores": {{
    "educational":      <float 0.0–1.0>,
    "high_emotion":     <float 0.0–1.0>,
    "credibility_risk": <float 0.0–1.0>
  }}
}}

Rules:
- credibility_risk = likelihood the content contains misleading or unverified claims.
- Do not overclaim certainty; prefer moderate confidence (0.55–0.80) unless signals are very clear.
- Base your answer only on the fields provided; do not infer from the URL.

Content:
platform: {platform}
content_type: {content_type}
title: {title}
creator: {creator}
text: {visible_text}
"""


def _build_prompt(payload: ContentPayload) -> str:
    return _PROMPT.format(
        platform=payload.platform,
        content_type=payload.content_type,
        title=payload.title or "(none)",
        creator=payload.creator or "(none)",
        visible_text=(payload.visible_text or "")[:800],
    )


def _parse(raw: str) -> AnalysisResponse:
    cleaned = raw.strip()
    for fence in ("```json", "```"):
        cleaned = cleaned.removeprefix(fence).removesuffix("```").strip()

    data = json.loads(cleaned)

    category = data.get("category", CAT_OTHER)
    if category not in VALID_CATEGORIES:
        logger.warning("Gemini returned unknown category '%s', remapping to Other.", category)
        category = CAT_OTHER

    return AnalysisResponse(
        category=category,
        confidence=float(data["confidence"]),
        reason=data["reason"],
        scores=Scores(
            educational=float(data["scores"]["educational"]),
            high_emotion=float(data["scores"]["high_emotion"]),
            credibility_risk=float(data["scores"]["credibility_risk"]),
        ),
    )


def _fallback(rules_result=None) -> AnalysisResponse:
    """Return rules result if available, else a plain Other response."""
    if rules_result is not None:
        return rules_result.response
    return AnalysisResponse(
        category=CAT_OTHER,
        confidence=0.40,
        reason="Content could not be classified automatically.",
        scores=Scores(educational=0.0, high_emotion=0.0, credibility_risk=0.0),
    )


async def classify(payload: ContentPayload) -> AnalysisResponse:
    """
    Classify a content payload. Never raises, never hangs beyond GEMINI_TIMEOUT_S.
    Always returns an AnalysisResponse.
    """
    # Stage 1: rules baseline (synchronous, instant).
    rules_result = check_rules(payload)

    if rules_result is not None and rules_result.high_confidence:
        logger.debug("[rules] High-confidence: '%s' → %s", payload.title, rules_result.response.category)
        return rules_result.response

    # Stage 2: Gemini with hard timeout.
    if get_settings().gemini_api_key:
        try:
            prompt = _build_prompt(payload)
            raw = await asyncio.wait_for(
                gemini_client.generate(prompt),
                timeout=GEMINI_TIMEOUT_S,
            )
            result = _parse(raw)
            logger.debug("[gemini] '%s' → %s (%.2f)", payload.title, result.category, result.confidence)
            return result
        except asyncio.TimeoutError:
            logger.warning(
                "[gemini] Timed out after %.1fs for '%s' — using fallback.",
                GEMINI_TIMEOUT_S, payload.title,
            )
        except Exception as exc:
            logger.error("[gemini] Failed for '%s': %s", payload.title, exc)
    else:
        logger.debug("[gemini] No API key — skipping.")

    # Stage 3: deterministic fallback (rules result or plain Other).
    result = _fallback(rules_result)
    logger.debug("[fallback] '%s' → %s", payload.title, result.category)
    return result
