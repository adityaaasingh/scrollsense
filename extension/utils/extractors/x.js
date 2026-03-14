// utils/extractors/x.js — X (Twitter) extraction stub
//
// HOW TO ACTIVATE:
//   1. Implement the TODO selectors below.
//   2. Register in content.js EXTRACTORS:
//        { test: (h) => h.includes('x.com') || h.includes('twitter.com'), extract: extractX }
//   3. Add to manifest.json:
//        host_permissions: "https://x.com/*", "https://twitter.com/*"
//        content_scripts.matches: "https://x.com/*", "https://twitter.com/*"
//
// NOTE: X is an SPA that mutates the DOM aggressively. The MutationObserver
// in content.js already handles this, but selectors must be re-validated after
// any X redesign. history.pushState patching in content.js handles navigation.

'use strict';

// ── Selector candidates ───────────────────────────────────────────────────────
// X does not use stable IDs; prefer aria attributes and data-testid hooks.
const SELECTORS = {
  // The focused/open tweet text on a status page (/status/<id>)
  tweetText: [
    '[data-testid="tweetText"]',          // main tweet text
    'article [lang] > span',              // fallback text span
  ],
  // Author handle — shown in the article header
  author: [
    '[data-testid="User-Name"] a[href*="/"] span', // display name
    'article [data-testid="User-Name"] span:first-child',
  ],
};

function queryFirstNonEmpty(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) return el;
  }
  return null;
}

function tweetIdFromUrl() {
  // URL: https://x.com/<handle>/status/<id>
  const match = location.pathname.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract metadata from an X status (tweet) page.
 * Returns null if not on a /status/ page.
 */
export function extractX() {
  if (!location.hostname.includes('x.com') && !location.hostname.includes('twitter.com')) return null;

  const tweetId = tweetIdFromUrl();
  if (!tweetId) return null;  // not on a single-tweet page

  // TODO: implement selector extraction; X re-renders frequently
  const textEl   = queryFirstNonEmpty(SELECTORS.tweetText);
  const authorEl = queryFirstNonEmpty(SELECTORS.author);

  const text    = textEl   ? textEl.textContent.trim().slice(0, 1000) : null;
  const creator = authorEl ? authorEl.textContent.trim() : null;

  // X posts have no separate title; use truncated tweet text as the title.
  const title = text ? text.slice(0, 120) : null;

  return {
    platform: 'x',
    content_type: 'post',
    url: location.href,
    title,
    creator,
    visible_text: text,
    captured_at: new Date().toISOString(),
    _dedup_key: tweetId,
  };
}
