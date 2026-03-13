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

  const EXTRACTORS = [
    {
      test: (h) => h.includes('youtube.com'),
      extract: extractYouTube,          // defined below (inlined from youtube.js)
    },
    // Future:
    // { test: (h) => h.includes('reddit.com'), extract: extractReddit },
    // { test: (h) => h.includes('twitter.com') || h.includes('x.com'), extract: extractX },
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
