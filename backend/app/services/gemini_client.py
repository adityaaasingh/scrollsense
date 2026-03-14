"""
gemini_client.py — async wrapper around the Gemini generative API.
Returns raw text; all parsing lives in classifier.py.

Uses asyncio.to_thread() to keep FastAPI's event loop unblocked since
google-generativeai's generate_content() is synchronous.

Timeout is enforced by the caller (classifier.py) via asyncio.wait_for so
we never hang the event loop waiting on a slow API response.
"""
import asyncio
import logging

import google.generativeai as genai

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_model: genai.GenerativeModel | None = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                max_output_tokens=256,
            ),
        )
        logger.info("Gemini model initialised: %s", settings.gemini_model)
    return _model


async def generate(prompt: str) -> str:
    """
    Send prompt to Gemini and return raw response text.
    Runs the blocking SDK call in a thread pool so the event loop stays free.
    Raises on any API or network error — callers must handle.
    """
    model = _get_model()
    response = await asyncio.to_thread(model.generate_content, prompt)
    return response.text
