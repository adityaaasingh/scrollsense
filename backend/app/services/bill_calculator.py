"""
bill_calculator.py — The Attention Bill

Calculates the monetary value platforms extract from your attention,
plus "trade" equivalents showing what else you could have done.
"""

from datetime import datetime
from typing import Any

# Revenue per user hour (USD) — derived from public earnings reports
# YouTube: ~$31.5B ad revenue / ~2B users / ~730h avg/year ≈ $0.021/h
# TikTok: ~$20B revenue / ~1.5B users / ~900h avg/year ≈ $0.015/h
# Instagram: ~$45B revenue / ~2B users / ~1560h avg/year ≈ $0.014/h
# X/Twitter: ~$3B revenue / ~500M users / ~1200h avg/year ≈ $0.005/h
# Reddit: ~$1B revenue / ~500M users / ~600h avg/year ≈ $0.003/h
PLATFORM_RATES = {
    "youtube": {"rate_per_hour": 0.021, "label": "YouTube"},
    "tiktok": {"rate_per_hour": 0.015, "label": "TikTok"},
    "instagram": {"rate_per_hour": 0.014, "label": "Instagram"},
    "x": {"rate_per_hour": 0.005, "label": "X / Twitter"},
    "reddit": {"rate_per_hour": 0.003, "label": "Reddit"},
}

# Average watch duration per video (minutes) — estimate for Takeout
# Takeout doesn't include actual watch time, so we estimate
AVG_WATCH_MINUTES = 8.0

# Trade equivalents: what you could do with X hours
TRADE_ITEMS = [
    {"label": "books read", "hours_per_unit": 5.0, "emoji": "book"},
    {"label": "online courses completed", "hours_per_unit": 10.0, "emoji": "graduation"},
    {"label": "home-cooked meals", "hours_per_unit": 1.5, "emoji": "cooking"},
    {"label": "workouts", "hours_per_unit": 1.0, "emoji": "fitness"},
    {"label": "full nights of sleep", "hours_per_unit": 8.0, "emoji": "sleep"},
    {"label": "movies watched", "hours_per_unit": 2.0, "emoji": "movie"},
    {"label": "walks in nature", "hours_per_unit": 1.0, "emoji": "nature"},
]


def calculate_bill(
    classified_videos: list[dict[str, Any]],
    platform: str = "youtube",
    avg_watch_minutes: float = AVG_WATCH_MINUTES,
) -> dict[str, Any]:
    """
    Calculate the attention bill from classified video history.

    Each video in classified_videos should have:
      - category: str
      - title: str
      - channel: str (optional)
      - watched_at: str (optional, ISO-8601)
    """
    total_videos = len(classified_videos)
    total_hours = (total_videos * avg_watch_minutes) / 60.0

    # Category breakdown
    category_hours: dict[str, float] = {}
    category_counts: dict[str, int] = {}
    for video in classified_videos:
        cat = video.get("category", "Other")
        category_counts[cat] = category_counts.get(cat, 0) + 1
        category_hours[cat] = category_hours.get(cat, 0) + (avg_watch_minutes / 60.0)

    # Monetary value
    rate_info = PLATFORM_RATES.get(platform, PLATFORM_RATES["youtube"])
    rate_per_hour = rate_info["rate_per_hour"]
    total_value = total_hours * rate_per_hour

    # Per-category value
    category_values = {
        cat: hours * rate_per_hour
        for cat, hours in category_hours.items()
    }

    # Date range for projections
    timestamps = [v.get("watched_at", "") for v in classified_videos if v.get("watched_at")]
    days_span = 1
    if len(timestamps) >= 2:
        sorted_ts = sorted(timestamps)
        try:
            start = datetime.fromisoformat(sorted_ts[0].replace("Z", "+00:00"))
            end = datetime.fromisoformat(sorted_ts[-1].replace("Z", "+00:00"))
            days_span = max((end - start).days, 1)
        except (ValueError, TypeError):
            days_span = 30  # fallback

    # Projections
    daily_hours = total_hours / days_span
    weekly_hours = daily_hours * 7
    monthly_hours = daily_hours * 30
    yearly_hours = daily_hours * 365

    weekly_value = weekly_hours * rate_per_hour
    monthly_value = monthly_hours * rate_per_hour
    yearly_value = yearly_hours * rate_per_hour

    # Trade equivalents (based on total hours)
    trades = []
    for item in TRADE_ITEMS:
        count = total_hours / item["hours_per_unit"]
        if count >= 0.5:
            trades.append({
                "label": item["label"],
                "count": round(count, 1),
                "emoji": item["emoji"],
            })

    # Line items for the receipt
    line_items = []
    for cat in sorted(category_hours.keys(), key=lambda c: category_hours[c], reverse=True):
        hours = category_hours[cat]
        value = category_values[cat]
        count = category_counts[cat]
        line_items.append({
            "category": cat,
            "videos": count,
            "hours": round(hours, 1),
            "value": round(value, 4),
        })

    return {
        "platform": rate_info["label"],
        "total_videos": total_videos,
        "total_hours": round(total_hours, 1),
        "total_value": round(total_value, 4),
        "days_analyzed": days_span,
        "avg_watch_minutes": avg_watch_minutes,
        "line_items": line_items,
        "projections": {
            "weekly": {"hours": round(weekly_hours, 1), "value": round(weekly_value, 4)},
            "monthly": {"hours": round(monthly_hours, 1), "value": round(monthly_value, 4)},
            "yearly": {"hours": round(yearly_hours, 1), "value": round(yearly_value, 4)},
        },
        "trades": trades,
        "rate_per_hour": rate_per_hour,
    }
