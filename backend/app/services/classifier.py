"""
classifier.py — three-stage hybrid classification pipeline:

  Stage 1 — Rules baseline (rules.py)
    Fast, free, synchronous keyword matching.
    If high_confidence=True → return immediately, skip Gemini.
    If high_confidence=False → use as fallback, still call Gemini.

  Stage 2 — Gemini refinement (gemini_client.py)
    Called when no high-confidence rule fires and GEMINI_API_KEY is set.
    Structured JSON prompt; strict output schema.

  Stage 3 — Deterministic fallback
    If Gemini is absent or fails, returns the rules result (if any) or
    a plain "Other" response. Never raises.
"""
import json
import logging

from app.core.config import get_settings
from app.schemas.request import ContentPayload
from app.schemas.response import AnalysisResponse, Scores
from app.services import gemini_client
from app.services.rules import (
    check_rules,
    CAT_OTHER,
)

logger = logging.getLogger(__name__)

# ── Valid categories (enforced on Gemini output) ──────────────────────────────

VALID_CATEGORIES = {
    "Educational",
    "Entertainment",
    "Credible News",
    "Opinion / Commentary",
    "High-Emotion / Rage-Bait",
    "Other",
}

# ── Gemini prompt ─────────────────────────────────────────────────────────────
# Kept tightly structured to minimise hallucination and reduce output tokens.
# Double-braces escape the f-string / .format() braces that aren't placeholders.

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
        visible_text=(payload.visible_text or "")[:800],   # keep prompt compact
    )


def _parse(raw: str) -> AnalysisResponse:
    """
    Parse Gemini's JSON output into AnalysisResponse.
    Raises json.JSONDecodeError or KeyError on malformed output.
    """
    # Strip accidental markdown fences.
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


# ── Public entry point ────────────────────────────────────────────────────────

async def classify(payload: ContentPayload) -> AnalysisResponse:
    """
    Classify a content payload. Never raises — always returns an AnalysisResponse.
    """
    # Stage 1: rules baseline.
    rules_result = check_rules(payload)

    if rules_result is not None and rules_result.high_confidence:
        logger.debug("[rules] High-confidence hit for '%s': %s", payload.title, rules_result.response.category)
        return rules_result.response

    # Stage 2: Gemini refinement.
    if get_settings().gemini_api_key:
        try:
            prompt = _build_prompt(payload)
            raw = await gemini_client.generate(prompt)
            result = _parse(raw)
            logger.debug("[gemini] '%s' → %s (%.2f)", payload.title, result.category, result.confidence)
            return result
        except Exception as exc:
            logger.error("[gemini] Failed for '%s': %s", payload.title, exc)
            # Fall through to Stage 3.
    else:
        logger.debug("[gemini] No API key — skipping.")

    # Stage 3: deterministic fallback.
    result = _fallback(rules_result)
    logger.debug("[fallback] '%s' → %s", payload.title, result.category)
    return result
