"""
session_analyzer.py — deterministic session insight engine.

Pipeline:
  1. Compute aggregate metrics from a list of HistoryItems.
  2. Assign a session label via priority-ordered rules.
  3. Generate 3 insight strings and 1–3 recommendations deterministically.
  4. Optionally ask Gemini for a polished 1-sentence summary narrative.
     Falls back to a canned template if Gemini is unavailable or times out.

All classification logic lives here; the router just calls `analyze_session()`.
"""

import asyncio
import logging
import math
from collections import Counter

from app.core.config import get_settings
from app.schemas.request import HistoryItem
from app.schemas.response import SessionInsightResponse, SessionMetrics
from app.services import gemini_client

logger = logging.getLogger(__name__)

# ── Category constants (must match classifier.py VALID_CATEGORIES) ──────────
CAT_EDUCATIONAL = "Educational"
CAT_ENTERTAINMENT = "Entertainment"
CAT_NEWS = "Credible News"
CAT_OPINION = "Opinion / Commentary"
CAT_HIGH_EMOTION = "High-Emotion / Rage-Bait"
CAT_OTHER = "Other"

# Sports keywords for detecting a sports-heavy entertainment session.
_SPORTS_KW = {
    "nfl", "nba", "nhl", "mlb", "soccer", "football", "basketball",
    "baseball", "tennis", "golf", "ufc", "mma", "match", "highlights",
    "premier league", "champions league", "world cup",
}

GEMINI_TIMEOUT_S = 5.0


# ── Public entry point ───────────────────────────────────────────────────────

async def analyze_session(items: list[HistoryItem]) -> SessionInsightResponse:
    """
    Full async pipeline. Safe: never raises, always returns a response.
    """
    # Restrict to items that have a category (unclassified items skipped for metrics).
    classified = [i for i in items if i.category]
    if not classified:
        # Nothing classified yet — return a minimal response.
        classified = items  # use all so at least total is correct

    metrics = _compute_metrics(classified, total_seen=len(items))
    label = _assign_label(metrics, classified)
    insights = _generate_insights(metrics, classified)
    recommendations = _generate_recommendations(metrics, label)
    summary = await _generate_summary(label, metrics)

    return SessionInsightResponse(
        metrics=metrics,
        label=label,
        insights=insights,
        recommendations=recommendations,
        summary=summary,
    )


# ── Metrics computation ──────────────────────────────────────────────────────

def _compute_metrics(items: list[HistoryItem], total_seen: int) -> SessionMetrics:
    n = len(items)

    # Category distribution
    cats = [i.category for i in items if i.category]
    cat_counts = Counter(cats)
    top_category = cat_counts.most_common(1)[0][0] if cat_counts else CAT_OTHER
    cat_dist = {cat: round(count / n, 3) for cat, count in cat_counts.most_common()}

    # Creator frequency
    creators = [i.creator for i in items if i.creator]
    creator_counts = Counter(creators)
    top_creators = [c for c, _ in creator_counts.most_common(3)]

    # Repetition score: fraction of items from the single most-watched creator.
    # 1.0 = all videos from one creator; 0.0 = no creator info or all unique.
    if creator_counts:
        top_creator_n = creator_counts.most_common(1)[0][1]
        repetition_score = round(top_creator_n / n, 3)
    else:
        repetition_score = 0.0

    # Diversity score: normalised Shannon entropy over category distribution.
    # 1.0 = every item in a different category; 0.0 = single category.
    n_cats = len(cat_counts)
    if n_cats <= 1:
        diversity_score = 0.0
    else:
        entropy = -sum((c / n) * math.log2(c / n) for c in cat_counts.values())
        max_entropy = math.log2(n_cats)
        diversity_score = round(entropy / max_entropy, 3) if max_entropy else 0.0

    educational_ratio = round(cat_counts.get(CAT_EDUCATIONAL, 0) / n, 3)
    high_emotion_ratio = round(cat_counts.get(CAT_HIGH_EMOTION, 0) / n, 3)

    return SessionMetrics(
        total=total_seen,
        top_category=top_category,
        category_distribution=cat_dist,
        top_creators=top_creators,
        repetition_score=repetition_score,
        diversity_score=diversity_score,
        educational_ratio=educational_ratio,
        high_emotion_ratio=high_emotion_ratio,
    )


# ── Label assignment ─────────────────────────────────────────────────────────

def _is_sports_heavy(items: list[HistoryItem]) -> bool:
    """Return True if ≥2 sports keywords appear across all item titles."""
    text = " ".join((i.title or "") for i in items).lower()
    return sum(1 for kw in _SPORTS_KW if kw in text) >= 2


def _assign_label(metrics: SessionMetrics, items: list[HistoryItem]) -> str:
    """
    Priority-ordered rules. First match wins.

    Thresholds are intentionally loose so the label fires meaningfully
    even on short sessions (3–5 items).
    """
    m = metrics
    top_frac = m.category_distribution.get(m.top_category, 0.0)

    if m.educational_ratio >= 0.5:
        return "Learning Mode"

    if m.high_emotion_ratio >= 0.4:
        return "Rage Feed"

    if m.repetition_score >= 0.5:
        return "Creator Binge"

    if m.top_category == CAT_OPINION and top_frac >= 0.4:
        return "Commentary Cluster"

    if m.top_category == CAT_ENTERTAINMENT and top_frac >= 0.55:
        if _is_sports_heavy(items):
            return "Sports Spiral"
        return "Entertainment Loop"

    if m.top_category == CAT_NEWS and top_frac >= 0.4:
        return "News Dive"

    if m.diversity_score >= 0.72:
        return "Balanced Feed"

    return "Mixed Session"


# ── Insights ─────────────────────────────────────────────────────────────────

def _pct(ratio: float) -> str:
    return f"{round(ratio * 100)}%"


def _generate_insights(metrics: SessionMetrics, items: list[HistoryItem]) -> list[str]:
    """Always returns exactly 3 insight strings."""
    m = metrics
    out: list[str] = []

    # Insight 1: category breadth
    n_cats = len(m.category_distribution)
    top_frac = m.category_distribution.get(m.top_category, 0.0)
    if n_cats == 1:
        out.append(f"Every video in this session is {m.top_category}.")
    elif top_frac >= 0.6:
        out.append(
            f"{_pct(top_frac)} of your session is {m.top_category}, "
            f"spread across {n_cats} categories total."
        )
    else:
        out.append(
            f"Your session spans {n_cats} different categories — "
            f"{m.top_category} leads at {_pct(top_frac)}."
        )

    # Insight 2: creator focus
    n_creators = len({i.creator for i in items if i.creator})
    if m.repetition_score >= 0.5 and m.top_creators:
        out.append(
            f"Over half your videos are from {m.top_creators[0]} — "
            f"you're deep in one creator's content."
        )
    elif n_creators == 0:
        out.append("No creator information was available for this session.")
    elif n_creators == 1:
        out.append(f"All videos are from a single creator: {m.top_creators[0]}.")
    else:
        out.append(
            f"You've watched content from {n_creators} different creators"
            + (f", led by {m.top_creators[0]}." if m.top_creators else ".")
        )

    # Insight 3: signal — emotional tone or learning balance
    if m.high_emotion_ratio >= 0.3:
        out.append(
            f"{_pct(m.high_emotion_ratio)} of this session is high-emotion or rage-bait content."
        )
    elif m.educational_ratio >= 0.3:
        out.append(
            f"{_pct(m.educational_ratio)} of your session is educational — nice balance."
        )
    elif m.educational_ratio == 0.0:
        out.append("None of this session's content has been flagged as educational.")
    else:
        out.append(
            f"Only {_pct(m.educational_ratio)} of the session is educational content."
        )

    return out


# ── Recommendations ──────────────────────────────────────────────────────────

def _generate_recommendations(metrics: SessionMetrics, label: str) -> list[str]:
    """Returns 1–3 concise action-oriented strings."""
    m = metrics
    recs: list[str] = []

    if m.high_emotion_ratio >= 0.3:
        recs.append("Mix in some educational or credible news content to balance the emotional tone.")

    if m.repetition_score >= 0.5:
        recs.append("Try exploring creators you haven't watched before for a broader perspective.")

    if m.educational_ratio == 0.0 and label not in ("Balanced Feed", "Learning Mode"):
        recs.append("Consider adding a documentary, tutorial, or explainer to the session.")

    if m.diversity_score < 0.25 and label not in ("Learning Mode",):
        recs.append("Your session is very narrowly focused — a different category might be refreshing.")

    # Cap at 3; always return at least 1.
    recs = recs[:3]
    if not recs:
        recs.append("Your session looks healthy — keep exploring different content types.")

    return recs


# ── Summary (Gemini-optional) ────────────────────────────────────────────────

_SUMMARY_PROMPT = """\
You are a scroll health assistant. Write ONE engaging sentence (max 28 words) \
describing the user's watch session pattern, speaking directly to them. \
Be observational and non-judgmental. Do not use the word "spiral".

Session label: {label}
Top category: {top_category} ({top_pct}% of session)
Total videos: {total}
Educational: {edu_pct}%  |  High-emotion: {emo_pct}%  |  Diversity: {div_pct}%
Top creators: {top_creators}

Respond with the sentence only — no quotes, no explanation."""


def _canned_summary(label: str, metrics: SessionMetrics) -> str:
    m = metrics
    top_pct = round(m.category_distribution.get(m.top_category, 0) * 100)
    templates = {
        "Learning Mode":       f"You're in a focused learning session — {top_pct}% educational content so far.",
        "Rage Feed":           f"This session is heavy on emotional content — {_pct(m.high_emotion_ratio)} of videos are high-intensity.",
        "Creator Binge":       f"You've locked onto {m.top_creators[0] if m.top_creators else 'one creator'} for the bulk of this session.",
        "Commentary Cluster":  f"Most of what you're watching is opinion and commentary — {top_pct}% of the session.",
        "Entertainment Loop":  f"It's been a mostly entertainment session — {top_pct}% of videos fall in that category.",
        "Sports Spiral":       f"Your session is dominated by sports content — {top_pct}% of what you've watched.",
        "News Dive":           f"You've been keeping up with the news — {top_pct}% credible news content this session.",
        "Balanced Feed":       f"Nicely balanced session across {len(m.category_distribution)} categories.",
        "Mixed Session":       f"A varied session — {m.top_category} leads at {top_pct}% with no dominant pattern.",
    }
    return templates.get(label, f"Your session is labeled '{label}' with {m.total} videos watched.")


async def _generate_summary(label: str, metrics: SessionMetrics) -> str:
    if not get_settings().gemini_api_key:
        return _canned_summary(label, metrics)

    m = metrics
    top_pct = round(m.category_distribution.get(m.top_category, 0) * 100)
    prompt = _SUMMARY_PROMPT.format(
        label=label,
        top_category=m.top_category,
        top_pct=top_pct,
        total=m.total,
        edu_pct=round(m.educational_ratio * 100),
        emo_pct=round(m.high_emotion_ratio * 100),
        div_pct=round(m.diversity_score * 100),
        top_creators=", ".join(m.top_creators) if m.top_creators else "unknown",
    )

    try:
        raw = await asyncio.wait_for(
            gemini_client.generate(prompt),
            timeout=GEMINI_TIMEOUT_S,
        )
        sentence = raw.strip().strip('"').strip("'")
        # Sanity-check: reject suspiciously long or empty responses.
        if 5 < len(sentence) < 300:
            logger.debug("[session] Gemini summary: %s", sentence)
            return sentence
    except asyncio.TimeoutError:
        logger.warning("[session] Gemini summary timed out — using canned.")
    except Exception as exc:
        logger.error("[session] Gemini summary failed: %s", exc)

    return _canned_summary(label, metrics)
