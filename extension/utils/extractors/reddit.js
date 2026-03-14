// utils/extractors/reddit.js — Reddit post extraction
//
// ALREADY ACTIVE: registered in content.js EXTRACTORS + manifest.json.
//
// creator field = subreddit name (e.g. "r/programming"), not post author.
// Subreddit is a more stable identity for session pattern detection; it lets the
// session analyzer catch "subreddit binges" the same way it catches creator loops.
//
// The normalized payload shape is unchanged — only the extraction logic is here.

'use strict';

// ── Title selectors ───────────────────────────────────────────────────────────
// Ordered most-specific first. shreddit-post attribute is tried before DOM.
const TITLE_SELECTORS = [
  'h1[slot="title"]',            // shreddit <shreddit-post> slot
  '[data-testid="post-title"]',  // legacy new.reddit
  'h1.title',                    // old.reddit
];

// ── Body selectors ────────────────────────────────────────────────────────────
const BODY_SELECTORS = [
  'shreddit-post [slot="text-body"]',                     // shreddit
  '[data-click-id="text"] > div',                         // legacy new.reddit
  '[data-testid="post-container"] [data-click-id="text"]', // legacy fallback
  'div[data-click-id="text"]',                            // old.reddit
];

function queryFirstNonEmpty(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) return el;
  }
  return null;
}

// ── Subreddit detection ───────────────────────────────────────────────────────
// Three tiers, most reliable first. The URL fallback always works for
// /r/<sub>/comments/<id>/... pages so extraction never fails silently.

function redditSubreddit() {
  // 1. shreddit-post web component exposes subreddit-prefixed-name as an attribute.
  //    This is the most direct and stable source in the new layout.
  const post = document.querySelector('shreddit-post');
  if (post) {
    const attr = post.getAttribute('subreddit-prefixed-name');
    if (attr) return attr;  // already "r/subredditname"
  }

  // 2. Legacy new.reddit: subreddit link rendered near the post header.
  const subLink = document.querySelector('a[data-click-id="subreddit"]');
  if (subLink?.textContent.trim()) return subLink.textContent.trim();

  // 3. URL fallback — always available on post pages.
  const m = location.pathname.match(/\/r\/([^/]+)/);
  return m ? `r/${m[1]}` : null;
}

// ── Title detection ───────────────────────────────────────────────────────────

function redditTitle() {
  // shreddit-post may expose the title as a post-title attribute.
  const post = document.querySelector('shreddit-post');
  if (post) {
    const attr = post.getAttribute('post-title');
    if (attr) return attr;
  }
  const el = queryFirstNonEmpty(TITLE_SELECTORS);
  return el ? el.textContent.trim() : null;
}

// ── Main extractor ────────────────────────────────────────────────────────────

/**
 * Extract metadata from a Reddit post page.
 * Returns null if not on a /r/*/comments/* URL or if no content is found.
 */
export function extractReddit() {
  if (!location.hostname.includes('reddit.com')) return null;
  if (!location.pathname.includes('/comments/')) return null;

  const subreddit = redditSubreddit();
  const title     = redditTitle();
  const bodyEl    = queryFirstNonEmpty(BODY_SELECTORS);
  const body      = bodyEl ? bodyEl.textContent.trim().slice(0, 1000) : null;

  // Guard: at least one of title or subreddit must be present.
  if (!title && !subreddit) return null;

  return {
    platform:     'reddit',
    content_type: 'post',
    url:          location.href,
    title:        title ?? subreddit,  // subreddit as title fallback (rare edge case)
    creator:      subreddit,           // r/subredditname — primary grouping identity
    visible_text: [title, body].filter(Boolean).join('\n\n') || null,
    captured_at:  new Date().toISOString(),
    _dedup_key:   location.pathname,   // stable per post; ignores ?sort= and fragments
  };
}
