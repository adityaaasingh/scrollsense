"""
takeout_parser.py — Parse Google Takeout YouTube watch-history.json

Takeout format (array of objects):
[
  {
    "header": "YouTube",
    "title": "Watched Some Video Title",
    "titleUrl": "https://www.youtube.com/watch?v=XXXXX",
    "subtitles": [{"name": "Channel Name", "url": "https://..."}],
    "time": "2025-12-01T14:30:00.000Z",
    "products": ["YouTube"],
    "activityControls": ["YouTube watch history"]
  },
  ...
]
"""

import logging
from datetime import datetime
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ParsedVideo(BaseModel):
    title: str
    channel: str
    url: str
    watched_at: str  # ISO-8601
    video_id: str | None = None


class TakeoutStats(BaseModel):
    total_entries: int
    parsed_videos: int
    skipped: int
    date_range_start: str | None = None
    date_range_end: str | None = None


def parse_takeout(raw_entries: list[dict[str, Any]]) -> tuple[list[ParsedVideo], TakeoutStats]:
    """
    Parse YouTube Takeout watch-history.json entries.
    Returns (parsed_videos, stats).
    Skips entries that are ads, removed videos, or non-video items.
    """
    videos: list[ParsedVideo] = []
    skipped = 0
    timestamps: list[str] = []

    for entry in raw_entries:
        title_raw = entry.get("title", "")

        # Skip non-video entries
        if not title_raw or entry.get("header") not in ("YouTube", None):
            skipped += 1
            continue

        # Skip ads
        if title_raw.startswith("Visited") or "From Google Ads" in title_raw:
            skipped += 1
            continue

        # Strip "Watched " prefix that Takeout adds
        title = title_raw.removeprefix("Watched ")

        # Skip removed/unavailable videos
        if title in ("a video that has been removed", ""):
            skipped += 1
            continue

        # Extract channel from subtitles
        subtitles = entry.get("subtitles", [])
        channel = subtitles[0].get("name", "Unknown") if subtitles else "Unknown"

        # Extract URL and video ID
        url = entry.get("titleUrl", "")
        video_id = None
        if "watch?v=" in url:
            video_id = url.split("watch?v=")[-1].split("&")[0]

        # Timestamp
        time_str = entry.get("time", "")
        if time_str:
            timestamps.append(time_str)

        videos.append(ParsedVideo(
            title=title,
            channel=channel,
            url=url,
            watched_at=time_str,
            video_id=video_id,
        ))

    # Compute date range
    date_start = None
    date_end = None
    if timestamps:
        sorted_ts = sorted(timestamps)
        date_start = sorted_ts[0]
        date_end = sorted_ts[-1]

    stats = TakeoutStats(
        total_entries=len(raw_entries),
        parsed_videos=len(videos),
        skipped=skipped,
        date_range_start=date_start,
        date_range_end=date_end,
    )

    logger.info("Takeout parsed: %d videos from %d entries (%d skipped)", len(videos), len(raw_entries), skipped)
    return videos, stats
