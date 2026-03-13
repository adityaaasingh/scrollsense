// utils/extractors/youtube.js — YouTube-specific DOM extraction
// Returns a normalized ScrollSense payload or null if the page isn't a watch page.
// All YouTube selector logic lives here; content.js stays platform-agnostic.

'use strict';

// ── Creator selectors ─────────────────────────────────────────────────────────
// YouTube uses yt-formatted-string#text (id="text") as the actual text node
// inside every ytd-channel-name component. Selectors are ordered most-specific
// to broadest; first non-empty match wins.
const CREATOR_SELECTORS = [
  // Current layout (2025-2026): owner panel below the player
  'ytd-video-owner-renderer ytd-channel-name yt-formatted-string#text',
  'ytd-video-owner-renderer #channel-name yt-formatted-string#text',
  '#owner ytd-channel-name yt-formatted-string#text',
  '#above-the-fold ytd-channel-name yt-formatted-string#text',
  // Broader yt-formatted-string#text fallback (still scoped by context)
  'ytd-channel-name yt-formatted-string#text',
  // Anchor-based fallbacks — text content of the channel link
  'ytd-video-owner-renderer a.ytd-channel-name',
  'ytd-video-owner-renderer a.yt-simple-endpoint.ytd-channel-name',
  // Unscoped fallbacks for edge layouts
  '#channel-name yt-formatted-string#text',
  '#channel-name yt-formatted-string',
  // Legacy layouts
  '#owner-name a',
  'ytd-video-owner-renderer #channel-name a',
];

const TITLE_SELECTORS = [
  'h1.ytd-watch-metadata yt-formatted-string',
  'h1.title.ytd-video-primary-info-renderer',
  '#above-the-fold #title h1',
];

const DESCRIPTION_SELECTORS = [
  '#description-inline-expander yt-attributed-string',
  '#description yt-formatted-string',
  'ytd-expander#description yt-formatted-string',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function queryFirstNonEmpty(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) return el;
  }
  return null;
}

function extractTitle() {
  const raw = document.title.replace(/\s*[-–|]\s*YouTube\s*$/, '').trim();
  if (raw && raw !== 'YouTube') return raw;
  const el = queryFirstNonEmpty(TITLE_SELECTORS);
  return el ? el.textContent.trim() : null;
}

function extractCreator() {
  const el = queryFirstNonEmpty(CREATOR_SELECTORS);
  return el ? el.textContent.trim() : null;
}

function extractVisibleText() {
  const parts = [];
  const title = extractTitle();
  if (title) parts.push(title);
  const descEl = queryFirstNonEmpty(DESCRIPTION_SELECTORS);
  if (descEl) parts.push(descEl.textContent.trim().slice(0, 1000));
  return parts.join('\n\n') || null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract metadata for the current YouTube watch page.
 * @returns {object|null}
 */
export function extractYouTube() {
  if (!location.hostname.includes('youtube.com')) return null;
  if (!location.pathname.startsWith('/watch')) return null;

  const videoId = new URLSearchParams(location.search).get('v');
  if (!videoId) return null;

  return {
    platform: 'youtube',
    content_type: 'video',
    url: location.href,
    title: extractTitle(),
    creator: extractCreator(),
    visible_text: extractVisibleText(),
    captured_at: new Date().toISOString(),
    _videoId: videoId,
  };
}
