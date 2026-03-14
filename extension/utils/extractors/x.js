// utils/extractors/x.js — X (Twitter) post extraction
//
// ALREADY ACTIVE: registered in content.js EXTRACTORS + manifest.json.
//
// creator field = display name when detectable, @handle from URL as reliable fallback.
// X is an aggressive React SPA — data-testid hooks are the most stable selectors.
// The MutationObserver + history.pushState patching in content.js handles SPA nav.
//
// Tweet text scoped to the focal article (first on status page) so replies are ignored.

'use strict';

// ── Tweet text selectors ──────────────────────────────────────────────────────
// Try scoped selector first so replies on the same page don't bleed in.
const X_TEXT_SELECTORS = [
  'article[data-testid="tweet"] [data-testid="tweetText"]', // scoped to focal article
  '[data-testid="tweetText"]',                              // first on page (focal tweet)
  'article [lang] > span',                                  // last-resort text span
];

// ── Display name selectors ────────────────────────────────────────────────────
// X wraps display name + @handle together inside [data-testid="User-Name"].
// The display name is in a span that does NOT carry dir="ltr" (handles do).
const X_DISPLAY_NAME_SELECTORS = [
  '[data-testid="User-Name"] span:not([dir])',       // display name — no dir attribute
  '[data-testid="User-Name"] a > div > span',        // display name via profile link
  '[data-testid="User-Name"] span:first-of-type',   // first span in name block
];

function queryFirstNonEmpty(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) return el;
  }
  return null;
}

// ── Author helpers ────────────────────────────────────────────────────────────

/**
 * Extract @handle from the URL. Always works on /status/ pages.
 * URL shape: x.com/<handle>/status/<id>  (first path segment = handle)
 */
function xHandleFromUrl() {
  const m = location.pathname.match(/^\/([^/]+)\/status\//);
  return m ? `@${m[1]}` : null;
}

/**
 * Try to extract the display name from the DOM.
 * Returns null if the element is empty, looks like a handle, or DOM hasn't hydrated.
 */
function xDisplayName() {
  const el = queryFirstNonEmpty(X_DISPLAY_NAME_SELECTORS);
  if (!el) return null;
  const text = el.textContent.trim();
  // Discard if it looks like a handle or is implausibly long (grabbed wrong element).
  if (!text || text.startsWith('@') || text.length > 80) return null;
  return text;
}

/**
 * Return the best available creator identifier.
 * Priority: display name (DOM) → @handle (URL, always available).
 */
function xCreator() {
  return xDisplayName() || xHandleFromUrl();
}

function xTweetIdFromUrl() {
  const m = location.pathname.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

// ── Main extractor ────────────────────────────────────────────────────────────

/**
 * Extract metadata from an X/Twitter status page.
 * Returns null if:
 *   - Not on x.com or twitter.com
 *   - Not on a single-tweet /status/<id> page
 *   - No tweet text found (e.g., page hasn't hydrated yet — retry fires at +1500ms)
 */
export function extractX() {
  const host = location.hostname;
  if (!host.includes('x.com') && !host.includes('twitter.com')) return null;

  const tweetId = xTweetIdFromUrl();
  if (!tweetId) return null;  // feed, profile, or search page — not a status page

  const textEl = queryFirstNonEmpty(X_TEXT_SELECTORS);
  const text   = textEl ? textEl.textContent.trim().slice(0, 1000) : null;

  // Require tweet text — if missing, DOM hasn't rendered yet; the +1500ms retry handles it.
  if (!text) return null;

  const creator = xCreator();

  // X has no separate title field — use leading tweet text as a surrogate.
  const title = text.slice(0, 120);

  return {
    platform:     'x',
    content_type: 'post',
    url:          location.href,
    title,
    creator,
    visible_text: text,
    captured_at:  new Date().toISOString(),
    _dedup_key:   tweetId,   // stripped before sending; used only for dedup in content.js
  };
}
