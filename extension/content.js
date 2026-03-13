// content.js — ScrollSense content script
// Runs on YouTube pages. Extracts video metadata and notifies the background worker.
// Platform-agnostic structure: swap out extractPlatformData() to support Reddit/X/news later.

(function () {
  'use strict';

  let lastVideoId = null;

  // ---------- Platform-specific extraction (YouTube) ----------

  function extractYouTubeData() {
    const url = location.href;

    // Only act on watch pages.
    if (!url.includes('/watch')) return null;

    const params = new URLSearchParams(location.search);
    const videoId = params.get('v');
    if (!videoId) return null;

    // Title — prefer the canonical <title> tag; YouTube updates it dynamically.
    const rawTitle = document.title.replace(' - YouTube', '').trim();
    const title = rawTitle || null;

    // Channel name — the main channel link below the video player.
    const channelEl =
      document.querySelector('ytd-channel-name yt-formatted-string') ||
      document.querySelector('#channel-name yt-formatted-string') ||
      document.querySelector('#owner-name a');
    const channel = channelEl ? channelEl.textContent.trim() : null;

    return { platform: 'youtube', videoId, title, channel, url };
  }

  // ---------- Generic extraction entry point ----------

  function extractPlatformData() {
    // Add elif branches here for Reddit, X, news, etc.
    if (location.hostname.includes('youtube.com')) {
      return extractYouTubeData();
    }
    return null;
  }

  // ---------- Notify background ----------

  function notifyBackground(data) {
    chrome.runtime.sendMessage({ type: 'VIDEO_DETECTED', payload: data });
  }

  // ---------- Observe URL / title changes (YouTube is an SPA) ----------

  function checkAndNotify() {
    const data = extractPlatformData();
    if (!data) return;

    // Debounce: only fire when the video actually changes.
    if (data.videoId === lastVideoId) return;
    lastVideoId = data.videoId;

    notifyBackground(data);
  }

  // YouTube mutates the DOM heavily — watch for title changes as a reliable proxy.
  const titleObserver = new MutationObserver(checkAndNotify);
  titleObserver.observe(document.querySelector('title') || document.head, {
    subtree: true,
    characterData: true,
    childList: true,
  });

  // Also fire on initial load.
  checkAndNotify();
})();
