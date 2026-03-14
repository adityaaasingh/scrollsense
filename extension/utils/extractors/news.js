// utils/extractors/news.js — Generic news article extraction stub
//
// HOW TO ACTIVATE:
//   1. Add the target news domains to manifest.json:
//        host_permissions: "https://*.bbc.com/*", "https://*.theguardian.com/*", ...
//        content_scripts.matches: the same list
//   2. Register a test function per domain in content.js EXTRACTORS:
//        { test: (h) => NEWS_DOMAINS.some(d => h.includes(d)), extract: extractNews }
//   3. Refine selectors per publication as needed (see PUBLICATION_SELECTORS below).
//
// This extractor uses Open Graph meta tags as a universal fallback — they are
// present on virtually all modern news sites and require no DOM-specific selectors.

'use strict';

// ── Target news domains ───────────────────────────────────────────────────────
// Add domains here and mirror them in manifest.json + content.js.
export const NEWS_DOMAINS = [
  'bbc.com', 'bbc.co.uk',
  'theguardian.com',
  'reuters.com',
  'apnews.com',
  'nytimes.com',
  'washingtonpost.com',
  'bloomberg.com',
  // TODO: extend as needed
];

// ── Universal meta-tag selectors (works on most news sites) ──────────────────
function metaContent(nameOrProperty) {
  const el =
    document.querySelector(`meta[property="${nameOrProperty}"]`) ||
    document.querySelector(`meta[name="${nameOrProperty}"]`);
  return el?.getAttribute('content')?.trim() || null;
}

// ── Publication-specific DOM overrides ───────────────────────────────────────
// Add per-publication selector sets here when Open Graph is insufficient.
const PUBLICATION_SELECTORS = {
  // 'bbc.com': { title: 'h1#main-heading', creator: '[class*="author"] span' },
  // 'theguardian.com': { title: 'h1.dcr-1y3msnn', creator: '[class*="byline"] a' },
  // TODO: add per-publication overrides
};

function getDomainKey(hostname) {
  return Object.keys(PUBLICATION_SELECTORS).find((d) => hostname.includes(d));
}

/**
 * Extract metadata from a news article page.
 * Returns null if the page doesn't look like an article.
 */
export function extractNews() {
  const hostname = location.hostname;
  if (!NEWS_DOMAINS.some((d) => hostname.includes(d))) return null;

  // Require an og:type of "article" or a likely article URL path.
  const ogType = metaContent('og:type');
  const isArticle = ogType === 'article' || /\/\d{4}\//.test(location.pathname);
  if (!isArticle) return null;

  // ── Prefer Open Graph tags (most reliable cross-site) ────────────────────
  let title   = metaContent('og:title') || metaContent('twitter:title') || document.title.trim();
  let creator = metaContent('article:author') || metaContent('author');
  let body    = metaContent('og:description') || metaContent('description');

  // ── Publication-specific DOM fallbacks ───────────────────────────────────
  const domKey = getDomainKey(hostname);
  if (domKey) {
    const sels = PUBLICATION_SELECTORS[domKey];
    // TODO: implement DOM querying for this publication
    void sels; // suppress unused-variable lint until implemented
  }

  // Strip site name suffix from title (e.g. " | BBC News", " - The Guardian").
  if (title) title = title.replace(/\s*[|–\-]\s*(BBC|Guardian|Reuters|AP|NYT|Bloomberg).*$/i, '').trim();

  return {
    platform: 'news',
    content_type: 'article',
    url: location.href,
    title: title || null,
    creator: creator || null,
    visible_text: [title, body].filter(Boolean).join('\n\n').slice(0, 1000) || null,
    captured_at: new Date().toISOString(),
    _dedup_key: location.pathname,
  };
}
