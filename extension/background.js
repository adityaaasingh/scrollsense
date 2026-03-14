// background.js — ScrollSense service worker
// Pipeline on CONTENT_DETECTED:
//   1. Dedup (same url+title within 5 s → drop)
//   2. Persist content to storage
//   3. Notify panel: ANALYSIS_LOADING
//   4. POST payload to /analyze/live
//   5a. Success → persist analysis, notify panel: ANALYSIS_RESULT
//   5b. Failure → persist fallback, notify panel: ANALYSIS_ERROR

import { sendToPanel } from './utils/messaging.js';
import {
  saveCurrentContent,
  saveCurrentAnalysis,
  appendSessionHistory,
  saveLastResult,
} from './utils/storage.js';
import { analyzeContent } from './utils/api.js';

// ─── Side panel lifecycle ─────────────────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
});

// ─── Dedup ────────────────────────────────────────────────────────────────────

const lastSeen = new Map();          // tabId → { url, title, ts }
const DEDUP_WINDOW_MS = 5000;

function isDuplicate(tabId, payload) {
  const prev = lastSeen.get(tabId);
  if (!prev) return false;
  const sameContent = prev.url === payload.url && prev.title === payload.title;
  const withinWindow = Date.now() - prev.ts < DEDUP_WINDOW_MS;
  if (!sameContent || !withinWindow) return false;
  // Allow an enriched retry through if the previous send had no creator.
  if (!prev.creator && payload.creator) return false;
  return true;
}

function markSeen(tabId, payload) {
  lastSeen.set(tabId, {
    url: payload.url,
    title: payload.title,
    creator: payload.creator || null,
    ts: Date.now(),
  });
}

chrome.tabs.onRemoved.addListener((tabId) => lastSeen.delete(tabId));

// ─── Fallback analysis ────────────────────────────────────────────────────────
// Returned whenever the backend is unreachable or returns an error.

function fallbackAnalysis(reason = 'Backend unavailable.') {
  return {
    category: 'Unclassified',
    confidence: 0,
    reason,
    scores: { educational: 0, high_emotion: 0, credibility_risk: 0 },
    _fallback: true,
  };
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

async function handleContentDetected(payload) {
  // 1. Persist content immediately.
  await saveCurrentContent(payload).catch(console.error);

  // 2. Tell the panel to show a loading state.
  sendToPanel({ type: 'ANALYSIS_LOADING', payload });

  // 3. Call the backend.
  let analysis;
  try {
    analysis = await analyzeContent(payload);
  } catch (err) {
    console.warn('[ScrollSense] Backend call failed:', err.message);
    analysis = fallbackAnalysis(err.message);
    await saveCurrentAnalysis(analysis).catch(console.error);
    await appendSessionHistory({ payload, analysis }).catch(console.error);
    await saveLastResult({ payload, analysis }).catch(console.error);
    sendToPanel({ type: 'ANALYSIS_ERROR', payload, error: err.message, analysis });
    return;
  }

  // 4. Persist and broadcast result.
  await saveCurrentAnalysis(analysis).catch(console.error);
  await appendSessionHistory({ payload, analysis }).catch(console.error);
  await saveLastResult({ payload, analysis }).catch(console.error);
  sendToPanel({ type: 'ANALYSIS_RESULT', payload, analysis });
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'CONTENT_DETECTED') return false;

  const payload = message.payload;
  const tabId = sender.tab?.id;

  if (tabId !== undefined && isDuplicate(tabId, payload)) {
    sendResponse({ ok: true, deduped: true });
    return false;
  }

  if (tabId !== undefined) markSeen(tabId, payload);

  // Kick off async pipeline; respond immediately so the content script
  // doesn't block waiting for the message channel to close.
  handleContentDetected(payload).catch(console.error);
  sendResponse({ ok: true, deduped: false });
  return false;
});
