// background.js — ScrollSense service worker
// Manages side panel lifecycle and routes messages between content scripts and the panel.

import { sendToPanel } from './utils/messaging.js';

// Open the side panel when the user clicks the extension action icon.
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Allow each tab to show the side panel independently.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.sidePanel.setOptions({
    tabId,
    path: 'sidepanel.html',
    enabled: true,
  });
});

// Relay messages from content scripts to the side panel.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_DETECTED') {
    // Forward the video metadata to whoever is listening (side panel).
    sendToPanel(message);
    sendResponse({ ok: true });
  }
  // Return false — we don't need to keep the channel open.
  return false;
});
