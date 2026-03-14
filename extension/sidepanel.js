// sidepanel.js — ScrollSense side panel controller
// Generic: uses normalized payload schema (platform, content_type, title, creator, url).
// Extend by adding new platform cases to platformLabel() and categoryColor().

import { onPanelMessage } from './utils/messaging.js';
import {
  getCurrentContent,
  getCurrentAnalysis,
  getSessionHistory,
  saveLastResult,
} from './utils/storage.js';

// ── Storage keys (must match storage.js) ─────────────────────────────────────
const KEY_ANALYSIS = 'scrollsense_current_analysis';
const KEY_HISTORY  = 'scrollsense_session_history';

// ── Category → accent colour & emoji ─────────────────────────────────────────
const CATEGORY_COLORS = {
  'Educational':             '#4ade80',
  'Entertainment':           '#60a5fa',
  'Credible News':           '#2dd4bf',
  'Opinion / Commentary':    '#fbbf24',
  'High-Emotion / Rage-Bait':'#f87171',
  'Other':                   '#9ca3af',
  'Unclassified':            '#9ca3af',
};

const CATEGORY_EMOJI = {
  'Educational':             '🎓',
  'Entertainment':           '🎬',
  'Credible News':           '📰',
  'Opinion / Commentary':    '💬',
  'High-Emotion / Rage-Bait':'⚡',
  'Other':                   '📌',
  'Unclassified':            '📌',
};

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] ?? '#9ca3af';
}

function categoryLabel(cat) {
  const emoji = CATEGORY_EMOJI[cat];
  return cat ? (emoji ? `${emoji} ${cat}` : cat) : '—';
}

function truncateUrl(url) {
  if (!url) return '—';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 28) + '…' : u.pathname;
    return host + path;
  } catch {
    return url.length > 48 ? url.slice(0, 46) + '…' : url;
  }
}

// ── Platform label ────────────────────────────────────────────────────────────
function platformLabel(platform) {
  return { youtube: 'YouTube', reddit: 'Reddit', x: 'X', news: 'News' }[platform] ?? platform ?? '';
}

// ── State machine ─────────────────────────────────────────────────────────────
const VIEWS = ['waiting', 'detected', 'result', 'error'];

function showState(name) {
  VIEWS.forEach((v) => {
    document.getElementById(`state-${v}`)?.classList.toggle('active', v === name);
  });
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

function setBar(scoreKey, value) {
  const pct = Math.round((value ?? 0) * 100);
  const bar = document.getElementById(`bar-${scoreKey}`);
  const val = document.getElementById(`val-${scoreKey}`);
  if (bar) bar.style.width = `${pct}%`;
  if (val) val.textContent = `${pct}%`;
}

// ── Render functions ──────────────────────────────────────────────────────────

function renderHeaderBadge(platform) {
  const badge = document.getElementById('header-badge');
  if (!badge) return;
  const label = platformLabel(platform);
  if (label) {
    badge.textContent = label;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function renderLoading(payload) {
  renderHeaderBadge(payload.platform);
  setText('loading-title',   payload.title);
  setText('loading-creator', payload.creator);
  setText('loading-url',     payload.url);
  showState('detected');
}

function renderResult(payload, analysis) {
  renderHeaderBadge(payload.platform);

  // Metadata
  setText('result-title',   payload.title);
  setText('result-creator', payload.creator);

  const urlEl = document.getElementById('result-url');
  if (urlEl) {
    urlEl.textContent = truncateUrl(payload.url);
    urlEl.href = payload.url || '#';
  }

  // Category badge with dynamic colour + emoji
  const catEl = document.getElementById('result-category');
  if (catEl) {
    catEl.textContent = categoryLabel(analysis.category);
    catEl.style.setProperty('--cat-color', categoryColor(analysis.category));
  }

  // Confidence pill
  const conf = analysis.confidence != null
    ? `${Math.round(analysis.confidence * 100)}%`
    : '—';
  setText('result-confidence', conf);

  // Reason
  setText('result-reason', analysis.reason);

  // Score bars
  const scores = analysis.scores ?? {};
  setBar('educational',      scores.educational ?? 0);
  setBar('high_emotion',     scores.high_emotion ?? 0);
  setBar('credibility_risk', scores.credibility_risk ?? 0);

  showState('result');
}

function renderError(payload, message) {
  const card = document.getElementById('error-content-card');
  if (payload && card) {
    setText('error-title',   payload.title);
    setText('error-creator', payload.creator);
    card.hidden = false;
  } else if (card) {
    card.hidden = true;
  }
  setText('error-message', message || 'Classification failed.');
  showState('error');
}

// ── History ───────────────────────────────────────────────────────────────────

function renderHistory(items) {
  const section = document.getElementById('history-section');
  const list    = document.getElementById('history-list');
  if (!section || !list) return;

  // Show at most 8 items; hide section if empty.
  const recent = (items ?? []).slice(0, 8);
  if (recent.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  list.innerHTML = '';

  recent.forEach((item) => {
    // Each history entry is a content payload (not an analysis).
    // The category may be embedded if we stored it; fall back gracefully.
    const cat   = item._category ?? null;
    const color = cat ? categoryColor(cat) : '#9ca3af';

    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div class="history-item-main">
        <p class="history-title">${_esc(item.title || '(untitled)')}</p>
        <p class="history-sub">${_esc(item.creator || '')}${item.creator && item.platform ? ' · ' : ''}${_esc(platformLabel(item.platform))}</p>
      </div>
      ${cat ? `<span class="history-badge" style="--cat-color:${color}">${_esc(cat)}</span>` : ''}
    `;
    list.appendChild(row);
  });
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Message handling ──────────────────────────────────────────────────────────

let currentPayload = null;

function handleMessage(message) {
  const { type, payload, analysis, error } = message;

  if (type === 'ANALYSIS_LOADING') {
    currentPayload = payload;
    renderLoading(payload);
  }

  if (type === 'ANALYSIS_RESULT') {
    currentPayload = payload;
    saveLastResult({ payload, analysis }).catch(console.error);
    renderResult(payload, analysis);
  }

  if (type === 'ANALYSIS_ERROR') {
    currentPayload = payload ?? currentPayload;
    renderError(currentPayload, error);
  }
}

// ── Live storage updates ──────────────────────────────────────────────────────
// Watch for background writes so the panel stays in sync even when it was open
// before the analysis finished (e.g. panel reopened mid-flight).

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes[KEY_HISTORY]) {
    renderHistory(changes[KEY_HISTORY].newValue ?? []);
  }

  // If the panel is in loading state and analysis arrives via storage
  // (race between broadcast and panel opening), update the result view.
  if (changes[KEY_ANALYSIS] && currentPayload) {
    const analysis = changes[KEY_ANALYSIS].newValue;
    if (analysis && !analysis._fallback) {
      renderResult(currentPayload, analysis);
    }
  }
});

// ── Retry ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-retry')?.addEventListener('click', () => {
  if (currentPayload) {
    renderLoading(currentPayload);
    chrome.runtime.sendMessage({ type: 'CONTENT_DETECTED', payload: currentPayload });
  } else {
    showState('waiting');
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init() {
  const [content, analysis, history] = await Promise.all([
    getCurrentContent(),
    getCurrentAnalysis(),
    getSessionHistory(),
  ]);

  renderHistory(history);

  if (content && analysis && !analysis._fallback) {
    currentPayload = content;
    renderResult(content, analysis);
  } else if (content) {
    currentPayload = content;
    renderLoading(content);
  } else {
    showState('waiting');
  }

  onPanelMessage(handleMessage);
}

init();
