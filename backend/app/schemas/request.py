from pydantic import BaseModel, Field
from typing import Literal, Optional


class ContentPayload(BaseModel):
    """Normalized content payload sent by the Chrome extension."""

    platform: Literal["youtube", "reddit", "x", "news"]
    content_type: Literal["video", "post", "article"]
    url: str                        # plain str — extension may send chrome-extension:// or odd urls
    title: Optional[str] = None
    creator: Optional[str] = None
    visible_text: Optional[str] = None
    captured_at: str                # ISO-8601 string from extension


class HistoryItem(BaseModel):
    """
    A single classified item from the extension's session history.

    The extension stores content payloads in chrome.storage.local.
    Category is embedded by the extension when it has been classified;
    it may be absent for items that were detected but not yet analysed.
    """
    url: str
    title: Optional[str] = None
    creator: Optional[str] = None
    platform: Optional[str] = None
    category: Optional[str] = None      # e.g. "Educational", "Entertainment"
    captured_at: Optional[str] = None   # ISO-8601


class SessionInsightRequest(BaseModel):
    """Request body for POST /analyze/session."""
    items: list[HistoryItem] = Field(..., min_length=1, max_length=50)
