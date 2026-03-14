// utils/api.js — ScrollSense backend client
// Single place for the backend URL and all fetch logic.
// Import this wherever you need to talk to the backend.

export const API_BASE = 'http://localhost:8000';

/**
 * POST /analyze/live
 * Sends a normalized content payload and returns an AnalysisResponse.
 * Throws on non-2xx responses so callers can catch and handle errors cleanly.
 *
 * @param {object} payload — normalized ScrollSense ContentPayload
 * @returns {Promise<{ category, confidence, reason, scores }>}
 */
export async function analyzeContent(payload) {
  const res = await fetch(`${API_BASE}/analyze/live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * POST /analyze/session
 * Sends a list of classified history items and returns a SessionInsightResponse.
 * Throws on non-2xx responses.
 *
 * @param {Array<{ url, title, creator, platform, category, captured_at }>} items
 * @returns {Promise<{ label, summary, insights, recommendations, metrics }>}
 */
export async function analyzeSession(items) {
  const res = await fetch(`${API_BASE}/analyze/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Session backend error ${res.status}: ${text}`);
  }

  return res.json();
}
