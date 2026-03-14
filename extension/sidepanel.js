// sidepanel.js — ScrollSense side panel controller (merged)
// Auth-aware, multi-platform, with session stats tracking.

import { API_BASE } from './utils/api.js';
import { onPanelMessage } from './utils/messaging.js';
import {
  getCurrentContent,
  getCurrentAnalysis,
  getLastResult,
  getSessionHistory,
  saveLastResult,
  clearLastResult,
  clearSessionHistory,
} from './utils/storage.js';

// ── Storage keys (must match storage.js) ────────────────────────────────────
const KEY_ANALYSIS = 'scrollsense_current_analysis';
const KEY_HISTORY  = 'scrollsense_session_history';

// ── Auth storage ────────────────────────────────────────────────────────────

const AUTH_KEY = 'scrollsense_auth';

async function getAuth() {
  const s = await chrome.storage.local.get(AUTH_KEY);
  return s[AUTH_KEY] || null;
}

async function saveAuth(data) {
  return chrome.storage.local.set({ [AUTH_KEY]: data });
}

async function clearAuth() {
  return chrome.storage.local.remove(AUTH_KEY);
}

// ── Screen toggling ─────────────────────────────────────────────────────────

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showAppScreen(user) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  const nameEl = document.getElementById('user-name');
  if (nameEl && user) nameEl.textContent = user.name || user.email;
}

function showRegisterForm() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('login-error').textContent = '';
}

function showLoginForm(message = '') {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-error').textContent = '';
  document.getElementById('login-error').textContent = message;
}

// ── Auth form handling ──────────────────────────────────────────────────────

document.getElementById('show-register')?.addEventListener('click', (e) => {
  e.preventDefault();
  showRegisterForm();
});

document.getElementById('show-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  showLoginForm();
});

// Login
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  btn.disabled = true;
  btn.textContent = 'Logging in...';
  errorEl.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Login failed.');
    }

    const data = await res.json();
    await saveAuth(data);
    showAppScreen(data.user);
    initApp();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
});

// Register
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('btn-register');

  btn.disabled = true;
  btn.textContent = 'Creating account...';
  errorEl.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Registration failed.');
    }

    // Redirect to login with success message
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('login-email').value = email;
    showLoginForm('Account created. Please log in.');
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});

// Logout
document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await clearAuth();
  sessionResults = [];
  renderHistory();
  updateStats();
  await Promise.all([clearSessionHistory(), clearLastResult()]);
  showAuthScreen();
});

// ── Category maps (Aditya's maps + Advith's positive tracking) ──────────────

const CATEGORY_COLORS = {
  'Educational':              '#4ade80',
  'Entertainment':            '#60a5fa',
  'Credible News':            '#2dd4bf',
  'Opinion / Commentary':     '#fbbf24',
  'High-Emotion / Rage-Bait': '#f87171',
  'Other':                    '#9ca3af',
  'Unclassified':             '#9ca3af',
};

const CATEGORY_EMOJI = {
  'Educational':              '\u{1F393}',
  'Entertainment':            '\u{1F3AC}',
  'Credible News':            '\u{1F4F0}',
  'Opinion / Commentary':     '\u{1F4AC}',
  'High-Emotion / Rage-Bait': '\u26A1',
  'Other':                    '\u{1F4CC}',
  'Unclassified':             '\u{1F4CC}',
};

const CATEGORY_POSITIVE = new Set(['Educational', 'Credible News']);

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] ?? '#9ca3af';
}

function categoryLabel(cat) {
  const emoji = CATEGORY_EMOJI[cat];
  return cat ? (emoji ? `${emoji} ${cat}` : cat) : '\u2014';
}

// ── Utilities (Aditya) ─────────────────────────────────────────────────────

function truncateUrl(url) {
  if (!url) return '\u2014';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 28) + '\u2026' : u.pathname;
    return host + path;
  } catch {
    return url.length > 48 ? url.slice(0, 46) + '\u2026' : url;
  }
}

function platformLabel(platform) {
  return { youtube: 'YouTube', reddit: 'Reddit', x: 'X', news: 'News' }[platform] ?? platform ?? '';
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── State machine ───────────────────────────────────────────────────────────

const VIEWS = ['waiting', 'detected', 'result', 'error'];

function showState(name) {
  VIEWS.forEach((v) => {
    document.getElementById(`state-${v}`)?.classList.toggle('active', v === name);
  });
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '\u2014';
}

function setBar(scoreKey, value) {
  const pct = Math.round((value ?? 0) * 100);
  const bar = document.getElementById(`bar-${scoreKey}`);
  const val = document.getElementById(`val-${scoreKey}`);
  if (bar) bar.style.width = `${pct}%`;
  if (val) val.textContent = `${pct}%`;
}

// ── Session tracking (Advith) ───────────────────────────────────────────────

let sessionResults = [];

function addToSession(payload, analysis) {
  sessionResults = sessionResults.filter((r) => r.payload.url !== payload.url);
  sessionResults.unshift({ payload, analysis });
  renderHistory();
  updateStats();
}

// ── Stats (Advith — uses CATEGORY_POSITIVE set) ────────────────────────────

function updateStats() {
  const total = sessionResults.length;
  let positive = 0;
  let negative = 0;

  sessionResults.forEach(({ analysis }) => {
    if (!analysis || analysis._fallback) return;
    if (CATEGORY_POSITIVE.has(analysis.category)) positive++;
    else negative++;
  });

  setText('stat-total', String(total));
  setText('stat-positive', String(positive));
  setText('stat-negative', String(negative));

  if (total > 0) {
    const score = Math.round((positive / total) * 100);
    setText('stat-score', String(score));
  } else {
    setText('stat-score', '--');
  }
}

// ── Render functions (Aditya's structure + Advith's addToSession calls) ─────

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
    : '\u2014';
  setText('result-confidence', conf);

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

// ── History rendering (Aditya's DOM createElement, Advith's sessionResults) ──

function renderHistory() {
  const section = document.getElementById('history-section');
  const list    = document.getElementById('history-list');
  if (!section || !list) return;

  // Show past results (skip the current one at index 0)
  const items = sessionResults.slice(1, 9);

  if (items.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  list.innerHTML = '';

  items.forEach(({ payload, analysis }) => {
    const cat   = analysis?.category ?? null;
    const color = cat ? categoryColor(cat) : '#9ca3af';

    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div class="history-item-main">
        <p class="history-title">${_esc(payload.title || '(untitled)')}</p>
        <p class="history-sub">${_esc(payload.creator || '')}${payload.creator && payload.platform ? ' \u00B7 ' : ''}${_esc(platformLabel(payload.platform))}</p>
      </div>
      ${cat ? `<span class="history-badge" style="--cat-color:${color}">${_esc(cat)}</span>` : ''}
    `;
    list.appendChild(row);
  });
}

// ── Button handlers (Advith) ────────────────────────────────────────────────

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
}

document.getElementById('btn-dashboard')?.addEventListener('click', openDashboard);

document.getElementById('btn-clear')?.addEventListener('click', () => {
  sessionResults = [];
  renderHistory();
  updateStats();
  clearLastResult().catch(console.error);
  clearSessionHistory().catch(console.error);
});

// ── Retry ───────────────────────────────────────────────────────────────────

document.getElementById('btn-retry')?.addEventListener('click', () => {
  if (currentPayload) {
    renderLoading(currentPayload);
    chrome.runtime.sendMessage({ type: 'CONTENT_DETECTED', payload: currentPayload });
  } else {
    showState('waiting');
  }
});

// ── Message handling ────────────────────────────────────────────────────────

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
    addToSession(payload, analysis);
  }

  if (type === 'ANALYSIS_ERROR') {
    currentPayload = payload ?? currentPayload;
    renderError(currentPayload, error);
    if (currentPayload && message.analysis) {
      addToSession(currentPayload, message.analysis);
    }
  }
}

// ── Live storage updates (Aditya — keeps panel synced) ──────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // If the panel is in loading state and analysis arrives via storage
  // (race between broadcast and panel opening), update the result view.
  if (changes[KEY_ANALYSIS] && currentPayload) {
    const analysis = changes[KEY_ANALYSIS].newValue;
    if (analysis && !analysis._fallback) {
      renderResult(currentPayload, analysis);
      addToSession(currentPayload, analysis);
    }
  }
});

// ── App init (after auth — Advith + loads stored history) ───────────────────

async function initApp() {
  const [content, analysis, lastResult, storedHistory] = await Promise.all([
    getCurrentContent(),
    getCurrentAnalysis(),
    getLastResult(),
    getSessionHistory(),
  ]);

  // Restore session results from storage
  sessionResults = Array.isArray(storedHistory)
    ? storedHistory
        .filter((entry) => entry?.payload && entry?.analysis)
        .map((entry) => ({ payload: entry.payload ?? entry, analysis: entry.analysis ?? null }))
    : [];
  renderHistory();
  updateStats();

  if (content && analysis && !analysis._fallback) {
    currentPayload = content;
    renderResult(content, analysis);
    addToSession(content, analysis);
  } else if (lastResult?.payload && lastResult?.analysis) {
    currentPayload = lastResult.payload;
    if (lastResult.analysis._fallback) {
      renderError(lastResult.payload, lastResult.analysis.reason);
    } else {
      renderResult(lastResult.payload, lastResult.analysis);
    }
  } else if (content) {
    currentPayload = content;
    renderLoading(content);
  } else {
    showState('waiting');
  }

  onPanelMessage(handleMessage);
}

// ── Bootstrap (auth check + offline-friendly — Advith) ──────────────────────

async function init() {
  const auth = await getAuth();

  if (auth && auth.token) {
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: auth.token }),
      });

      if (res.ok) {
        showAppScreen(auth.user);
        initApp();
        return;
      }
    } catch {
      // Backend unreachable — still show app if we have a token (offline-friendly)
      showAppScreen(auth.user);
      initApp();
      return;
    }

    // Token invalid — clear and show login
    await clearAuth();
  }

  showAuthScreen();
}

init();
