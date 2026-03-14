import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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


# ── Dashboard (static) ────────────────────────────────────────────────────────
# Served at http://localhost:8000/dashboard/
# dashboard/ lives at repo root: scrollsense/dashboard/
# main.py lives at:              scrollsense/backend/app/main.py
# Relative path:                 ../../dashboard

_DASHBOARD_DIR = Path(__file__).resolve().parent.parent.parent / "dashboard"

if _DASHBOARD_DIR.is_dir():
    app.mount(
        "/dashboard",
        StaticFiles(directory=_DASHBOARD_DIR, html=True),
        name="dashboard",
    )
