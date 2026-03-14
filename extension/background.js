// background.js — ScrollSense service worker
// Pipeline on CONTENT_DETECTED:
//   1. Dedup (same url+title within 5 s → drop)
//   2. Persist content to storage
//   3. Notify panel: ANALYSIS_LOADING
//   4. POST payload to /analyze/live
//   5a. Success → persist analysis, notify panel: ANALYSIS_RESULT
//         → patch category into history, trigger session analysis (fire-and-forget)
//   5b. Failure → persist fallback, notify panel: ANALYSIS_ERROR

import { sendToPanel } from './utils/messaging.js';
import {
  saveCurrentContent,
  saveCurrentAnalysis,
  appendSessionHistory,
  setHistoryItemCategory,
  getSessionHistory,
  saveLastResult,
  saveSessionInsights,
  appendAllTimeLog,
} from './utils/storage.js';
import { analyzeContent, analyzeSession } from './utils/api.js';

// ─── Side panel lifecycle ─────────────────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
});

// ─── Dedup ────────────────────────────────────────────────────────────────────

const lastSeen = new Map();          // tabId → { url, title, creator, ts }
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

// ─── Session analysis ─────────────────────────────────────────────────────────
// Triggered after each successful individual classification.
// Fully fire-and-forget — any failure here must never affect the main flow.

const MIN_CLASSIFIED_FOR_SESSION = 3;   // need at least this many labelled items

async function triggerSessionAnalysis() {
  const history = await getSessionHistory();

  // Only send items that have a category assigned by setHistoryItemCategory.
  const classified = history.filter((item) => item._category);
  if (classified.length < MIN_CLASSIFIED_FOR_SESSION) return;

  // Cap at 20 most recent — enough for reliable pattern detection.
  const items = classified.slice(0, 20).map((item) => ({
    url:         item.url,
    title:       item.title       ?? null,
    creator:     item.creator     ?? null,
    platform:    item.platform    ?? null,
    category:    item._category   ?? null,
    captured_at: item.captured_at ?? null,
  }));

  const insights = await analyzeSession(items);
  await saveSessionInsights(insights);
  // Panel picks up the new value via chrome.storage.onChanged — no extra message needed.
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

async function handleContentDetected(payload) {
  // 1. Persist content immediately.
  await saveCurrentContent(payload).catch(console.error);
  await appendSessionHistory(payload).catch(console.error);

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
    sendToPanel({ type: 'ANALYSIS_ERROR', payload, error: err.message, analysis });
    return;
  }

  // 4. Persist and broadcast the classification result.
  await saveCurrentAnalysis(analysis).catch(console.error);
  await saveLastResult({ payload, analysis }).catch(console.error);
  sendToPanel({ type: 'ANALYSIS_RESULT', payload, analysis });

  // 5a. Append to all-time log (fire-and-forget — never affects panel).
  appendAllTimeLog({
    platform:     payload.platform,
    content_type: payload.content_type,
    url:          payload.url,
    title:        payload.title        ?? null,
    creator:      payload.creator      ?? null,
    category:     analysis.category,
    scores:       analysis.scores,
    captured_at:  payload.captured_at,
  }).catch((err) => console.warn('[ScrollSense] appendAllTimeLog failed:', err.message));

  // 5b. Enrich history with the category, then run session analysis.
  //    Chained as promises so session analysis always runs after the patch.
  //    Errors are silently logged — must never break the panel.
  setHistoryItemCategory(payload.url, analysis.category)
    .then(() => triggerSessionAnalysis())
    .catch((err) => console.warn('[ScrollSense] Session analysis failed:', err.message));
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
