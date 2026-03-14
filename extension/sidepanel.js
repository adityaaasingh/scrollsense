// sidepanel.js — WatchTrace side panel controller

import { onPanelMessage } from './utils/messaging.js';
import {
  getCurrentContent,
  getCurrentAnalysis,
  getSessionHistory,
  getSessionInsights,
  saveLastResult,
} from './utils/storage.js';

// ── Storage keys (must match storage.js) ─────────────────────────────────────
const KEY_ANALYSIS  = 'scrollsense_current_analysis';
const KEY_HISTORY   = 'scrollsense_session_history';
const KEY_INSIGHTS  = 'scrollsense_session_insights';

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

// ── Session label → colour & emoji ───────────────────────────────────────────
const SESSION_LABEL_COLORS = {
  'Learning Mode':       '#4ade80',
  'Entertainment Loop':  '#60a5fa',
  'Creator Binge':       '#a78bfa',
  'Commentary Cluster':  '#fbbf24',
  'Sports Spiral':       '#34d399',
  'News Spiral':         '#2dd4bf',
  'Balanced Feed':       '#6ee7b7',
  'Rage Feed':           '#f87171',
  'Mixed Session':       '#9ca3af',
};

const SESSION_LABEL_EMOJI = {
  'Learning Mode':       '🎓',
  'Entertainment Loop':  '🔄',
  'Creator Binge':       '👤',
  'Commentary Cluster':  '💬',
  'Sports Spiral':       '⚽',
  'News Spiral':         '📰',
  'Balanced Feed':       '⚖️',
  'Rage Feed':           '⚡',
  'Mixed Session':       '🌀',
};

function sessionLabelColor(label) {
  return SESSION_LABEL_COLORS[label] ?? '#9ca3af';
}

function sessionLabelText(label) {
  if (!label) return '—';
  const emoji = SESSION_LABEL_EMOJI[label];
  return emoji ? `${emoji} ${label}` : label;
}

// ── Platform label & emoji ────────────────────────────────────────────────────
const PLATFORM_LABELS = { youtube: 'YouTube', reddit: 'Reddit', x: 'X', news: 'News' };
const PLATFORM_EMOJI  = { youtube: '▶', reddit: '👽', x: '✕', news: '📰' };

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] ?? platform ?? '';
}

function platformBadgeText(platform) {
  const label = PLATFORM_LABELS[platform] ?? platform ?? '';
  const emoji = PLATFORM_EMOJI[platform];
  return label ? (emoji ? `${emoji} ${label}` : label) : '';
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

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render functions ──────────────────────────────────────────────────────────

function renderPlatformBadge(platform) {
  const badge = document.getElementById('result-platform-badge');
  if (!badge) return;
  const text = platformBadgeText(platform);
  if (text) {
    badge.textContent = text;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function renderLoading(payload) {
  setText('loading-title',   payload.title);
  setText('loading-creator', payload.creator);
  setText('loading-url',     payload.url);
  showState('detected');
}

function renderResult(payload, analysis) {
  renderPlatformBadge(payload.platform);

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

  // Confidence as plain percentage text
  const conf = analysis.confidence != null
    ? `${Math.round(analysis.confidence * 100)}%`
    : '—';
  setText('result-confidence', conf);

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

// ── Session insights ──────────────────────────────────────────────────────────

function computeSessionStats(history) {
  const items = history ?? [];
  const categories = new Set(items.map(i => i._category).filter(Boolean));
  const creators   = new Set(items.map(i => i.creator).filter(Boolean));
  const platforms  = new Set(items.map(i => i.platform).filter(Boolean));

  // Category breakdown: [{cat, frac}] sorted by frequency, top 3
  const counts = {};
  items.forEach(i => {
    const cat = i._category;
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  });
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  const breakdown = Object.entries(counts)
    .map(([cat, n]) => ({ cat, frac: n / total }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, 3);

  return {
    uniqueCategories: categories.size,
    uniqueCreators:   creators.size,
    uniquePlatforms:  platforms.size,
    breakdown,
  };
}

function renderSessionInsights(insights, history) {
  const section = document.getElementById('session-section');
  if (!section) return;

  if (!insights || !insights.label) {
    section.hidden = true;
    return;
  }

  section.hidden = false;

  // Label badge with dynamic colour
  const labelEl = document.getElementById('session-label');
  if (labelEl) {
    labelEl.textContent = sessionLabelText(insights.label);
    const color = sessionLabelColor(insights.label);
    labelEl.style.setProperty('--session-color', color);
  }

  // Diversity: plain text
  const divEl = document.getElementById('session-diversity');
  if (divEl) {
    const div = insights.metrics?.diversity_score;
    if (div != null) {
      divEl.textContent = `${Math.round(div * 100)}% diverse`;
      divEl.hidden = false;
    } else {
      divEl.hidden = true;
    }
  }

  // Category distribution bars
  const barsEl = document.getElementById('session-bars');
  if (barsEl) {
    const stats = computeSessionStats(history);
    barsEl.innerHTML = stats.breakdown.map(({ cat, frac }) => {
      const pct = Math.round(frac * 100);
      return `
        <div class="score-row">
          <span class="score-label">${_esc(cat)}</span>
          <div class="score-track">
            <div class="score-fill" style="width:${pct}%"></div>
          </div>
          <span class="score-val">${pct}%</span>
        </div>`;
    }).join('');

    // Stats boxes
    const el = (id) => document.getElementById(id);
    el('stat-categories') && (el('stat-categories').textContent = stats.uniqueCategories);
    el('stat-creators')   && (el('stat-creators').textContent   = stats.uniqueCreators);
    el('stat-platforms')  && (el('stat-platforms').textContent  = stats.uniquePlatforms);
  }
}

// ── History ───────────────────────────────────────────────────────────────────

function renderHistory(items) {
  const list = document.getElementById('history-list');
  if (!list) return;

  const recent = (items ?? []).slice(0, 8);
  list.innerHTML = '';

  recent.forEach((item) => {
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

let cachedHistory = [];

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes[KEY_HISTORY]) {
    cachedHistory = changes[KEY_HISTORY].newValue ?? [];
    renderHistory(cachedHistory);
  }

  if (changes[KEY_INSIGHTS]) {
    renderSessionInsights(changes[KEY_INSIGHTS].newValue ?? null, cachedHistory);
  }

  if (changes[KEY_ANALYSIS] && currentPayload) {
    const analysis = changes[KEY_ANALYSIS].newValue;
    if (analysis && !analysis._fallback) {
      renderResult(currentPayload, analysis);
    }
  }
});

// ── Retry ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-dashboard-mock')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html?mode=mock') });
});

document.getElementById('btn-dashboard-live')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html?mode=real') });
});

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
  const [content, analysis, history, insights] = await Promise.all([
    getCurrentContent(),
    getCurrentAnalysis(),
    getSessionHistory(),
    getSessionInsights(),
  ]);

  cachedHistory = history ?? [];
  renderHistory(cachedHistory);
  renderSessionInsights(insights, cachedHistory);

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
