# ScrollSense

A Chrome extension that classifies YouTube videos in real time — helping you understand what kind of content you're watching before you fall into a rabbit hole.

## What it does

Open any YouTube video and ScrollSense automatically detects it, sends the metadata to a local AI backend, and displays a classification in the side panel:

- **Category** — Educational, Entertainment, Credible News, Opinion / Commentary, High-Emotion / Rage-Bait, or Other
- **Confidence** — how certain the classifier is
- **Signal breakdown** — Educational, Emotional, and Credibility Risk scores
- **Session history** — recent videos you've visited this session

## Tech stack

| Layer | Stack |
|-------|-------|
| Extension | Chrome MV3, side panel API, content scripts |
| Classification | FastAPI + Google Gemini 2.0 Flash |
| Fallback | Rule-based keyword classifier (no API call needed) |

## Project layout

```
scrollsense/
├── extension/          # Chrome extension (load unpacked)
│   ├── manifest.json
│   ├── background.js   # Service worker — message routing & storage
│   ├── content.js      # YouTube metadata extraction (SPA-aware)
│   ├── sidepanel.html/js/css
│   └── utils/
│       ├── api.js      # Backend fetch
│       ├── storage.js  # chrome.storage helpers
│       ├── messaging.js
│       └── extractors/ # Per-platform extraction stubs
│           ├── youtube.js
│           ├── reddit.js  (stub)
│           ├── x.js       (stub)
│           └── news.js    (stub)
└── backend/            # FastAPI classifier
    ├── app/
    │   ├── main.py
    │   ├── routers/analyze.py
    │   ├── services/
    │   │   ├── classifier.py  # 3-stage: rules → Gemini → fallback
    │   │   ├── gemini_client.py
    │   │   └── rules.py
    │   └── schemas/
    └── requirements.txt
```

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create .env
echo "GEMINI_API_KEY=your_key_here" > .env

uvicorn app.main:app --reload
# Runs on http://localhost:8000
```

### 2. Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Open YouTube and navigate to any video
5. Click the ScrollSense icon → **Open Side Panel**

## Classification pipeline

```
Content detected
      │
      ▼
Rule-based check  ──── high confidence? ──── YES ──▶ return result
      │
      NO
      ▼
Gemini 2.0 Flash  ──── timeout (8s) / error ──▶ fallback result
      │
      ▼
Parse + validate response
      │
      ▼
Display in side panel
```

## Adding platforms

The extension is built for easy platform expansion:

1. Implement `utils/extractors/<platform>.js` (use `reddit.js` as a template)
2. Inline the extractor into `content.js` and register it in `EXTRACTORS`
3. Add `host_permissions` + `content_scripts.matches` in `manifest.json`

No other files need changes.

## Development notes

- The backend must be running locally on port 8000 before the extension will classify content
- Gemini API key is required; classification falls back to rules-only if the key is missing or the request times out
- The extension uses `chrome.storage.local` — data is per-browser-profile and not synced
