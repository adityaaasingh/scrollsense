import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import analyze, takeout, bill, auth

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
    allow_origins=settings.cors_origins or ["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# Routers
app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(takeout.router)
app.include_router(bill.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
