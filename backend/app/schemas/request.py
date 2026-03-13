from pydantic import BaseModel, HttpUrl
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
