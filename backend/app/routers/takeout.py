"""
takeout.py — Google Takeout YouTube watch-history upload + batch classification
"""

import json
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.schemas.request import ContentPayload
from app.schemas.response import TakeoutUploadResponse, ClassifiedVideo
from app.services.takeout_parser import parse_takeout
from app.services.classifier import classify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/takeout", tags=["takeout"])


@router.post("/upload", response_model=TakeoutUploadResponse)
async def upload_takeout(file: UploadFile = File(...)):
    """
    Upload a Google Takeout watch-history.json file.
    Parses the JSON, batch classifies each video, returns results.
    """
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Please upload a .json file")

    try:
        contents = await file.read()
        raw_entries = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    if not isinstance(raw_entries, list):
        raise HTTPException(status_code=400, detail="Expected a JSON array of watch history entries")

    # Parse takeout format
    videos, stats = parse_takeout(raw_entries)

    if not videos:
        raise HTTPException(status_code=400, detail="No valid video entries found in the file")

    # Batch classify each video using the existing pipeline
    classified: list[ClassifiedVideo] = []
    for video in videos:
        payload = ContentPayload(
            platform="youtube",
            content_type="video",
            url=video.url or "https://youtube.com",
            title=video.title,
            creator=video.channel,
            visible_text=video.title,
            captured_at=video.watched_at or "2025-01-01T00:00:00Z",
        )

        result = await classify(payload)

        classified.append(ClassifiedVideo(
            title=video.title,
            channel=video.channel,
            url=video.url,
            watched_at=video.watched_at,
            video_id=video.video_id,
            category=result.category,
            confidence=result.confidence,
            scores=result.scores,
        ))

    # Compute category summary
    category_counts: dict[str, int] = {}
    for v in classified:
        category_counts[v.category] = category_counts.get(v.category, 0) + 1

    # Time-of-day distribution
    hour_counts: dict[int, int] = {}
    for v in classified:
        if v.watched_at:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(v.watched_at.replace("Z", "+00:00"))
                hour_counts[dt.hour] = hour_counts.get(dt.hour, 0) + 1
            except (ValueError, TypeError):
                pass

    # Top channels
    channel_cats: dict[str, dict[str, int]] = {}
    channel_counts: dict[str, int] = {}
    for v in classified:
        ch = v.channel
        channel_counts[ch] = channel_counts.get(ch, 0) + 1
        if ch not in channel_cats:
            channel_cats[ch] = {}
        channel_cats[ch][v.category] = channel_cats[ch].get(v.category, 0) + 1

    top_channels = []
    for ch, count in sorted(channel_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
        primary_cat = max(channel_cats[ch], key=channel_cats[ch].get)
        top_channels.append({
            "channel": ch,
            "count": count,
            "primary_category": primary_cat,
        })

    return TakeoutUploadResponse(
        videos=classified,
        stats={
            "total_entries": stats.total_entries,
            "parsed_videos": stats.parsed_videos,
            "skipped": stats.skipped,
            "classified": len(classified),
            "date_range_start": stats.date_range_start,
            "date_range_end": stats.date_range_end,
        },
        category_counts=category_counts,
        hour_distribution=hour_counts,
        top_channels=top_channels,
    )
