// sidepanel.js — ScrollSense side panel controller

import { onPanelMessage } from './utils/messaging.js';
import { getCurrentContent, getCurrentAnalysis, saveLastResult } from './utils/storage.js';

// ─── State helpers ────────────────────────────────────────────────────────────

const VIEWS = ['waiting', 'detected', 'result', 'error'];

function showState(name) {
  VIEWS.forEach((v) => {
    document.getElementById(`state-${v}`)?.classList.toggle('active', v === name);
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

// Show title/creator/url and the animated loading bar (state-detected).
function renderLoading(payload) {
  setText('meta-title',   payload.title);
  setText('meta-channel', payload.creator);   // schema uses 'creator'
  setText('meta-url',     payload.url);
  showState('detected');
}

// Show full classification result (state-result).
function renderResult(payload, analysis) {
  setText('result-title',      payload.title);
  setText('result-channel',    payload.creator);
  setText('result-label',      analysis.category);
  setText('result-confidence', analysis.confidence != null
    ? `${Math.round(analysis.confidence * 100)}%` : '—');
  setText('result-summary',    analysis.reason);
  showState('result');
}

function renderError(payload, message) {
  // Keep content visible in the error state if we have it.
  if (payload) {
    setText('meta-title',   payload.title);
    setText('meta-channel', payload.creator);
    setText('meta-url',     payload.url);
  }
  setText('error-message', message || 'Classification failed.');
  showState('error');
}

// ─── Message handling ─────────────────────────────────────────────────────────

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

// ─── Retry button ─────────────────────────────────────────────────────────────

document.getElementById('btn-retry')?.addEventListener('click', () => {
  if (currentPayload) {
    renderLoading(currentPayload);
    chrome.runtime.sendMessage({ type: 'CONTENT_DETECTED', payload: currentPayload });
  } else {
    showState('waiting');
  }
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  // Restore state from storage so the panel isn't blank on reopen.
  const [content, analysis] = await Promise.all([
    getCurrentContent(),
    getCurrentAnalysis(),
  ]);

  if (content && analysis && !analysis._fallback) {
    renderResult(content, analysis);
  } else if (content) {
    renderLoading(content);   // content known but analysis pending/failed
  } else {
    showState('waiting');
  }

  onPanelMessage(handleMessage);
}

init();
