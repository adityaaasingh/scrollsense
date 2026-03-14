# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # then add GEMINI_API_KEY
uvicorn app.main:app --reload   # http://localhost:8000
```

### Dashboard (Vite React app — must rebuild after any change)
```bash
cd extension/dashboard
npm install
npm run build   # outputs dashboard.html + dashboard-assets/ into extension/
```

The extension folder is loaded directly into Chrome — there is no JS bundler for the core extension files (background.js, sidepanel.js, content.js). Only the dashboard subdirectory uses Vite.

### Reload after changes
- **Backend changes**: uvicorn auto-reloads with `--reload`
- **Extension changes**: `chrome://extensions` → reload ScrollSense
- **Dashboard changes**: `npm run build` in `extension/dashboard/`, then reload extension

## Architecture

### Data flow
```
content.js (runs on YouTube/Reddit/X)
  → chrome.runtime.sendMessage(CONTENT_DETECTED)
  → background.js (service worker)
      → saves to chrome.storage.local
      → POST /analyze/live  →  classifier.py (rules → Gemini → fallback)
      → saves result, notifies sidepanel.js via messaging.js
      → appends to scrollsense_all_time_log (fire-and-forget)
      → POST /analyze/session (fire-and-forget, needs 3+ items)
```

### Classification pipeline (backend)
Three stages in `services/classifier.py`:
1. **Rules** (`services/rules.py`) — synchronous keyword/regex matching; if `high_confidence=True`, skips Gemini entirely
2. **Gemini** (`services/gemini_client.py`) — `gemini-2.0-flash`, 8s timeout, JSON response parsed and validated
3. **Fallback** — rules result or plain "Other"; never raises, never hangs

### Storage keys (`extension/utils/storage.js`)
| Key | Purpose |
|-----|---------|
| `scrollsense_current_content` | Most recently detected content payload |
| `scrollsense_current_analysis` | Latest classification result |
| `scrollsense_session_history` | Current session, max 50 items, newest first |
| `scrollsense_last_result` | Persisted for panel restore on reopen |
| `scrollsense_session_insights` | Latest `/analyze/session` result |
| `scrollsense_all_time_log` | Unbounded log of all classified items (for dashboard) |

### Backend endpoints
| Endpoint | Purpose |
|----------|---------|
| `POST /analyze/live` | Classify a single content item in real time |
| `POST /analyze/session` | Session pattern analysis (label + insights + recommendations) |
| `POST /analyze/dashboard` | Time-block analysis of all-time log |
| `GET /health` | Liveness check |

### Dashboard (extension/dashboard/)
Vite + React app that reads `chrome.storage.local` directly (extension page context). Builds into `extension/dashboard.html` + `extension/dashboard-assets/`. Uses React Three Fiber for the 3D scene (MoodOrb with GLSL shaders, Terrain with animated vertex heights, Particles). `@react-three/postprocessing` provides Bloom.

### Adding a platform
1. Implement `extension/utils/extractors/<platform>.js`
2. Register it in `content.js` `EXTRACTORS` map
3. Add `host_permissions` and `content_scripts.matches` in `manifest.json`
4. Add a `_rules_<platform>()` function in `backend/app/services/rules.py`

## Key constraints
- Backend must run on `localhost:8000` — hardcoded in `extension/utils/api.js`
- `GEMINI_API_KEY` in `backend/.env` — classification degrades to rules-only without it
- `chrome.storage.local` is per-browser-profile and not synced across devices
- Category strings must match exactly across Python and JS: `"Educational"`, `"Entertainment"`, `"Credible News"`, `"Opinion / Commentary"`, `"High-Emotion / Rage-Bait"`, `"Other"`
- The session history (50-item cap) and all-time log (no cap) are separate keys; only the all-time log feeds the dashboard
