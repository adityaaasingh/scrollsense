// sidepanel.js — ScrollSense side panel controller
// Listens for messages from the background worker and updates the UI accordingly.

import { onPanelMessage } from './utils/messaging.js';
import { getLastResult, saveLastResult, clearLastResult } from './utils/storage.js';

// ---------- State helpers ----------

const VIEWS = ['waiting', 'detected', 'result', 'error'];

function showState(name) {
  VIEWS.forEach((v) => {
    const el = document.getElementById(`state-${v}`);
    if (el) el.classList.toggle('active', v === name);
  });
}

// ---------- UI update helpers ----------

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

function renderDetected(payload) {
  setText('meta-title', payload.title);
  setText('meta-channel', payload.channel);
  setText('meta-url', payload.url);
  showState('detected');
}

function renderResult(payload, result) {
  setText('result-title', payload.title);
  setText('result-channel', payload.channel);
  setText('result-label', result.label);
  setText('result-confidence', result.confidence ? `${Math.round(result.confidence * 100)}%` : '—');
  setText('result-summary', result.summary);
  showState('result');
}

function renderError(message) {
  setText('error-message', message || 'Something went wrong.');
  showState('error');
}

// ---------- Message handling ----------

let currentPayload = null;

function handleMessage(message) {
  if (message.type === 'VIDEO_DETECTED') {
    currentPayload = message.payload;
    renderDetected(currentPayload);
    // In the next step, this is where we'll call the backend classify API.
    // For now just stay in "detected / classifying" state.
  }

  if (message.type === 'CLASSIFICATION_RESULT') {
    const { payload, result } = message;
    saveLastResult({ payload, result });
    renderResult(payload, result);
  }

  if (message.type === 'CLASSIFICATION_ERROR') {
    renderError(message.error);
  }
}

// ---------- Retry button ----------

document.getElementById('btn-retry')?.addEventListener('click', () => {
  if (currentPayload) {
    renderDetected(currentPayload);
    // Re-trigger classification (wired up in the next step).
    chrome.runtime.sendMessage({ type: 'RETRY_CLASSIFICATION', payload: currentPayload });
  } else {
    showState('waiting');
  }
});

// ---------- Bootstrap ----------

async function init() {
  // Restore the last known result so the panel isn't blank on reopen.
  const cached = await getLastResult();
  if (cached?.payload && cached?.result) {
    renderResult(cached.payload, cached.result);
  } else {
    showState('waiting');
  }

  // Subscribe to runtime messages relayed from background.js.
  onPanelMessage(handleMessage);
}

init();
