import { useState, useEffect } from 'react';

const ALL_TIME_KEY = 'scrollsense_all_time_log';
const BACKEND = 'http://localhost:8000';

export function useExtensionData() {
  const [state, setState] = useState({
    allTimeLog: [],
    dashboardData: null,
    loading: true,
    error: null,
    lastSynced: null,
  });

  async function load() {
    try {
      // Read from chrome.storage.local (available because this is an extension page).
      const chromeStorage = typeof chrome !== 'undefined' ? chrome.storage?.local : null;
      let allTimeLog = [];

      if (chromeStorage) {
        const result = await chromeStorage.get(ALL_TIME_KEY);
        allTimeLog = result[ALL_TIME_KEY] ?? [];
      }

      setState((prev) => ({ ...prev, allTimeLog }));

      if (allTimeLog.length === 0) {
        setState((prev) => ({ ...prev, loading: false, lastSynced: new Date() }));
        return;
      }

      const response = await fetch(`${BACKEND}/analyze/dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: allTimeLog }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const dashboardData = await response.json();
      setState((prev) => ({
        ...prev,
        dashboardData,
        loading: false,
        error: null,
        lastSynced: new Date(),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
        lastSynced: new Date(),
      }));
    }
  }

  useEffect(() => {
    load();

    // Watch for new items being added by background.js.
    const chromeStorage = typeof chrome !== 'undefined' ? chrome.storage?.onChanged : null;
    if (!chromeStorage) return;

    const listener = (changes, area) => {
      if (area === 'local' && changes[ALL_TIME_KEY]) {
        load();
      }
    };
    chromeStorage.addListener(listener);
    return () => chromeStorage.removeListener(listener);
  }, []);

  return state;
}
