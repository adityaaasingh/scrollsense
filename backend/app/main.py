import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import analyze

settings = get_settings()

logging.basicConfig(level=settings.log_level)

app = FastAPI(
    title="ScrollSense API",
    version="0.1.0",
    description="Content classification backend for the ScrollSense Chrome extension.",
)

# CORS — allow the extension's origin and local dev servers.
# Chrome extensions send requests from chrome-extension://<id>, which is not a
# standard origin for CORS; allow_origins=["*"] during local dev is fine.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Routers
app.include_router(analyze.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
