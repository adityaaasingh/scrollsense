// utils/storage.js — thin wrapper around chrome.storage.local
// Keeps storage keys in one place so they're easy to audit and rename.

const KEYS = {
  LAST_RESULT: 'scrollsense_last_result',
};

/**
 * Persist the most recent classification result so the panel can restore state
 * when it is closed and reopened.
 * @param {{ payload: object, result: object }} data
 */
export function saveLastResult(data) {
  return chrome.storage.local.set({ [KEYS.LAST_RESULT]: data });
}

/**
 * Retrieve the last saved classification result.
 * @returns {Promise<{ payload: object, result: object } | null>}
 */
export async function getLastResult() {
  const stored = await chrome.storage.local.get(KEYS.LAST_RESULT);
  return stored[KEYS.LAST_RESULT] ?? null;
}

/**
 * Clear the stored result (e.g. when the user navigates away or requests a reset).
 */
export function clearLastResult() {
  return chrome.storage.local.remove(KEYS.LAST_RESULT);
}
