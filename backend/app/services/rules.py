"""
rules.py — fast, zero-cost rules-based baseline classifier.

Evaluated before Gemini on every request. Produces a full AnalysisResponse with
a high_confidence flag so the classifier can decide whether to accept it or still
call Gemini for refinement.

Adding a new platform: add a branch under check_rules() that dispatches on
payload.platform, then implement a _rules_<platform>() function.
"""
import re
from dataclasses import dataclass
from typing import Optional

from app.schemas.request import ContentPayload
from app.schemas.response import AnalysisResponse, Scores

# ── Category constants (match the Gemini prompt vocabulary exactly) ───────────

CAT_EDUCATIONAL      = "Educational"
CAT_ENTERTAINMENT    = "Entertainment"
CAT_CREDIBLE_NEWS    = "Credible News"
CAT_OPINION          = "Opinion / Commentary"
CAT_HIGH_EMOTION     = "High-Emotion / Rage-Bait"
CAT_OTHER            = "Other"

# ── Trusted news creators ─────────────────────────────────────────────────────

_TRUSTED_NEWS_CREATORS = re.compile(
    r"\b(BBC(\s+News)?|Reuters|Associated Press|AP\s+News|NPR|PBS\s+NewsHour|"
    r"The\s+Guardian|Bloomberg|Financial\s+Times|DW\s+News|Al\s+Jazeera|"
    r"CNN|NBC\s+News|ABC\s+News|CBS\s+News|Sky\s+News|Channel\s+4\s+News|"
    r"Vice\s+News|The\s+Economist|New\s+York\s+Times|Washington\s+Post)\b",
    re.IGNORECASE,
)

# ── High-emotion / rage-bait ──────────────────────────────────────────────────

_HIGH_EMOTION = re.compile(
    r"\b(you won'?t believe|shocking|outrage|outraged|furious|explosive|scandal|"
    r"they (don'?t|didn'?t) want you to know|secret(ly)?|banned|exposed|"
    r"must[- ]watch|going viral|destroys?|melts?\s+down|loses?\s+it|triggered|"
    r"mind[- ]blown|insane|unhinged|clown world|ratio'?d|"
    r"they'?re hiding|wake up|sheeple|mainstream media|deep state|"
    r"cancel(l?ed)?|silenced|censored|the truth about)\b",
    re.IGNORECASE,
)

# ── Educational ───────────────────────────────────────────────────────────────

_EDUCATIONAL = re.compile(
    r"\b(tutorial|how[- ]to|explained?|lesson|course|lecture|guide|"
    r"learn(ing)?|introduction\s+to|deep[- ]dive|overview|step[- ]by[- ]step|"
    r"masterclass|crash[- ]course|demystified|beginner'?s?|advanced\s+\w+|"
    r"walkthrough|science\s+of|history\s+of|what\s+is\s+a?\s*\w+|"
    r"why\s+does|how\s+does|documentary|educational|study|research|"
    r"mit\s+lecture|ted\s+talk|tedx|coursera|khan\s+academy)\b",
    re.IGNORECASE,
)

# ── Opinion / Commentary ──────────────────────────────────────────────────────

_OPINION = re.compile(
    r"\b(my\s+(take|opinion|view|thoughts|experience|story)|"
    r"opinion|commentary|reaction\s+to|reacting\s+to|"
    r"response\s+to|reply\s+to|responding\s+to|"
    r"hot[- ]take|rant|podcast|debate|interview|"
    r"i\s+(think|believe|feel|argue)|unpopular\s+opinion|"
    r"let'?s\s+talk\s+about|we\s+need\s+to\s+talk|"
    r"the\s+problem\s+with|why\s+i\s+(left|quit|stopped|hate|love)|"
    r"my\s+honest\s+(review|opinion|thoughts))\b",
    re.IGNORECASE,
)

# ── Entertainment — core (high-signal YouTube formats) ───────────────────────

_ENTERTAINMENT_CORE = re.compile(
    r"\b(vlog|challenge|prank|funny|comedy|sketch|"
    r"let'?s\s+play|unboxing|compilation|bloopers?|"
    r"behind\s+the\s+scenes|q\s*&\s*a|storytime|"
    # Music
    r"official\s+(music\s+)?video|official\s+audio|lyric(s)?\s+video|"
    r"music\s+video|\bmv\b|live\s+performance|live\s+at\s+\w+|"
    r"feat\.|ft\.\s*\w|prod\.\s+by|"
    # Gaming
    r"gameplay|speedrun(ning)?|playthrough|let\s+me\s+play|"
    r"full\s+game|no\s+commentary|stream\s+highlights?|"
    # Sports
    r"match\s+(recap|highlights?)|game\s+recap|tournament\s+(recap|highlights?)|"
    r"\bplayoffs?\b|\bfinals?\b|\bnba\b|\bnfl\b|\bfifa\b|\bufc\b|"
    r"premier\s+league|champions\s+league|highlights?\s+reel|"
    # Lifestyle / format
    r"morning\s+routine|night\s+routine|weekly\s+vlog|"
    r"get\s+ready\s+with\s+me|\bgrwm\b|what\s+i\s+eat\s+in\s+a\s+day|"
    r"day\s+in\s+(my|the)\s+life|week\s+in\s+my\s+life|"
    r"room\s+tour|house\s+tour|apartment\s+tour|studio\s+tour|"
    # Challenge / stunt formats
    r"last\s+to\s+(leave|stop|drop|survive|lose)|"
    r"24\s+hours?\s+(in|at|with|challenge)|"
    r"i\s+(tried|spent|ate|lived|survived|tested)\s+\w|"
    # Food / mukbang
    r"\bmukbang\b|\basmr\b|eating\s+\w+|cooking\s+\w+|"
    r"trying\s+\w+\s+(food|snacks?|candy)|restaurant\s+review|"
    # Beauty / fashion
    r"makeup\s+(tutorial|look|transformation)|skincare\s+routine|"
    r"fashion\s+haul|\bhaul\b|outfit\s+(of\s+the\s+day|\w+)|"
    r"\bootd\b|\blookbook\b|glow[- ]?up|transformation\b)\b",
    re.IGNORECASE,
)

# ── Entertainment — extended (weaker signals, need 2+ to fire) ───────────────
# These words alone are ambiguous; we require ≥2 matches to treat as entertainment.

_ENTERTAINMENT_EXT = re.compile(
    r"\b(review|reaction|collab|with\s+(my|the)\s+\w+|"
    r"gaming|\bvs\.?\b|\brap\b|\bsong\b|\balbum\b|trailer|teaser|"
    r"season\s+\d|episode\s+\d|\bep\b\s*\d|short\s+film|"
    r"highlights?|recap|gameplay|stream|twitch|"
    r"cover\s+(song|of)|acoustic\s+version|remix|"
    r"food|recipe|cooking|eating|kitchen|chef|baking|"
    r"workout|fitness|gym\s+\w+|exercise|yoga|meditation|"
    r"travel\s+(vlog|to|in)|exploring|road\s+trip|"
    r"shopping|buying|testing|rating)\b",
    re.IGNORECASE,
)

# ── News signals ──────────────────────────────────────────────────────────────

_NEWS_SIGNAL = re.compile(
    r"\b(breaking(?: news)?|reports?\b|reporting|exclusive|developing|"
    r"investigation|press\s+conference|live\s+(coverage|stream|update)|"
    r"election|government|parliament|senate|congress|"
    r"president|prime\s+minister|white\s+house|"
    r"war\s+in|conflict\s+in|crisis\s+in|attack\s+in|"
    r"economy|inflation|interest\s+rates?)\b",
    re.IGNORECASE,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def _score_text(text: str) -> dict:
    he   = len(_HIGH_EMOTION.findall(text))
    edu  = len(_EDUCATIONAL.findall(text))
    opi  = len(_OPINION.findall(text))
    ent  = len(_ENTERTAINMENT_CORE.findall(text))
    ente = len(_ENTERTAINMENT_EXT.findall(text))
    nws  = len(_NEWS_SIGNAL.findall(text))

    return {
        "high_emotion":      _clamp(he   * 0.30),
        "educational":       _clamp(edu  * 0.30),
        "opinion":           _clamp(opi  * 0.25),
        "entertainment":     _clamp(ent  * 0.35),   # each core match is strong
        "entertainment_ext": _clamp(ente * 0.15),   # extended match is weak
        "news":              _clamp(nws  * 0.20),
    }


# ── Public API ────────────────────────────────────────────────────────────────

@dataclass
class RulesResult:
    response: AnalysisResponse
    high_confidence: bool   # True → skip Gemini; False → still call Gemini for refinement


def check_rules(payload: ContentPayload) -> Optional[RulesResult]:
    """
    Dispatch to the platform-specific rule function.
    Each platform function returns a RulesResult or None.

    TO ADD A PLATFORM:
      1. Implement _rules_<platform>() below using _rules_youtube() as a template.
      2. Add an elif branch here.
      3. Add a branch in classifier.py _build_prompt() if the platform needs
         a custom prompt structure (optional — the generic prompt works for all).
    """
    title   = payload.title or ""
    creator = payload.creator or ""
    text    = f"{title} {payload.visible_text or ''}"

    sig = _score_text(text)
    args = (payload, title, creator, text, sig)

    if payload.platform == "youtube":
        return _rules_youtube(*args)
    if payload.platform == "reddit":
        return _rules_reddit(*args)
    if payload.platform == "x":
        return _rules_x(*args)
    if payload.platform == "news":
        return _rules_news(*args)

    # Unknown future platform — fall through to generic keyword signals.
    return _rules_generic(*args)


def _rules_youtube(payload, title, creator, text, sig) -> Optional[RulesResult]:
    he_count  = len(_HIGH_EMOTION.findall(text))
    ent_count = len(_ENTERTAINMENT_CORE.findall(text))
    ente_count = len(_ENTERTAINMENT_EXT.findall(text))

    # ── 1. Trusted news creator → Credible News ───────────────────────────────
    if _TRUSTED_NEWS_CREATORS.search(creator):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_CREDIBLE_NEWS,
                confidence=0.85,
                reason=f"Creator '{creator}' is a recognised news organisation.",
                scores=Scores(educational=0.45, high_emotion=0.05, credibility_risk=0.05),
            ),
            high_confidence=True,
        )

    # News signal in title from an unknown creator (lower confidence)
    if sig["news"] >= 0.40 and not _ENTERTAINMENT_CORE.search(title):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_CREDIBLE_NEWS,
                confidence=0.55,
                reason="Title contains news-reporting language.",
                scores=Scores(educational=0.35, high_emotion=0.10, credibility_risk=0.20),
            ),
            high_confidence=False,
        )

    # ── 2. High-emotion / rage-bait ───────────────────────────────────────────
    if he_count >= 2 or sig["high_emotion"] >= 0.55:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_HIGH_EMOTION,
                confidence=_clamp(0.65 + he_count * 0.05),
                reason="Title or description contains multiple high-emotion trigger phrases.",
                scores=Scores(
                    educational=_clamp(sig["educational"]),
                    high_emotion=_clamp(sig["high_emotion"] + 0.20),
                    credibility_risk=_clamp(sig["high_emotion"] + 0.15),
                ),
            ),
            high_confidence=False,
        )

    # ── 3. Educational ────────────────────────────────────────────────────────
    # Require 2+ educational signals OR 1 strong one in the title specifically.
    edu_in_title = len(_EDUCATIONAL.findall(title))
    if sig["educational"] >= 0.55 or edu_in_title >= 2 or (
        edu_in_title >= 1 and sig["educational"] >= 0.25
    ):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_EDUCATIONAL,
                confidence=_clamp(0.60 + sig["educational"] * 0.25),
                reason="Title contains clear educational signal words.",
                scores=Scores(
                    educational=_clamp(sig["educational"] + 0.20),
                    high_emotion=_clamp(sig["high_emotion"]),
                    credibility_risk=0.05,
                ),
            ),
            high_confidence=False,
        )

    # ── 4. Opinion / Commentary ───────────────────────────────────────────────
    if sig["opinion"] >= 0.25:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_OPINION,
                confidence=_clamp(0.58 + sig["opinion"] * 0.15),
                reason="Title or description suggests first-person opinion or commentary content.",
                scores=Scores(
                    educational=0.15,
                    high_emotion=_clamp(sig["high_emotion"]),
                    credibility_risk=0.20,
                ),
            ),
            high_confidence=False,
        )

    # ── 5. Entertainment — strong (1+ core match) ─────────────────────────────
    if ent_count >= 1:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_ENTERTAINMENT,
                confidence=_clamp(0.65 + ent_count * 0.05),
                reason=_entertainment_reason(title, ent_count),
                scores=Scores(
                    educational=_clamp(sig["educational"] * 0.5),
                    high_emotion=_clamp(sig["high_emotion"]),
                    credibility_risk=0.05,
                ),
            ),
            high_confidence=False,
        )

    # ── 6. Entertainment — weak (2+ extended matches) ─────────────────────────
    if ente_count >= 2:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_ENTERTAINMENT,
                confidence=_clamp(0.55 + ente_count * 0.04),
                reason="Title or description matches multiple entertainment content indicators.",
                scores=Scores(
                    educational=_clamp(sig["educational"] * 0.5),
                    high_emotion=_clamp(sig["high_emotion"]),
                    credibility_risk=0.05,
                ),
            ),
            high_confidence=False,
        )

    # ── 7. YouTube default ────────────────────────────────────────────────────
    # Most YouTube content is entertainment in the broad sense.
    # Return a low-confidence Entertainment result rather than None so the
    # deterministic fallback path doesn't silently emit "Other".
    # high_confidence=False ensures Gemini still refines this if available.
    return RulesResult(
        response=AnalysisResponse(
            category=CAT_ENTERTAINMENT,
            confidence=0.50,
            reason="No strong category signals detected; defaulting to Entertainment for YouTube content.",
            scores=Scores(educational=0.10, high_emotion=0.05, credibility_risk=0.05),
        ),
        high_confidence=False,
    )


def _entertainment_reason(title: str, match_count: int) -> str:
    """Return a concise, honest reason string for entertainment classification."""
    t = title.lower()
    if any(w in t for w in ("official video", "official audio", "music video", "lyrics", "feat.", "ft.")):
        return "Title indicates a music video or audio release."
    if any(w in t for w in ("gameplay", "let's play", "speedrun", "playthrough")):
        return "Title indicates gaming content."
    if any(w in t for w in ("vlog", "day in", "morning routine", "grwm", "get ready")):
        return "Title indicates lifestyle or vlog content."
    if any(w in t for w in ("challenge", "last to", "24 hours", "i tried", "i spent")):
        return "Title indicates a challenge or creator-experiment format."
    if any(w in t for w in ("highlights", "recap", "vs", "match", "nba", "nfl", "ufc", "fifa")):
        return "Title indicates sports content."
    if any(w in t for w in ("mukbang", "asmr", "eating", "cooking", "recipe")):
        return "Title indicates food or ASMR content."
    if any(w in t for w in ("makeup", "skincare", "haul", "outfit", "fashion", "grwm")):
        return "Title indicates beauty or fashion content."
    if match_count >= 2:
        return "Title contains multiple entertainment format indicators."
    return "Title matches a recognised entertainment content format."


def _rules_reddit(payload, title, creator, text, sig) -> Optional[RulesResult]:
    """
    Reddit-specific classification rules.

    TODO: Implement when Reddit support is added.
    Signals to consider:
      - Subreddit (extractable from URL: /r/<subreddit>/) → strong category signal
        e.g. r/science → Educational, r/worldnews → Credible News, r/AskReddit → Opinion
      - Post flair (often explicit category label)
      - Vote/comment ratio as a rough engagement/emotion proxy
      - NSFW flag → could indicate High-Emotion content

    For now, falls through to generic keyword scoring.
    """
    return _rules_generic(payload, title, creator, text, sig)


def _rules_x(payload, title, creator, text, sig) -> Optional[RulesResult]:
    """
    X (Twitter) specific classification rules.

    TODO: Implement when X support is added.
    Signals to consider:
      - Verified account badge → boosts Credible News confidence
      - Quote-tweet / reply structure → Opinion / Commentary
      - Thread (multiple connected posts) → may be Educational or Opinion
      - Hashtag density → high count correlates with High-Emotion / viral content
      - Short text with no links → likely Opinion

    For now, falls through to generic keyword scoring.
    """
    return _rules_generic(payload, title, creator, text, sig)


def _rules_news(payload, title, creator, text, sig) -> Optional[RulesResult]:
    """
    News article specific classification rules.

    TODO: Implement when news-site support is added.
    Signals to consider:
      - Known publisher domain (already partially handled in _TRUSTED_NEWS_CREATORS
        via creator field — reuse or extend that list here)
      - Article section/category from URL path (e.g. /opinion/, /technology/, /sport/)
      - Byline presence → boosts Credible News
      - Opinion section URL → Opinion / Commentary with high confidence

    For now, defaults to Credible News with moderate confidence if the trusted-
    creator check passes, otherwise falls to generic scoring.
    """
    # Trusted news creators are publication-level; applies directly to news articles.
    if _TRUSTED_NEWS_CREATORS.search(creator) or _TRUSTED_NEWS_CREATORS.search(payload.url or ""):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_CREDIBLE_NEWS,
                confidence=0.78,
                reason="Article is from a recognised news organisation.",
                scores=Scores(educational=0.40, high_emotion=0.05, credibility_risk=0.08),
            ),
            high_confidence=True,
        )

    # Opinion URL signal — many publishers use /opinion/ or /comment/ in the path.
    if re.search(r"/opinion[s]?/|/commentary/|/editorial/|/columns?/", payload.url or ""):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_OPINION,
                confidence=0.72,
                reason="Article URL path indicates an opinion or editorial section.",
                scores=Scores(educational=0.15, high_emotion=0.15, credibility_risk=0.25),
            ),
            high_confidence=False,
        )

    return _rules_generic(payload, title, creator, text, sig)


def _rules_generic(payload, title, creator, text, sig) -> Optional[RulesResult]:
    """Minimal signal-based rules for platforms not yet specialised."""
    if sig["high_emotion"] >= 0.55:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_HIGH_EMOTION,
                confidence=0.60,
                reason="Content contains high-emotion language.",
                scores=Scores(
                    educational=0.10, high_emotion=_clamp(sig["high_emotion"]), credibility_risk=0.30
                ),
            ),
            high_confidence=False,
        )
    if sig["educational"] >= 0.30:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_EDUCATIONAL,
                confidence=0.60,
                reason="Content contains educational signal words.",
                scores=Scores(
                    educational=_clamp(sig["educational"]), high_emotion=0.10, credibility_risk=0.05
                ),
            ),
            high_confidence=False,
        )
    return None
