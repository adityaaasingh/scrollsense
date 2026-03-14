"""
dashboard_analyzer.py — time-block analysis for the all-time log.

Pipeline:
  1. Group AllTimeItems into four time blocks by captured_at hour.
  2. Compute dominant category + emotional score per block.
  3. Generate a plain-English statement per block (Gemini, fallback to template).
  4. Compute an overall_statement for the full history.

Safe: never raises, always returns a DashboardResponse.
"""

import asyncio
import logging
from collections import Counter
from datetime import datetime, timezone

from app.core.config import get_settings
from app.schemas.request import AllTimeItem
from app.schemas.response import DashboardResponse, TimeBlockStatement
from app.services import gemini_client

logger = logging.getLogger(__name__)

GEMINI_TIMEOUT_S = 6.0

CAT_HIGH_EMOTION = "High-Emotion / Rage-Bait"
CAT_EDUCATIONAL  = "Educational"
CAT_OTHER        = "Other"

# ── Time block definitions ────────────────────────────────────────────────────

BLOCKS = [
    ("Morning",    "6am–12pm",  range(6,  12)),
    ("Afternoon",  "12pm–5pm",  range(12, 17)),
    ("Evening",    "5pm–10pm",  range(17, 22)),
    ("Late Night", "10pm–6am",  list(range(22, 24)) + list(range(0, 6))),
]


def _block_for_hour(hour: int) -> str:
    for name, _, hours in BLOCKS:
        if hour in hours:
            return name
    return "Late Night"


def _traffic_light(score: float) -> str:
    if score < 0.3:
        return "green"
    if score < 0.6:
        return "amber"
    return "red"


def _parse_hour(captured_at: str | None) -> int | None:
    if not captured_at:
        return None
    try:
        dt = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).hour
    except Exception:
        return None


# ── Emotional score estimation ────────────────────────────────────────────────

def _emotion_score(item: AllTimeItem) -> float:
    """Return high_emotion score, estimated from scores field or category."""
    if item.scores and item.scores.high_emotion is not None:
        return item.scores.high_emotion
    if item.category == CAT_HIGH_EMOTION:
        return 0.9
    if item.category == CAT_EDUCATIONAL:
        return 0.05
    return 0.3   # neutral fallback


# ── Statement generation ──────────────────────────────────────────────────────

_BLOCK_PROMPT = """\
You are a scroll health assistant. Write ONE concise sentence (max 25 words) \
describing the user's browsing pattern during {block} ({hours}). \
Speak directly to them. Be observational and non-judgmental.

Dominant category: {dominant_category}
Emotional intensity score: {emo_pct}% (0% = calm, 100% = intense)
Item count: {count}
Traffic light: {traffic_light}

Respond with the sentence only — no quotes, no explanation."""


_BLOCK_TEMPLATES = {
    "green":  "{block} browsing ({dominant_category}, {emo_pct}% emotional) looks calm and balanced.",
    "amber":  "Your {block} sessions lean toward {dominant_category} with a moderate emotional tone ({emo_pct}%).",
    "red":    "Your {block} browsing is high-intensity — {dominant_category} dominates at {emo_pct}% emotional.",
}

_OVERALL_PROMPT = """\
You are a scroll health assistant. Write ONE sentence (max 30 words) \
summarising the user's all-time browsing arc. Speak directly to them. Be honest but kind.

Total items: {total}
Most-browsed category: {top_category} ({top_pct}%)
High-emotion ratio (all time): {emo_pct}%
Educational ratio (all time): {edu_pct}%
Platforms: {platforms}

Respond with the sentence only — no quotes, no explanation."""


async def _gemini_block_statement(
    block: str, hours: str, dominant_category: str,
    emotional_score: float, count: int, traffic_light: str,
) -> str | None:
    if not get_settings().gemini_api_key:
        return None
    prompt = _BLOCK_PROMPT.format(
        block=block, hours=hours,
        dominant_category=dominant_category,
        emo_pct=round(emotional_score * 100),
        count=count,
        traffic_light=traffic_light,
    )
    try:
        raw = await asyncio.wait_for(gemini_client.generate(prompt), timeout=GEMINI_TIMEOUT_S)
        sentence = raw.strip().strip('"').strip("'")
        if 5 < len(sentence) < 300:
            return sentence
    except asyncio.TimeoutError:
        logger.warning("[dashboard] Gemini block statement timed out.")
    except Exception as exc:
        logger.error("[dashboard] Gemini block statement failed: %s", exc)
    return None


def _canned_block_statement(
    block: str, dominant_category: str, emotional_score: float, traffic_light: str
) -> str:
    template = _BLOCK_TEMPLATES.get(traffic_light, _BLOCK_TEMPLATES["amber"])
    return template.format(
        block=block,
        dominant_category=dominant_category,
        emo_pct=round(emotional_score * 100),
    )


async def _gemini_overall(
    total: int, top_category: str, top_pct: int,
    emo_pct: int, edu_pct: int, platforms: str,
) -> str | None:
    if not get_settings().gemini_api_key:
        return None
    prompt = _OVERALL_PROMPT.format(
        total=total, top_category=top_category, top_pct=top_pct,
        emo_pct=emo_pct, edu_pct=edu_pct, platforms=platforms,
    )
    try:
        raw = await asyncio.wait_for(gemini_client.generate(prompt), timeout=GEMINI_TIMEOUT_S)
        sentence = raw.strip().strip('"').strip("'")
        if 5 < len(sentence) < 400:
            return sentence
    except asyncio.TimeoutError:
        logger.warning("[dashboard] Gemini overall statement timed out.")
    except Exception as exc:
        logger.error("[dashboard] Gemini overall statement failed: %s", exc)
    return None


# ── Public entry point ────────────────────────────────────────────────────────

async def analyze_dashboard(items: list[AllTimeItem]) -> DashboardResponse:
    """Full async pipeline. Safe: never raises, always returns a DashboardResponse."""

    if not items:
        return DashboardResponse(
            time_blocks=[],
            overall_statement="No browsing history recorded yet — start browsing and ScrollSense will build your profile.",
        )

    # Group items by time block.
    grouped: dict[str, list[AllTimeItem]] = {name: [] for name, _, _ in BLOCKS}
    for item in items:
        hour = _parse_hour(item.captured_at)
        if hour is not None:
            grouped[_block_for_hour(hour)].append(item)

    # Build time block statements concurrently.
    async def _build_block(name: str, hours: str) -> TimeBlockStatement | None:
        block_items = grouped.get(name, [])
        if not block_items:
            return None

        cats = [i.category for i in block_items if i.category]
        cat_counts = Counter(cats)
        dominant_category = cat_counts.most_common(1)[0][0] if cat_counts else CAT_OTHER

        scores = [_emotion_score(i) for i in block_items]
        emotional_score = round(sum(scores) / len(scores), 3)

        tl = _traffic_light(emotional_score)

        statement = await _gemini_block_statement(
            name, hours, dominant_category, emotional_score, len(block_items), tl
        )
        if not statement:
            statement = _canned_block_statement(name, dominant_category, emotional_score, tl)

        return TimeBlockStatement(
            block=name,
            hours=hours,
            dominant_category=dominant_category,
            emotional_score=emotional_score,
            statement=statement,
            traffic_light=tl,
        )

    block_results = await asyncio.gather(
        *[_build_block(name, hours) for name, hours, _ in BLOCKS]
    )
    time_blocks = [b for b in block_results if b is not None]

    # Overall statement.
    all_cats = [i.category for i in items if i.category]
    cat_counts = Counter(all_cats)
    top_category = cat_counts.most_common(1)[0][0] if cat_counts else CAT_OTHER
    n = len(items)
    top_pct = round(cat_counts.get(top_category, 0) / n * 100) if n else 0

    all_emo_scores = [_emotion_score(i) for i in items]
    emo_pct = round(sum(all_emo_scores) / len(all_emo_scores) * 100) if all_emo_scores else 0
    edu_count = sum(1 for i in items if i.category == CAT_EDUCATIONAL)
    edu_pct = round(edu_count / n * 100) if n else 0

    platforms = Counter(i.platform for i in items if i.platform)
    platforms_str = ", ".join(f"{p} ({round(c/n*100)}%)" for p, c in platforms.most_common()) or "unknown"

    overall_statement = await _gemini_overall(n, top_category, top_pct, emo_pct, edu_pct, platforms_str)
    if not overall_statement:
        overall_statement = (
            f"Across {n} items, your browsing is dominated by {top_category} "
            f"({top_pct}%) with {emo_pct}% emotional intensity overall."
        )

    return DashboardResponse(time_blocks=time_blocks, overall_statement=overall_statement)
