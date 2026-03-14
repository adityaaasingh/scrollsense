// content.js — ScrollSense content script (platform-agnostic coordinator)
// Runs as an IIFE — content scripts cannot use top-level ES module imports.
// Platform extractors are inlined via the build step or, for now, loaded via
// a dynamic registry pattern at the bottom of this file.
//
// To add Reddit/X/news: implement utils/extractors/<platform>.js and register
// it in EXTRACTORS below. content.js never needs to change again.

(function () {
  'use strict';

  // ─── Extractor registry ──────────────────────────────────────────────────
  // Each entry: { test: (hostname) => bool, extract: () => payload | null }
  // Listed in priority order; first match wins.
  //
  // TO ADD A PLATFORM:
  //   1. Implement utils/extractors/<platform>.js (use reddit.js / x.js / news.js as templates).
  //   2. Inline the extractor function into this IIFE (content scripts can't import modules).
  //   3. Add an entry below — the coordinator and background.js require no other changes.
  //   4. Update manifest.json: add host_permissions + content_scripts.matches for the new domain.

  const EXTRACTORS = [
    {
      test: (h) => h.includes('youtube.com'),
      extract: extractYouTube,    // ← inlined below from utils/extractors/youtube.js
    },
    {
      test: (h) => h.includes('reddit.com'),
      extract: extractReddit,     // ← inlined below from utils/extractors/reddit.js
    },
    {
      test: (h) => h.includes('x.com') || h.includes('twitter.com'),
      extract: extractX,          // ← inlined below from utils/extractors/x.js
    },

    // ── Plug future platforms in here ──────────────────────────────────────
    // { test: (h) => NEWS_DOMAINS.some((d) => h.includes(d)),
    //   extract: extractNews },    // ← inline utils/extractors/news.js
    //   (NEWS_DOMAINS exported from news.js — inline that array here too)
  ];

  // ─── YouTube extractor (inlined) ─────────────────────────────────────────
  // Kept in sync with utils/extractors/youtube.js — that file is the
  // authoritative source used by any build pipeline; this inline copy is for
  // the no-build dev workflow.

  // Creator selectors: yt-formatted-string#text is the actual text node YouTube
  // uses inside every ytd-channel-name component. Ordered most-specific first.
  const YT_CREATOR_SELECTORS = [
    'ytd-video-owner-renderer ytd-channel-name yt-formatted-string#text',
    'ytd-video-owner-renderer #channel-name yt-formatted-string#text',
    '#owner ytd-channel-name yt-formatted-string#text',
    '#above-the-fold ytd-channel-name yt-formatted-string#text',
    'ytd-channel-name yt-formatted-string#text',
    'ytd-video-owner-renderer a.ytd-channel-name',
    'ytd-video-owner-renderer a.yt-simple-endpoint.ytd-channel-name',
    '#channel-name yt-formatted-string#text',
    '#channel-name yt-formatted-string',
    '#owner-name a',
    'ytd-video-owner-renderer #channel-name a',
  ];

  const YT_TITLE_SELECTORS = [
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.title.ytd-video-primary-info-renderer',
    '#above-the-fold #title h1',
  ];

  const YT_DESC_SELECTORS = [
    '#description-inline-expander yt-attributed-string',
    '#description yt-formatted-string',
    'ytd-expander#description yt-formatted-string',
  ];

  function queryFirstNonEmpty(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el;
    }
    return null;
  }

  function ytTitle() {
    const raw = document.title.replace(/\s*[-–|]\s*YouTube\s*$/, '').trim();
    if (raw && raw !== 'YouTube') return raw;
    const el = queryFirstNonEmpty(YT_TITLE_SELECTORS);
    return el ? el.textContent.trim() : null;
  }

  function ytCreator() {
    const el = queryFirstNonEmpty(YT_CREATOR_SELECTORS);
    return el ? el.textContent.trim() : null;
  }

  function ytVisibleText() {
    const parts = [];
    const title = ytTitle();
    if (title) parts.push(title);
    const descEl = queryFirstNonEmpty(YT_DESC_SELECTORS);
    if (descEl) parts.push(descEl.textContent.trim().slice(0, 1000));
    return parts.join('\n\n') || null;
  }

  function extractYouTube() {
    if (!location.pathname.startsWith('/watch')) return null;
    const videoId = new URLSearchParams(location.search).get('v');
    if (!videoId) return null;

    return {
      platform: 'youtube',
      content_type: 'video',
      url: location.href,
      title: ytTitle(),
      creator: ytCreator(),
      visible_text: ytVisibleText(),
      captured_at: new Date().toISOString(),
      _dedup_key: videoId,             // stripped before sending; used only for dedup
    };
  }

  // ─── Reddit extractor (inlined) ──────────────────────────────────────────
  // Kept in sync with utils/extractors/reddit.js.
  // Handles both the legacy layout and the 2024+ shreddit web-component layout.

  const REDDIT_TITLE_SELECTORS = [
    'h1[slot="title"]',               // shreddit <shreddit-post> component
    '[data-testid="post-title"]',     // legacy layout
    'h1.title',                       // very old layout
  ];

  const REDDIT_CREATOR_SELECTORS = [
    'a[data-testid="post_author_link"]',   // legacy
    'a[data-click-id="user"]',             // legacy fallback
    'shreddit-post [slot="authorName"] a', // shreddit
    'span[data-testid="post_author_link"]',
  ];

  const REDDIT_BODY_SELECTORS = [
    '[data-click-id="text"] > div',
    '[data-testid="post-container"] [data-click-id="text"]',
    'shreddit-post [slot="text-body"]',
  ];

  function extractReddit() {
    if (!location.hostname.includes('reddit.com')) return null;
    if (!location.pathname.includes('/comments/')) return null;

    const titleEl   = queryFirstNonEmpty(REDDIT_TITLE_SELECTORS);
    const creatorEl = queryFirstNonEmpty(REDDIT_CREATOR_SELECTORS);
    const bodyEl    = queryFirstNonEmpty(REDDIT_BODY_SELECTORS);

    const title   = titleEl   ? titleEl.textContent.trim() : null;
    const creator = creatorEl
      ? creatorEl.textContent.replace(/^u\//, '').trim()
      : null;
    const body    = bodyEl    ? bodyEl.textContent.trim().slice(0, 1000) : null;

    // Require at least a title to avoid sending empty payloads on non-post pages.
    if (!title) return null;

    return {
      platform: 'reddit',
      content_type: 'post',
      url: location.href,
      title,
      creator,
      visible_text: [title, body].filter(Boolean).join('\n\n') || null,
      captured_at: new Date().toISOString(),
      _dedup_key: location.pathname,  // stable per post regardless of ?sort= changes
    };
  }

  // ─── X / Twitter extractor (inlined) ─────────────────────────────────────
  // Kept in sync with utils/extractors/x.js.
  // X is an aggressive SPA; selectors use data-testid hooks (most stable).

  const X_TEXT_SELECTORS = [
    '[data-testid="tweetText"]',        // primary tweet text on /status/ page
    'article [lang] > span',            // fallback text span
  ];

  const X_AUTHOR_SELECTORS = [
    // Display name (not @handle) — first non-handle span inside User-Name
    '[data-testid="User-Name"] span:not([dir="ltr"])',
    'article [data-testid="User-Name"] span:first-child',
    '[data-testid="User-Name"] a[href*="/"] span',
  ];

  function xTweetIdFromUrl() {
    const match = location.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  function extractX() {
    const host = location.hostname;
    if (!host.includes('x.com') && !host.includes('twitter.com')) return null;

    const tweetId = xTweetIdFromUrl();
    if (!tweetId) return null;   // not on a single-tweet page

    const textEl   = queryFirstNonEmpty(X_TEXT_SELECTORS);
    const authorEl = queryFirstNonEmpty(X_AUTHOR_SELECTORS);

    const text    = textEl   ? textEl.textContent.trim().slice(0, 1000) : null;
    const creator = authorEl ? authorEl.textContent.trim() : null;

    // X posts have no title — use leading text as a surrogate.
    const title = text ? text.slice(0, 120) : null;

    // Require at least tweet text to avoid empty payloads.
    if (!text) return null;

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

  // ─── Core coordinator ────────────────────────────────────────────────────

  let lastDedupKey = null;
  let lastCreatorPresent = false;
  let debounceTimer = null;
  const DEBOUNCE_MS = 600;   // absorbs rapid DOM mutations during SPA nav

  function getExtractor() {
    const hostname = location.hostname;
    const entry = EXTRACTORS.find((e) => e.test(hostname));
    return entry ? entry.extract : null;
  }

  function extractAndSend() {
    const extract = getExtractor();
    if (!extract) return;

    const payload = extract();
    if (!payload) return;

    // Deduplicate: skip if the content key hasn't changed since last send.
    // Exception: if creator was missing last time and is now available, let it
    // through so the retry at +1500ms can send an enriched payload.
    const key = payload._dedup_key || payload.url;
    if (key === lastDedupKey && lastCreatorPresent) return;
    lastDedupKey = key;
    lastCreatorPresent = !!payload.creator;

    // Strip internal fields before sending.
    const { _dedup_key, ...normalized } = payload;

    chrome.runtime.sendMessage({ type: 'CONTENT_DETECTED', payload: normalized });
  }

  function scheduleSend() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(extractAndSend, DEBOUNCE_MS);
  }

  // ─── SPA navigation detection ────────────────────────────────────────────
  // YouTube never does a full page reload; we need three hooks to catch all cases:
  //   1. history.pushState / replaceState  — catches in-app link clicks
  //   2. popstate                          — catches back/forward
  //   3. MutationObserver on <title>       — catches post-navigation DOM settle

  // Patch history methods (safe: only wraps, never removes original).
  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);

  history.pushState = function (...args) {
    _push(...args);
    scheduleSend();
  };
  history.replaceState = function (...args) {
    _replace(...args);
    scheduleSend();
  };

  window.addEventListener('popstate', scheduleSend);

  // Watch <title> for the final settled value after DOM hydration.
  const titleTarget = document.querySelector('title') || document.head;
  new MutationObserver(scheduleSend).observe(titleTarget, {
    subtree: true,
    characterData: true,
    childList: true,
  });

  // ─── Initial extraction ──────────────────────────────────────────────────
  // DOM might not be ready for selectors on first inject; retry briefly.
  extractAndSend();
  setTimeout(extractAndSend, 1500);   // catch late-hydrating elements

})();
