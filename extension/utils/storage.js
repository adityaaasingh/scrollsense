// utils/storage.js — ScrollSense chrome.storage.local wrapper
// All storage keys live here. Background and panel both import from this file.

const KEYS = {
  CURRENT_CONTENT:    'scrollsense_current_content',
  CURRENT_ANALYSIS:   'scrollsense_current_analysis',  // latest classification result
  SESSION_HISTORY:    'scrollsense_session_history',
  LAST_RESULT:        'scrollsense_last_result',        // alias kept for panel restore
};

const SESSION_HISTORY_LIMIT = 50;

// ─── Current content ─────────────────────────────────────────────────────────

/** Overwrite the current detected content item. */
export function saveCurrentContent(payload) {
  return chrome.storage.local.set({ [KEYS.CURRENT_CONTENT]: payload });
}

/** Read the current detected content item. */
export async function getCurrentContent() {
  const s = await chrome.storage.local.get(KEYS.CURRENT_CONTENT);
  return s[KEYS.CURRENT_CONTENT] ?? null;
}

// ─── Current analysis ─────────────────────────────────────────────────────────

/** Overwrite the current classification result. */
export function saveCurrentAnalysis(analysis) {
  return chrome.storage.local.set({ [KEYS.CURRENT_ANALYSIS]: analysis });
}

/** Read the current classification result. */
export async function getCurrentAnalysis() {
  const s = await chrome.storage.local.get(KEYS.CURRENT_ANALYSIS);
  return s[KEYS.CURRENT_ANALYSIS] ?? null;
}

// ─── Session history ──────────────────────────────────────────────────────────

/**
 * Prepend a classified session result to history.
 * Deduplicates by URL so revisiting the same content refreshes the latest entry.
 * Trims to SESSION_HISTORY_LIMIT.
 * @param {{ payload: object, analysis: object }} entry
 */
export async function appendSessionHistory(entry) {
  const s = await chrome.storage.local.get(KEYS.SESSION_HISTORY);
  let history = s[KEYS.SESSION_HISTORY] ?? [];
  const url = entry?.payload?.url;

  if (!url) return history;

  // Remove any existing entry for the same URL so we don't get duplicates.
  history = history.filter((item) => item?.payload?.url !== url);

  // Newest first.
  history.unshift({
    payload: entry.payload,
    analysis: entry.analysis,
    saved_at: new Date().toISOString(),
  });

  // Keep bounded.
  if (history.length > SESSION_HISTORY_LIMIT) {
    history = history.slice(0, SESSION_HISTORY_LIMIT);
  }

  return chrome.storage.local.set({ [KEYS.SESSION_HISTORY]: history });
}

/** Read the full session history array. */
export async function getSessionHistory() {
  const s = await chrome.storage.local.get(KEYS.SESSION_HISTORY);
  return s[KEYS.SESSION_HISTORY] ?? [];
}

/** Wipe session history (e.g. user-triggered clear). */
export function clearSessionHistory() {
  return chrome.storage.local.remove(KEYS.SESSION_HISTORY);
}

// ─── Classification result cache ──────────────────────────────────────────────

/** Persist the most recent Gemini classification so the panel can restore on reopen. */
export function saveLastResult(data) {
  return chrome.storage.local.set({ [KEYS.LAST_RESULT]: data });
}

export async function getLastResult() {
  const s = await chrome.storage.local.get(KEYS.LAST_RESULT);
  return s[KEYS.LAST_RESULT] ?? null;
}

export function clearLastResult() {
  return chrome.storage.local.remove(KEYS.LAST_RESULT);
}
