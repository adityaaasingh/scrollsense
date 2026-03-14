// utils/extractors/reddit.js — Reddit extraction stub
//
// HOW TO ACTIVATE:
//   1. Implement the TODO selectors below.
//   2. Register in content.js EXTRACTORS:
//        { test: (h) => h.includes('reddit.com'), extract: extractReddit }
//   3. Add to manifest.json:
//        host_permissions: "https://www.reddit.com/*"
//        content_scripts.matches: "https://www.reddit.com/*"
//
// The normalized payload shape must remain unchanged — only the DOM selectors
// and _dedup_key logic are Reddit-specific.

'use strict';

// ── Selector candidates (Reddit's React DOM, as of 2025) ──────────────────────
// Reddit rebuilds layouts frequently; keep fallback chains as with youtube.js.
const SELECTORS = {
  title: [
    'h1[slot="title"]',           // new.reddit shreddit layout
    '[data-testid="post-title"]', // older layout
  ],
  creator: [
    'a[data-testid="post_author_link"]',  // post author link
    'a[data-click-id="user"]',            // fallback
  ],
  body: [
    '[data-click-id="text"] > div',       // text post body
    '[data-testid="post-container"] [data-click-id="text"]',
  ],
};

function queryFirstNonEmpty(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) return el;
  }
  return null;
}

/**
 * Extract metadata from a Reddit post page.
 * Returns null if not on a post page.
 */
export function extractReddit() {
  if (!location.hostname.includes('reddit.com')) return null;
  if (!location.pathname.includes('/comments/')) return null;

  // TODO: implement selector extraction
  const titleEl   = queryFirstNonEmpty(SELECTORS.title);
  const creatorEl = queryFirstNonEmpty(SELECTORS.creator);
  const bodyEl    = queryFirstNonEmpty(SELECTORS.body);

  const title   = titleEl   ? titleEl.textContent.trim()            : null;
  const creator = creatorEl ? creatorEl.textContent.replace(/^u\//, '').trim() : null;
  const body    = bodyEl    ? bodyEl.textContent.trim().slice(0, 1000) : null;

  return {
    platform: 'reddit',
    content_type: 'post',
    url: location.href,
    title,
    creator,
    visible_text: [title, body].filter(Boolean).join('\n\n') || null,
    captured_at: new Date().toISOString(),
    _dedup_key: location.pathname,  // unique per post; stays stable even if ?sort= changes
  };
}
