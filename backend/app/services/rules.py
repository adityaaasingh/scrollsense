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

# ── Reddit-specific title patterns ────────────────────────────────────────────
# These acronyms/prefixes are Reddit conventions that directly signal content type.

_REDDIT_TIL        = re.compile(r"^TIL\b",                                          re.IGNORECASE)
_REDDIT_ELI5       = re.compile(r"^ELI5\b|explain\s+like\s+i'?m?\s+(five|5)\b",    re.IGNORECASE)
_REDDIT_AMA        = re.compile(r"^AMA[\s:]|\bI\s+am\s+a\b.{0,60}\bAMA\b|\bask\s+me\s+anything\b", re.IGNORECASE)
_REDDIT_CMV        = re.compile(r"^CMV[\s:]|change\s+my\s+view\b",                  re.IGNORECASE)
_REDDIT_PSA        = re.compile(r"^PSA[\s:]|public\s+service\s+announ",             re.IGNORECASE)
_REDDIT_DISCUSSION = re.compile(r"^\[?(?:discussion|meta|analysis)\]?[\s:]",        re.IGNORECASE)
_REDDIT_MEME       = re.compile(r"\b(meme|shitpost|wholesome|cursed|based|dank)\b", re.IGNORECASE)

# ── Reddit subreddit → (category, confidence, high_confidence) ────────────────
# creator field contains the subreddit in "r/name" format (set by the extractor).
# Slug is lowercased, r/ prefix stripped before lookup.

_REDDIT_SUBREDDIT_MAP: dict[str, tuple[str, float, bool]] = {
    # ── Credible News ─────────────────────────────────────────────────────────
    "worldnews":        (CAT_CREDIBLE_NEWS, 0.80, True),
    "news":             (CAT_CREDIBLE_NEWS, 0.75, True),
    "politics":         (CAT_CREDIBLE_NEWS, 0.60, False),  # often commentary
    "geopolitics":      (CAT_CREDIBLE_NEWS, 0.72, True),
    "inthenews":        (CAT_CREDIBLE_NEWS, 0.70, True),
    "usnews":           (CAT_CREDIBLE_NEWS, 0.72, True),
    "ukpolitics":       (CAT_CREDIBLE_NEWS, 0.65, False),
    "europe":           (CAT_CREDIBLE_NEWS, 0.62, False),
    "economics":        (CAT_CREDIBLE_NEWS, 0.65, False),
    "technology":       (CAT_CREDIBLE_NEWS, 0.60, False),

    # ── Educational ───────────────────────────────────────────────────────────
    "science":              (CAT_EDUCATIONAL, 0.82, True),
    "explainlikeimfive":    (CAT_EDUCATIONAL, 0.88, True),
    "eli5":                 (CAT_EDUCATIONAL, 0.88, True),
    "askscience":           (CAT_EDUCATIONAL, 0.80, True),
    "history":              (CAT_EDUCATIONAL, 0.78, True),
    "todayilearned":        (CAT_EDUCATIONAL, 0.78, True),
    "til":                  (CAT_EDUCATIONAL, 0.78, True),
    "machinelearning":      (CAT_EDUCATIONAL, 0.75, True),
    "learnprogramming":     (CAT_EDUCATIONAL, 0.82, True),
    "learnpython":          (CAT_EDUCATIONAL, 0.80, True),
    "programming":          (CAT_EDUCATIONAL, 0.68, False),
    "compsci":              (CAT_EDUCATIONAL, 0.72, True),
    "datascience":          (CAT_EDUCATIONAL, 0.72, True),
    "space":                (CAT_EDUCATIONAL, 0.72, True),
    "physics":              (CAT_EDUCATIONAL, 0.78, True),
    "biology":              (CAT_EDUCATIONAL, 0.75, True),
    "chemistry":            (CAT_EDUCATIONAL, 0.75, True),
    "math":                 (CAT_EDUCATIONAL, 0.78, True),
    "mathematics":          (CAT_EDUCATIONAL, 0.78, True),
    "personalfinance":      (CAT_EDUCATIONAL, 0.65, False),
    "investing":            (CAT_EDUCATIONAL, 0.62, False),

    # ── Opinion / Commentary ──────────────────────────────────────────────────
    "askreddit":            (CAT_OPINION, 0.82, True),
    "unpopularopinion":     (CAT_OPINION, 0.85, True),
    "changemyview":         (CAT_OPINION, 0.85, True),
    "cmv":                  (CAT_OPINION, 0.85, True),
    "rant":                 (CAT_OPINION, 0.78, True),
    "trueoffmychest":       (CAT_OPINION, 0.70, False),
    "offmychest":           (CAT_OPINION, 0.68, False),
    "amitheasshole":        (CAT_OPINION, 0.78, True),
    "iama":                 (CAT_OPINION, 0.78, False),   # AMA prefix pattern handles high-conf cases
    "relationship_advice":  (CAT_OPINION, 0.70, False),
    "tifu":                 (CAT_OPINION, 0.65, False),
    "confession":           (CAT_OPINION, 0.65, False),
    "legaladvice":          (CAT_OPINION, 0.62, False),

    # ── High-Emotion / Rage-Bait ──────────────────────────────────────────────
    "mildlyinfuriating":    (CAT_HIGH_EMOTION, 0.78, True),
    "publicfreakout":       (CAT_HIGH_EMOTION, 0.82, True),
    "facepalm":             (CAT_HIGH_EMOTION, 0.72, True),
    "trashy":               (CAT_HIGH_EMOTION, 0.72, True),
    "cringe":               (CAT_HIGH_EMOTION, 0.68, False),
    "iamatotalpieceofshit": (CAT_HIGH_EMOTION, 0.75, True),
    "quityourbullshit":     (CAT_HIGH_EMOTION, 0.72, True),
    "nottheonion":          (CAT_HIGH_EMOTION, 0.58, False),
    "rage":                 (CAT_HIGH_EMOTION, 0.78, True),

    # ── Entertainment ─────────────────────────────────────────────────────────
    "funny":            (CAT_ENTERTAINMENT, 0.85, True),
    "memes":            (CAT_ENTERTAINMENT, 0.85, True),
    "dankmemes":        (CAT_ENTERTAINMENT, 0.85, True),
    "me_irl":           (CAT_ENTERTAINMENT, 0.80, True),
    "videos":           (CAT_ENTERTAINMENT, 0.68, False),
    "gifs":             (CAT_ENTERTAINMENT, 0.72, True),
    "gaming":           (CAT_ENTERTAINMENT, 0.80, True),
    "pcgaming":         (CAT_ENTERTAINMENT, 0.78, True),
    "movies":           (CAT_ENTERTAINMENT, 0.70, False),
    "television":       (CAT_ENTERTAINMENT, 0.70, False),
    "music":            (CAT_ENTERTAINMENT, 0.70, False),
    "sports":           (CAT_ENTERTAINMENT, 0.78, True),
    "nba":              (CAT_ENTERTAINMENT, 0.80, True),
    "nfl":              (CAT_ENTERTAINMENT, 0.80, True),
    "soccer":           (CAT_ENTERTAINMENT, 0.80, True),
    "formula1":         (CAT_ENTERTAINMENT, 0.80, True),
    "food":             (CAT_ENTERTAINMENT, 0.70, False),
    "pics":             (CAT_ENTERTAINMENT, 0.62, False),
    "aww":              (CAT_ENTERTAINMENT, 0.82, True),
    "mademesmile":      (CAT_ENTERTAINMENT, 0.78, True),
    "oddlysatisfying":  (CAT_ENTERTAINMENT, 0.78, True),
    "nextfuckinglevel": (CAT_ENTERTAINMENT, 0.68, False),
}


def _reddit_slug(creator: str) -> str:
    """Normalize 'r/subredditName' → 'subredditname' for map lookup."""
    s = creator.strip().lower()
    return s[2:] if s.startswith("r/") else s


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
    he_count   = len(_HIGH_EMOTION.findall(text))
    ent_count  = len(_ENTERTAINMENT_CORE.findall(text))
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
    Reddit classification.

    Priority order:
      1. High-confidence subreddit map (e.g. r/science → Educational, r/funny → Entertainment)
      2. Reddit title-prefix conventions (TIL, ELI5, CMV, AMA, PSA)
      3. High-emotion keyword signals (same regex as YouTube)
      4. Educational keyword signals
      5. Opinion keyword signals
      6. News keyword signals
      7. Low-confidence subreddit map (high_confidence=False entries used as tiebreaker)
      8. Meme/entertainment text signals
      9. Default: Other (not Entertainment — Reddit content is too varied)
    """
    slug = _reddit_slug(creator)
    he_count = len(_HIGH_EMOTION.findall(text))

    # ── 1. Subreddit map — high-confidence entries ────────────────────────────
    if slug in _REDDIT_SUBREDDIT_MAP:
        cat, conf, hc = _REDDIT_SUBREDDIT_MAP[slug]
        if hc:
            return RulesResult(
                response=AnalysisResponse(
                    category=cat,
                    confidence=conf,
                    reason=f"Subreddit r/{slug} is a strong indicator of {cat} content.",
                    scores=_reddit_scores(cat, sig),
                ),
                high_confidence=True,
            )

    # ── 2. Reddit title-prefix conventions ───────────────────────────────────
    # These are explicit community signals, more reliable than generic keywords.

    if _REDDIT_TIL.search(title):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_EDUCATIONAL,
                confidence=0.80,
                reason="Post begins with 'TIL' — a Today I Learned educational post.",
                scores=Scores(educational=0.80, high_emotion=0.05, credibility_risk=0.10),
            ),
            high_confidence=True,
        )

    if _REDDIT_ELI5.search(title):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_EDUCATIONAL,
                confidence=0.82,
                reason="Post is an Explain Like I'm Five (ELI5) request.",
                scores=Scores(educational=0.82, high_emotion=0.02, credibility_risk=0.05),
            ),
            high_confidence=True,
        )

    if _REDDIT_AMA.search(title):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_OPINION,
                confidence=0.78,
                reason="Post is an Ask Me Anything (AMA) — first-person Q&A format.",
                scores=Scores(educational=0.30, high_emotion=0.05, credibility_risk=0.10),
            ),
            high_confidence=False,
        )

    if _REDDIT_CMV.search(title):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_OPINION,
                confidence=0.82,
                reason="Post is a Change My View (CMV) — explicit opinion/debate format.",
                scores=Scores(educational=0.25, high_emotion=0.15, credibility_risk=0.25),
            ),
            high_confidence=True,
        )

    if _REDDIT_PSA.search(title):
        # PSA can be news-adjacent or opinion; lean toward Opinion with Gemini refinement.
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_OPINION,
                confidence=0.60,
                reason="Post is labeled as a Public Service Announcement (PSA).",
                scores=Scores(educational=0.30, high_emotion=0.15, credibility_risk=0.20),
            ),
            high_confidence=False,
        )

    if _REDDIT_DISCUSSION.search(title):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_OPINION,
                confidence=0.62,
                reason="Post is explicitly flagged as a discussion or meta thread.",
                scores=Scores(educational=0.20, high_emotion=0.15, credibility_risk=0.20),
            ),
            high_confidence=False,
        )

    # ── 3. High-emotion signals ───────────────────────────────────────────────
    if he_count >= 2 or sig["high_emotion"] >= 0.55:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_HIGH_EMOTION,
                confidence=_clamp(0.60 + he_count * 0.05),
                reason="Title or post body contains multiple high-emotion trigger phrases.",
                scores=Scores(
                    educational=_clamp(sig["educational"] * 0.5),
                    high_emotion=_clamp(sig["high_emotion"] + 0.20),
                    credibility_risk=_clamp(sig["high_emotion"] + 0.10),
                ),
            ),
            high_confidence=False,
        )

    # ── 4. Educational keyword signals ───────────────────────────────────────
    edu_in_title = len(_EDUCATIONAL.findall(title))
    if sig["educational"] >= 0.55 or edu_in_title >= 2 or (
        edu_in_title >= 1 and sig["educational"] >= 0.25
    ):
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_EDUCATIONAL,
                confidence=_clamp(0.58 + sig["educational"] * 0.20),
                reason="Post title contains educational signal words.",
                scores=Scores(
                    educational=_clamp(sig["educational"] + 0.20),
                    high_emotion=_clamp(sig["high_emotion"]),
                    credibility_risk=0.10,
                ),
            ),
            high_confidence=False,
        )

    # ── 5. Opinion keyword signals ────────────────────────────────────────────
    if sig["opinion"] >= 0.25:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_OPINION,
                confidence=_clamp(0.55 + sig["opinion"] * 0.15),
                reason="Post title or body suggests first-person opinion or discussion.",
                scores=Scores(
                    educational=0.15,
                    high_emotion=_clamp(sig["high_emotion"]),
                    credibility_risk=0.25,
                ),
            ),
            high_confidence=False,
        )

    # ── 6. News keyword signals ───────────────────────────────────────────────
    if sig["news"] >= 0.40:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_CREDIBLE_NEWS,
                confidence=0.55,
                reason="Post title contains news-reporting language.",
                scores=Scores(educational=0.30, high_emotion=0.10, credibility_risk=0.25),
            ),
            high_confidence=False,
        )

    # ── 7. Subreddit map — medium-confidence entries (high_confidence=False) ──
    if slug in _REDDIT_SUBREDDIT_MAP:
        cat, conf, _ = _REDDIT_SUBREDDIT_MAP[slug]
        return RulesResult(
            response=AnalysisResponse(
                category=cat,
                confidence=conf,
                reason=f"Subreddit r/{slug} suggests {cat} content.",
                scores=_reddit_scores(cat, sig),
            ),
            high_confidence=False,
        )

    # ── 8. Meme / entertainment text signals ──────────────────────────────────
    if _REDDIT_MEME.search(text) or sig["entertainment"] >= 0.35:
        return RulesResult(
            response=AnalysisResponse(
                category=CAT_ENTERTAINMENT,
                confidence=0.55,
                reason="Post content matches entertainment or meme-format signals.",
                scores=Scores(educational=0.05, high_emotion=0.15, credibility_risk=0.10),
            ),
            high_confidence=False,
        )

    # ── 9. Reddit default — Other (let Gemini decide) ─────────────────────────
    # Reddit content is diverse enough that Entertainment is not a safe default.
    return RulesResult(
        response=AnalysisResponse(
            category=CAT_OTHER,
            confidence=0.40,
            reason="No strong category signals detected for this Reddit post.",
            scores=Scores(
                educational=_clamp(sig["educational"]),
                high_emotion=_clamp(sig["high_emotion"]),
                credibility_risk=0.15,
            ),
        ),
        high_confidence=False,
    )


def _reddit_scores(category: str, sig: dict) -> Scores:
    """Return sensible baseline Scores for a Reddit subreddit-mapped result."""
    base = {
        CAT_CREDIBLE_NEWS:  Scores(educational=0.35, high_emotion=0.10, credibility_risk=0.15),
        CAT_EDUCATIONAL:    Scores(educational=0.75, high_emotion=0.05, credibility_risk=0.08),
        CAT_OPINION:        Scores(educational=0.15, high_emotion=0.20, credibility_risk=0.30),
        CAT_HIGH_EMOTION:   Scores(educational=0.05, high_emotion=0.80, credibility_risk=0.50),
        CAT_ENTERTAINMENT:  Scores(educational=0.05, high_emotion=0.15, credibility_risk=0.08),
        CAT_OTHER:          Scores(educational=0.10, high_emotion=0.10, credibility_risk=0.15),
    }
    scores = base.get(category, base[CAT_OTHER])
    # Layer in any keyword signals detected in the text.
    return Scores(
        educational=_clamp(max(scores.educational, sig["educational"])),
        high_emotion=_clamp(max(scores.high_emotion, sig["high_emotion"])),
        credibility_risk=scores.credibility_risk,
    )


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
    """News article specific classification rules."""
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
