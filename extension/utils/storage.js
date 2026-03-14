// utils/storage.js — ScrollSense chrome.storage.local wrapper
// All storage keys live here. Background and panel both import from this file.

const KEYS = {
  CURRENT_CONTENT:    'scrollsense_current_content',
  CURRENT_ANALYSIS:   'scrollsense_current_analysis',  // latest classification result
  SESSION_HISTORY:    'scrollsense_session_history',
  LAST_RESULT:        'scrollsense_last_result',        // alias kept for panel restore
  SESSION_INSIGHTS:   'scrollsense_session_insights',  // latest /analyze/session result
};

export const KEY_NAMES = KEYS;   // expose for onChanged listeners in the panel

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
 * Prepend a payload to session history.
 * Deduplicates by URL: if the URL already exists in history it is moved to the
 * front rather than duplicated. Trims to SESSION_HISTORY_LIMIT.
 * @param {object} payload — normalized ScrollSense payload
 */
export async function appendSessionHistory(payload) {
  const s = await chrome.storage.local.get(KEYS.SESSION_HISTORY);
  let history = s[KEYS.SESSION_HISTORY] ?? [];

  // Remove any existing entry for the same URL so we don't get duplicates.
  history = history.filter((item) => item.url !== payload.url);

  // Newest first.
  history.unshift(payload);

  // Keep bounded.
  if (history.length > SESSION_HISTORY_LIMIT) {
    history = history.slice(0, SESSION_HISTORY_LIMIT);
  }

  return chrome.storage.local.set({ [KEYS.SESSION_HISTORY]: history });
}

/**
 * Patch the _category field on an existing history item (matched by URL).
 * Called after classification so the session analyzer has category data.
 * No-op if the URL is not in history.
 */
export async function setHistoryItemCategory(url, category) {
  const s = await chrome.storage.local.get(KEYS.SESSION_HISTORY);
  const history = s[KEYS.SESSION_HISTORY] ?? [];
  const updated = history.map((item) =>
    item.url === url ? { ...item, _category: category } : item
  );
  return chrome.storage.local.set({ [KEYS.SESSION_HISTORY]: updated });
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

// ─── Session insights ─────────────────────────────────────────────────────────

/** Persist the latest /analyze/session result from the backend. */
export function saveSessionInsights(insights) {
  return chrome.storage.local.set({ [KEYS.SESSION_INSIGHTS]: insights });
}

/** Read the latest session insight result. */
export async function getSessionInsights() {
  const s = await chrome.storage.local.get(KEYS.SESSION_INSIGHTS);
  return s[KEYS.SESSION_INSIGHTS] ?? null;
}
