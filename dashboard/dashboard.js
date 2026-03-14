/**
 * dashboard.js — ScrollSense Personal Dashboard
 *
 * Single-user dashboard for Jean.
 *
 * Data seam: replace getData() body with a real fetch() call when the
 * backend endpoint is ready. All renderers below are data-driven and
 * require no changes.
 */

'use strict';

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DATA = {
  user: {
    name:        'Jean',
    initials:    'J',
    avatarColor: '#f87171',

    session: {
      startedAt:   '10:18 AM',
      duration:    '2h 14m',
      postsToday:  47,
      platforms:   ['X', 'Reddit'],
    },

    pattern: {
      label: 'Rage Feed',
      color: '#f87171',
      emoji: '⚡',
      // 0–100 diversity score (derived from spread across categories/creators/platforms)
      diversityScore: 18,
      summary: 'Predominantly consuming high-emotion political content across X and Reddit. Creator concentration is high — the same outrage-adjacent accounts dominate every session.',
    },

    headline:  'Caught in the outrage loop',
    storyLine: "You've been in a high-emotion political spiral for over two hours. Your feed is becoming more reactive as the session continues.",

    feedDiagnosis: {
      headline: 'Algorithmically trapped',
      detail:   "High-emotion content is surfacing at 3× baseline. Three accounts drive 68% of your attention — a creator lock-in pattern that's intensifying over time.",
      severity: 'high',
    },

    driftAlert: {
      active:  true,
      message: 'Outrage-adjacent content up 34% vs. session start.',
      trend:   'increasing',
    },

    // ── Analytics metrics ──────────────────────────────────────────────────
    // These six metrics answer the core questions of the dashboard.
    analytics: {

      // How varied is the content across categories, creators, and platforms?
      contentDiversity: {
        score:          18,        // 0–100
        interpretation: 'Very Low',
        detail:         'Feed is tightly clustered around one topic and 3 creators.',
        comparison:     'Average user: 51 / 100',
        color:          '#f87171',
      },

      // What share of the feed do the top few creators account for?
      creatorConcentration: {
        topPct:      68,           // % of posts from top N creators
        topN:        3,
        detail:      '3 accounts drove 68% of today\'s posts.',
        color:       '#fbbf24',
        topCreators: [
          { name: '@BreakingPolitics', pct: 0.34 },
          { name: '@OutrageReport',    pct: 0.21 },
          { name: 'r/politics',        pct: 0.13 },
        ],
      },

      // How deep into a single-topic or single-creator loop is the session?
      rabbitHole: {
        score:    7.8,             // 0–10; higher = deeper spiral
        severity: 'High',
        detail:   'Locked on political content for 2h 14m without a break.',
        color:    '#f87171',
      },

      // How much has the emotional tone of the feed shifted since session start?
      sessionDrift: {
        deltaPct:  42,             // % increase in high-emotion share
        direction: 'up',
        fromPct:   31,             // emotional share at session start
        toPct:     52,             // emotional share now
        detail:    'High-emotion content share grew steadily throughout the session.',
        color:     '#fb923c',
      },

      // Average emotional intensity of classified content (model score).
      emotionalIntensity: {
        score:      8.4,           // 0–10
        detail:     'Content is triggering high emotional engagement.',
        comparison: 'Avg content baseline: 5.2 / 10',
        color:      '#f87171',
      },

      // Ratio of actively searched vs algorithmically surfaced content.
      intentionalVsPassive: {
        intentionalPct: 0.18,      // 18% intentional / searched
        passivePct:     0.82,      // 82% algorithmic / surfaced
        detail:         '82% of content was algorithmically surfaced — not actively chosen.',
        color:          '#9ca3af',
      },
    },

    categoryBreakdown: [
      { shortLabel: 'High-Emotion',  pct: 0.52, color: '#f87171' },
      { shortLabel: 'Opinion',       pct: 0.29, color: '#fbbf24' },
      { shortLabel: 'Credible News', pct: 0.11, color: '#2dd4bf' },
      { shortLabel: 'Other',         pct: 0.08, color: '#6b7280' },
    ],

    recommendations: [
      'Follow 2–3 credible news sources to break creator lock-in',
      'Set a 20-min session cap on political content feeds',
      'Try r/science or r/explainlikeimfive for a tonal contrast',
    ],

    recentItems: [
      { title: "They're hiding this from you — the real cost of the new bill",      platformLabel: '𝕏',  categoryEmoji: '⚡', categoryColor: '#f87171' },
      { title: 'Politicians are FURIOUS about this proposal that would end their…', platformLabel: 'r/', categoryEmoji: '⚡', categoryColor: '#f87171' },
      { title: 'My take on why everything is broken right now',                     platformLabel: '𝕏',  categoryEmoji: '💬', categoryColor: '#fbbf24' },
      { title: 'BREAKING: Major policy reversal sends markets into freefall',       platformLabel: '𝕏',  categoryEmoji: '📰', categoryColor: '#2dd4bf' },
    ],

    lastUpdated: '2026-03-14T10:32:00Z',
  },
};

// ── Data layer ────────────────────────────────────────────────────────────────

async function getData() {
  // ↓ Replace with real API call when backend is ready:
  // const res = await fetch('/api/dashboard');
  // if (!res.ok) throw new Error(`API error ${res.status}`);
  // return res.json();
  return Promise.resolve(MOCK_DATA);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPct(frac) {
  return `${Math.round(frac * 100)}%`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Component: user identity hero ─────────────────────────────────────────────

function renderUserHero(user) {
  const { session, pattern } = user;
  const platforms = session.platforms.join(' · ');
  return `
    <div class="hero-left">
      <div class="avatar hero-avatar" style="--avatar-color: ${esc(user.avatarColor)}">${esc(user.initials)}</div>
      <div class="hero-identity">
        <div class="hero-name-row">
          <span class="hero-name">${esc(user.name)}</span>
          <span class="hero-session-info">Active since ${esc(session.startedAt)} · ${esc(session.duration)}</span>
        </div>
        <div class="hero-badges">
          <span class="pattern-badge" style="--pattern-color: ${esc(pattern.color)}">${esc(pattern.emoji)} ${esc(pattern.label)}</span>
          <span class="diversity-pill">${pattern.diversityScore}/100 diverse</span>
          <span class="platform-info">${esc(platforms)}</span>
        </div>
      </div>
    </div>
    <div class="hero-right">
      <div class="hero-stat">
        <span class="hero-stat-val">${esc(String(session.postsToday))}</span>
        <span class="hero-stat-label">posts today</span>
      </div>
    </div>
  `;
}

// ── Component: KPI strip ──────────────────────────────────────────────────────

function renderKPIs(user) {
  const { session, analytics, categoryBreakdown } = user;
  const highEmotionPct = categoryBreakdown.find(c => c.shortLabel === 'High-Emotion')?.pct ?? 0;

  const kpis = [
    { label: 'Posts Today',       value: session.postsToday,                              sub: `${session.platforms.join(', ')}` },
    { label: 'Session Length',    value: session.duration,                                 sub: `started ${session.startedAt}` },
    { label: 'High-Emotion Rate', value: fmtPct(highEmotionPct),                          sub: 'of classified posts',  accent: true },
    { label: 'Diversity Score',   value: `${analytics.contentDiversity.score}/100`,        sub: 'feed variety',         dim: true },
  ];

  return kpis.map(({ label, value, sub, accent, dim }) => `
    <div class="kpi-card">
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-value${accent ? ' kpi-value--accent' : dim ? ' kpi-value--dim' : ''}">${esc(String(value))}</span>
      <span class="kpi-sub">${esc(sub)}</span>
    </div>
  `).join('');
}

// ── Component: story banner ───────────────────────────────────────────────────

function renderStoryBanner(user) {
  return `
    <span class="story-eyebrow">Your Session</span>
    <p class="story-line">${esc(user.storyLine)}</p>
  `;
}

// ── Component: analytics grid (6 metric cards) ────────────────────────────────

function renderAnalytics(a) {
  return [
    renderDiversityCard(a.contentDiversity),
    renderCreatorConcentrationCard(a.creatorConcentration),
    renderRabbitHoleCard(a.rabbitHole),
    renderSessionDriftCard(a.sessionDrift),
    renderEmotionalIntensityCard(a.emotionalIntensity),
    renderIntentionalCard(a.intentionalVsPassive),
  ].join('');
}

function renderDiversityCard(d) {
  const barPct = d.score / 100;
  return `
    <div class="metric-card">
      <div class="metric-eyebrow">Content Diversity</div>
      <div class="metric-value-row">
        <span class="metric-value" style="color: ${esc(d.color)}">${d.score}</span>
        <span class="metric-unit">/ 100</span>
        <span class="metric-badge" style="--badge-color: ${esc(d.color)}">${esc(d.interpretation)}</span>
      </div>
      <div class="metric-bar-track">
        <div class="metric-bar-fill" data-pct="${barPct}" style="background: ${esc(d.color)}"></div>
      </div>
      <p class="metric-detail">${esc(d.detail)}</p>
      <span class="metric-comparison">${esc(d.comparison)}</span>
    </div>
  `;
}

function renderCreatorConcentrationCard(d) {
  const creatorRows = d.topCreators.map(c => `
    <div class="creator-row">
      <span class="creator-name">${esc(c.name)}</span>
      <div class="metric-bar-track creator-bar-track">
        <div class="metric-bar-fill" data-pct="${c.pct}" style="background: ${esc(d.color)}"></div>
      </div>
      <span class="creator-pct">${fmtPct(c.pct)}</span>
    </div>
  `).join('');

  return `
    <div class="metric-card">
      <div class="metric-eyebrow">Creator Concentration</div>
      <div class="metric-value-row">
        <span class="metric-value" style="color: ${esc(d.color)}">${d.topPct}%</span>
        <span class="metric-unit">from ${d.topN} accounts</span>
      </div>
      <div class="creator-list">${creatorRows}</div>
      <p class="metric-detail">${esc(d.detail)}</p>
    </div>
  `;
}

function renderRabbitHoleCard(d) {
  const barPct = d.score / 10;
  return `
    <div class="metric-card">
      <div class="metric-eyebrow">Rabbit Hole Score</div>
      <div class="metric-value-row">
        <span class="metric-value" style="color: ${esc(d.color)}">${d.score}</span>
        <span class="metric-unit">/ 10</span>
        <span class="metric-badge" style="--badge-color: ${esc(d.color)}">${esc(d.severity)}</span>
      </div>
      <div class="metric-bar-track">
        <div class="metric-bar-fill" data-pct="${barPct}" style="background: ${esc(d.color)}"></div>
      </div>
      <p class="metric-detail">${esc(d.detail)}</p>
    </div>
  `;
}

function renderSessionDriftCard(d) {
  const arrowLabel = d.direction === 'up' ? '↑ Rising' : d.direction === 'down' ? '↓ Falling' : '→ Stable';
  const arrowColor = d.direction === 'up' ? '#fb923c' : d.direction === 'down' ? '#4ade80' : '#9ca3af';
  return `
    <div class="metric-card">
      <div class="metric-eyebrow">Session Drift</div>
      <div class="metric-value-row">
        <span class="metric-value" style="color: ${esc(d.color)}">+${d.deltaPct}%</span>
        <span class="metric-badge" style="--badge-color: ${esc(arrowColor)}">${esc(arrowLabel)}</span>
      </div>
      <div class="drift-comparison">
        <div class="drift-point">
          <span class="drift-pct">${d.fromPct}%</span>
          <span class="drift-label">start</span>
        </div>
        <div class="drift-track">
          <div class="drift-bar drift-bar--before" style="width: ${d.fromPct}%; background: color-mix(in srgb, ${esc(d.color)} 40%, transparent)"></div>
          <div class="drift-bar drift-bar--after"  style="width: ${d.toPct}%;   background: ${esc(d.color)}"></div>
        </div>
        <div class="drift-point drift-point--right">
          <span class="drift-pct drift-pct--now">${d.toPct}%</span>
          <span class="drift-label">now</span>
        </div>
      </div>
      <p class="metric-detail">${esc(d.detail)}</p>
    </div>
  `;
}

function renderEmotionalIntensityCard(d) {
  const barPct = d.score / 10;
  return `
    <div class="metric-card">
      <div class="metric-eyebrow">Emotional Intensity</div>
      <div class="metric-value-row">
        <span class="metric-value" style="color: ${esc(d.color)}">${d.score}</span>
        <span class="metric-unit">/ 10</span>
      </div>
      <div class="metric-bar-track">
        <div class="metric-bar-fill" data-pct="${barPct}" style="background: ${esc(d.color)}"></div>
      </div>
      <p class="metric-detail">${esc(d.detail)}</p>
      <span class="metric-comparison">${esc(d.comparison)}</span>
    </div>
  `;
}

function renderIntentionalCard(d) {
  return `
    <div class="metric-card">
      <div class="metric-eyebrow">Intentional vs Passive</div>
      <div class="metric-value-row">
        <span class="metric-value" style="color: ${esc(d.color)}">${fmtPct(d.passivePct)}</span>
        <span class="metric-unit">algorithmic</span>
      </div>
      <div class="split-bar">
        <div class="split-intentional" style="width: ${fmtPct(d.intentionalPct)}">
          <span class="split-label">${fmtPct(d.intentionalPct)}</span>
        </div>
        <div class="split-passive" style="width: ${fmtPct(d.passivePct)}">
          <span class="split-label">${fmtPct(d.passivePct)}</span>
        </div>
      </div>
      <div class="split-legend">
        <span class="split-legend-item split-legend-item--intentional">Searched</span>
        <span class="split-legend-item split-legend-item--passive">Algorithmic</span>
      </div>
      <p class="metric-detail">${esc(d.detail)}</p>
    </div>
  `;
}

// ── Component: feed diagnosis ─────────────────────────────────────────────────

function renderDiagnosisSection(user) {
  const severityLabel = { high: 'HIGH RISK', medium: 'WATCH', low: 'HEALTHY' };
  const severityClass = { high: 'severity--high', medium: 'severity--medium', low: 'severity--low' };
  const trendLabel    = { increasing: '↑ Rising', stable: '→ Stable', improving: '↓ Improving' };
  const trendClass    = { increasing: 'drift-trend--up', stable: 'drift-trend--stable', improving: 'drift-trend--down' };

  const { feedDiagnosis: fd, driftAlert: da } = user;

  const driftHtml = da.active ? `
    <div class="drift-alert">
      <span class="drift-dot"></span>
      <span class="drift-text">${esc(da.message)}</span>
      <span class="drift-trend ${esc(trendClass[da.trend])}">${esc(trendLabel[da.trend])}</span>
    </div>
  ` : '';

  return `
    <div class="insight-block insight-block--${esc(fd.severity)}">
      <div class="insight-block-header">
        <span class="insight-block-label">Feed Diagnosis</span>
        <span class="severity-chip ${esc(severityClass[fd.severity])}">${esc(severityLabel[fd.severity])}</span>
      </div>
      <div class="insight-block-title">${esc(fd.headline)}</div>
      <p class="insight-block-detail">${esc(fd.detail)}</p>
    </div>
    ${driftHtml}
  `;
}

// ── Component: content breakdown bars ────────────────────────────────────────

function renderBreakdownBars(breakdown) {
  return breakdown.map(({ shortLabel, pct, color }) => `
    <div class="bar-row">
      <span class="bar-name">${esc(shortLabel)}</span>
      <div class="bar-track">
        <div class="bar-fill" data-pct="${pct}" style="background: ${esc(color)}"></div>
      </div>
      <span class="bar-pct">${fmtPct(pct)}</span>
    </div>
  `).join('');
}

// ── Component: recommendations ────────────────────────────────────────────────

function renderRecommendations(recs) {
  const items = recs.map(r => `
    <div class="rec-item">
      <span class="rec-arrow">→</span>
      <span class="rec-text">${esc(r)}</span>
    </div>
  `).join('');

  return `
    <div class="recs-card">
      <div class="recs-label">Recommendations</div>
      <div class="recs-list">${items}</div>
    </div>
  `;
}

// ── Component: recent items ───────────────────────────────────────────────────

function renderRecentItems(items) {
  return items.map(({ title, platformLabel, categoryEmoji, categoryColor }) => `
    <div class="recent-item">
      <span class="recent-platform">${esc(platformLabel)}</span>
      <span class="recent-title" title="${esc(title)}">${esc(title)}</span>
      <span class="recent-cat" style="--cat-color: ${esc(categoryColor)}">${esc(categoryEmoji)}</span>
    </div>
  `).join('');
}

// ── Bar animation ─────────────────────────────────────────────────────────────

function animateBars(root = document) {
  root.querySelectorAll('[data-pct]').forEach((bar, i) => {
    const pct = parseFloat(bar.dataset.pct) * 100;
    setTimeout(() => { bar.style.width = `${pct}%`; }, i * 60);
  });
}

// ── Mount ─────────────────────────────────────────────────────────────────────

async function init() {
  const { user } = await getData();

  const heroEl = document.getElementById('user-hero');
  if (heroEl) heroEl.innerHTML = renderUserHero(user);

  const kpiEl = document.getElementById('kpi-strip');
  if (kpiEl) kpiEl.innerHTML = renderKPIs(user);

  const bannerEl = document.getElementById('story-banner');
  if (bannerEl) bannerEl.innerHTML = renderStoryBanner(user);

  const tsEl = document.getElementById('last-updated');
  if (tsEl) tsEl.textContent = `Updated ${fmtDate(user.lastUpdated)}`;

  const analyticsEl = document.getElementById('analytics-grid');
  if (analyticsEl) analyticsEl.innerHTML = renderAnalytics(user.analytics);

  const diagEl = document.getElementById('diagnosis-section');
  if (diagEl) diagEl.innerHTML = renderDiagnosisSection(user);

  const breakdownEl = document.getElementById('breakdown-bars');
  if (breakdownEl) breakdownEl.innerHTML = renderBreakdownBars(user.categoryBreakdown);

  const recentStatEl = document.getElementById('recent-stat');
  if (recentStatEl) recentStatEl.textContent = `${user.session.postsToday} posts · ${user.session.duration}`;

  const recentEl = document.getElementById('recent-feed');
  if (recentEl) recentEl.innerHTML = renderRecentItems(user.recentItems);

  const recsEl = document.getElementById('recs-section');
  if (recsEl) recsEl.innerHTML = renderRecommendations(user.recommendations);

  requestAnimationFrame(() => setTimeout(() => animateBars(), 80));
}

init().catch(err => {
  console.error('[ScrollSense Dashboard] Failed to load data:', err);
});
