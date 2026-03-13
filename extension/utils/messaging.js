// utils/messaging.js — ScrollSense messaging helpers
//
// Chrome MV3 has no direct background→panel broadcast. The pattern here:
//   content script  →  chrome.runtime.sendMessage  →  background.js
//   background.js   →  chrome.runtime.sendMessage  →  side panel (same runtime)
//
// The side panel registers a listener via onPanelMessage().
// The background calls sendToPanel() which broadcasts to all extension pages.

/**
 * Called by background.js to relay a message to the side panel.
 * Works by broadcasting to all extension pages (side panel listens on the same runtime).
 * @param {object} message
 */
export function sendToPanel(message) {
  // chrome.runtime.sendMessage reaches all extension pages including the side panel.
  chrome.runtime.sendMessage(message).catch(() => {
    // Panel may not be open yet — silently ignore.
  });
}

/**
 * Called by sidepanel.js to subscribe to incoming messages.
 * Filters out messages that originated from the panel itself.
 * @param {(message: object) => void} handler
 */
export function onPanelMessage(handler) {
  chrome.runtime.onMessage.addListener((message, sender) => {
    // Ignore messages from content scripts (those go to background first).
    // We only care about messages the background re-broadcasts.
    if (sender.tab) return; // came from a content script, not background
    handler(message);
  });
}
