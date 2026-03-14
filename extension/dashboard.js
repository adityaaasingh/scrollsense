/**
 * dashboard.js — ScrollSense Personal Dashboard (extension page)
 *
 * Toggle USE_REAL_DATA to switch between mock and live chrome.storage data.
 */

'use strict';

// ── Feature flag ──────────────────────────────────────────────────────────────
// Driven by URL param: dashboard.html?mode=real → live data, otherwise mock.
const USE_REAL_DATA = new URLSearchParams(location.search).get('mode') === 'real';

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DATA = {
  user: {
    name: 'Jean',
    initials: 'J',
    avatarColor: '#f87171',

    session: {
      startedAt: '10:18 AM',
      duration: '2h 14m',
      postsToday: 47,
      platforms: ['X', 'Reddit'],
    },

    pattern: {
      label: 'Rage Feed',
      color: '#f87171',
      emoji: '⚡',
      // 0–100 diversity score (derived from spread across categories/creators/platforms)
      diversityScore: 18,
      summary: 'Predominantly consuming high-emotion political content across X and Reddit. Creator concentration is high — the same outrage-adjacent accounts dominate every session.',
    },

    headline: 'Caught in the outrage loop',
    storyLine: "You've been in a high-emotion political spiral for over two hours. Your feed is becoming more reactive as the session continues.",

    feedDiagnosis: {
      headline: 'Algorithmically trapped',
      detail: "High-emotion content is surfacing at 3× baseline. Three accounts drive 68% of your attention — a creator lock-in pattern that's intensifying over time.",
      severity: 'high',
    },

    driftAlert: {
      active: true,
      message: 'Outrage-adjacent content up 34% vs. session start.',
      trend: 'increasing',
    },

    // ── Analytics metrics ──────────────────────────────────────────────────
    analytics: {
      contentDiversity: {
        score: 18,
        interpretation: 'Very Low',
        detail: 'Feed is tightly clustered around one topic and 3 creators.',
        comparison: 'Average user: 51 / 100',
        color: '#f87171',
      },

      creatorConcentration: {
        topPct: 68,
        topN: 3,
        detail: '3 accounts drove 68% of today\'s posts.',
        color: '#fbbf24',
        topCreators: [
          { name: '@BreakingPolitics', pct: 0.34 },
          { name: '@OutrageReport', pct: 0.21 },
          { name: 'r/politics', pct: 0.13 },
        ],
      },

      rabbitHole: {
        score: 7.8,
        severity: 'High',
        detail: 'Locked on political content for 2h 14m without a break.',
        color: '#f87171',
      },

      sessionDrift: {
        deltaPct: 42,
        direction: 'up',
        fromPct: 31,
        toPct: 52,
        detail: 'High-emotion content share grew steadily throughout the session.',
        color: '#fb923c',
      },

      emotionalIntensity: {
        score: 8.4,
        detail: 'Content is triggering high emotional engagement.',
        comparison: 'Avg content baseline: 5.2 / 10',
        color: '#f87171',
      },

      intentionalVsPassive: {
        intentionalPct: 0.18,
        passivePct: 0.82,
        detail: '82% of content was algorithmically surfaced — not actively chosen.',
        color: '#9ca3af',
      },
    },

    categoryBreakdown: [
      { shortLabel: 'High-Emotion', pct: 0.52, color: '#f87171' },
      { shortLabel: 'Opinion', pct: 0.29, color: '#fbbf24' },
      { shortLabel: 'Credible News', pct: 0.11, color: '#2dd4bf' },
      { shortLabel: 'Other', pct: 0.08, color: '#6b7280' },
    ],

    recommendations: [
      'Follow 2–3 credible news sources to break creator lock-in',
      'Set a 20-min session cap on political content feeds',
      'Try r/science or r/explainlikeimfive for a tonal contrast',
    ],

    recentItems: [
      { title: "They're hiding this from you — the real cost of the new bill", platformLabel: '𝕏', categoryEmoji: '⚡', categoryColor: '#f87171' },
      { title: 'Politicians are FURIOUS about this proposal that would end their…', platformLabel: 'r/', categoryEmoji: '⚡', categoryColor: '#f87171' },
      { title: 'My take on why everything is broken right now', platformLabel: '𝕏', categoryEmoji: '💬', categoryColor: '#fbbf24' },
      { title: 'BREAKING: Major policy reversal sends markets into freefall', platformLabel: '𝕏', categoryEmoji: '📰', categoryColor: '#2dd4bf' },
    ],

    lastUpdated: '2026-03-14T10:32:00Z',
  },
};

// ── Data layer ────────────────────────────────────────────────────────────────

async function getData() {
  return USE_REAL_DATA ? getRealData() : Promise.resolve(MOCK_DATA);
}

// ── Real data layer ───────────────────────────────────────────────────────────

// Category → dashboard display info
const CAT_INFO = {
  'High-Emotion / Rage-Bait': { shortLabel: 'High-Emotion', color: '#f87171', emoji: '⚡' },
  'Opinion / Commentary': { shortLabel: 'Opinion', color: '#fbbf24', emoji: '💬' },
  'Credible News': { shortLabel: 'Credible News', color: '#2dd4bf', emoji: '📰' },
  'Educational': { shortLabel: 'Educational', color: '#4ade80', emoji: '🎓' },
  'Entertainment': { shortLabel: 'Entertainment', color: '#60a5fa', emoji: '🎬' },
  'Other': { shortLabel: 'Other', color: '#6b7280', emoji: '📌' },
  'Unclassified': { shortLabel: 'Other', color: '#6b7280', emoji: '📌' },
};

function catInfo(cat) {
  return CAT_INFO[cat] ?? { shortLabel: cat ?? 'Other', color: '#6b7280', emoji: '📌' };
}

// Platform → display labels
const PLAT_LABEL = { youtube: '▶', reddit: 'r/', x: '𝕏', news: '📰' };
const PLAT_NAME = { youtube: 'YouTube', reddit: 'Reddit', x: 'X', news: 'News' };

function platLabel(platform) { return PLAT_LABEL[platform] ?? (platform ?? '?'); }
function platName(platform) { return PLAT_NAME[platform] ?? (platform ?? ''); }

// Session label → color & emoji (matches sidepanel.js)
const SESSION_LABEL_COLORS = {
  'Learning Mode': '#4ade80',
  'Entertainment Loop': '#60a5fa',
  'Creator Binge': '#a78bfa',
  'Commentary Cluster': '#fbbf24',
  'Sports Spiral': '#34d399',
  'News Spiral': '#2dd4bf',
  'Balanced Feed': '#6ee7b7',
  'Rage Feed': '#f87171',
  'Mixed Session': '#9ca3af',
};

const SESSION_LABEL_EMOJI = {
  'Learning Mode': '🎓',
  'Entertainment Loop': '🔄',
  'Creator Binge': '👤',
  'Commentary Cluster': '💬',
  'Sports Spiral': '⚽',
  'News Spiral': '📰',
  'Balanced Feed': '⚖️',
  'Rage Feed': '⚡',
  'Mixed Session': '🌀',
};

function fmtDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function buildUserFromStorage(history, insights) {
  const n = history.length;

  // ── Session stats ──────────────────────────────────────────────────────────
  // history is newest-first; oldest item is at the end
  const oldest = history[n - 1];
  const newest = history[0];

  const startedAt = oldest?.captured_at ? fmtTime(oldest.captured_at) : '—';

  let duration = '—';
  if (oldest?.captured_at && newest?.captured_at && n > 1) {
    const ms = new Date(newest.captured_at) - new Date(oldest.captured_at);
    if (ms > 0) duration = fmtDuration(ms);
  }

  const uniquePlatforms = [...new Set(history.map(i => i.platform).filter(Boolean))];
  const platforms = uniquePlatforms.map(p => platName(p)).filter(Boolean);

  // ── Category breakdown ────────────────────────────────────────────────────
  const catCounts = {};
  history.forEach(i => {
    const cat = i._category;
    if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const totalCat = Object.values(catCounts).reduce((s, v) => s + v, 0) || 1;
  const categoryBreakdown = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({
      shortLabel: catInfo(cat).shortLabel,
      pct: count / totalCat,
      color: catInfo(cat).color,
    }));

  // ── Recent items (up to 8, newest first) ──────────────────────────────────
  const recentItems = history.slice(0, 8).map(item => ({
    title: item.title || '(untitled)',
    platformLabel: platLabel(item.platform),
    categoryEmoji: catInfo(item._category).emoji,
    categoryColor: catInfo(item._category).color,
  }));

  // ── Creator concentration ─────────────────────────────────────────────────
  const creatorCounts = {};
  history.forEach(i => {
    const c = i.creator;
    if (c) creatorCounts[c] = (creatorCounts[c] || 0) + 1;
  });
  const topCreatorsRaw = Object.entries(creatorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topPct = topCreatorsRaw.reduce((s, [, c]) => s + c, 0) / n;
  const topCreators = topCreatorsRaw.map(([name, count]) => ({ name, pct: count / n }));

  // ── Approximated analytics ────────────────────────────────────────────────

  // Content diversity: prefer insights score, otherwise approximate
  const diversityRaw = insights?.metrics?.diversity_score;
  const uniqueCats = [...new Set(history.map(i => i._category).filter(Boolean))];
  const uniqueCreators = [...new Set(history.map(i => i.creator).filter(Boolean))];
  const diversityScore = diversityRaw != null
    ? Math.round(diversityRaw * 100)
    : Math.min(100, uniqueCats.length * 20 + Math.min(60, uniqueCreators.length * 5));

  const diversityInterp = diversityScore >= 70 ? 'High'
    : diversityScore >= 40 ? 'Moderate'
      : diversityScore >= 20 ? 'Low'
        : 'Very Low';

  const diversityColor = diversityScore >= 70 ? '#4ade80'
    : diversityScore >= 40 ? '#fbbf24'
      : '#f87171';

  // Rabbit hole: top category fraction × 10
  const topCatFrac = categoryBreakdown[0]?.pct ?? 0;
  const rabbitScore = parseFloat((topCatFrac * 10).toFixed(1));
  const rabbitSeverity = rabbitScore >= 7 ? 'High' : rabbitScore >= 4 ? 'Medium' : 'Low';
  const rabbitColor = rabbitScore >= 7 ? '#f87171' : rabbitScore >= 4 ? '#fbbf24' : '#4ade80';

  // Emotional intensity: high-emotion items / total × 10
  const highEmotionCount = history.filter(i => i._category === 'High-Emotion / Rage-Bait').length;
  const emotionalScore = parseFloat(((highEmotionCount / n) * 10).toFixed(1));
  const emotionalColor = emotionalScore >= 6 ? '#f87171' : emotionalScore >= 3 ? '#fbbf24' : '#4ade80';

  // Session drift: compare emotion % in older half vs recent half
  // history is newest-first, so slice(0, half) = most recent
  const half = Math.max(1, Math.floor(n / 2));
  const recentHalf = history.slice(0, half);
  const olderHalf = history.slice(half);
  const recentEmoPct = Math.round(
    (recentHalf.filter(i => i._category === 'High-Emotion / Rage-Bait').length / recentHalf.length) * 100
  );
  const olderEmoPct = olderHalf.length
    ? Math.round((olderHalf.filter(i => i._category === 'High-Emotion / Rage-Bait').length / olderHalf.length) * 100)
    : 0;
  const deltaPct = recentEmoPct - olderEmoPct;
  const driftDirection = deltaPct > 5 ? 'up' : deltaPct < -5 ? 'down' : 'stable';
  const driftColor = driftDirection === 'up' ? '#fb923c' : driftDirection === 'down' ? '#4ade80' : '#9ca3af';

  // ── Pattern (from insights or fallback) ───────────────────────────────────
  const patternLabel = insights?.label ?? 'Mixed Session';
  const patternColor = SESSION_LABEL_COLORS[patternLabel] ?? '#9ca3af';
  const patternEmoji = SESSION_LABEL_EMOJI[patternLabel] ?? '🌀';
  const patternSummary = insights?.summary ?? 'Analyzing your session pattern…';

  // ── Feed diagnosis from pattern label ─────────────────────────────────────
  const diagMap = {
    'Rage Feed': { severity: 'high', headline: 'Algorithmically trapped', detail: 'High-emotion content is dominating your feed.' },
    'Entertainment Loop': { severity: 'medium', headline: 'Passive consumption loop', detail: 'Mostly algorithmic entertainment with low variety.' },
    'Creator Binge': { severity: 'medium', headline: 'Creator lock-in detected', detail: 'Heavy concentration on a few creators.' },
    'Commentary Cluster': { severity: 'medium', headline: 'Opinion echo chamber', detail: 'High concentration of opinion content.' },
    'News Spiral': { severity: 'medium', headline: 'News spiral detected', detail: 'Heavy news consumption — consider taking a break.' },
    'Learning Mode': { severity: 'low', headline: 'Healthy learning session', detail: 'Educational content is driving your feed.' },
    'Balanced Feed': { severity: 'low', headline: 'Well-balanced session', detail: 'Good variety across categories and creators.' },
    'Sports Spiral': { severity: 'low', headline: 'Sports focus session', detail: 'Session dominated by sports content.' },
    'Mixed Session': { severity: 'low', headline: 'Mixed content session', detail: 'Varied content without a dominant pattern.' },
  };
  const diag = diagMap[patternLabel] ?? { severity: 'low', headline: 'Session in progress', detail: 'Keep browsing to generate insights.' };

  // ── Headline & story ──────────────────────────────────────────────────────
  const headline = insights?.insights?.[0] ?? `${patternEmoji} ${patternLabel}`;
  const storyLine = insights?.summary
    ?? `You've consumed ${n} posts across ${platforms.join(', ') || 'unknown platforms'}.`;

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = insights?.recommendations ?? [
    'Browse a wider variety of topics to improve diversity',
    'Take a short break if you notice emotional fatigue',
    'Actively search for content instead of relying on the algorithm',
  ];

  return {
    name: 'You',
    initials: 'U',
    avatarColor: patternColor,

    session: {
      startedAt,
      duration,
      postsToday: n,
      platforms: platforms.length ? platforms : ['Unknown'],
    },

    pattern: {
      label: patternLabel,
      color: patternColor,
      emoji: patternEmoji,
      diversityScore,
      summary: patternSummary,
    },

    headline,
    storyLine,

    feedDiagnosis: {
      headline: diag.headline,
      detail: diag.detail,
      severity: diag.severity,
    },

    driftAlert: {
      active: driftDirection === 'up' && deltaPct > 10,
      message: `High-emotion content ${driftDirection === 'up' ? 'up' : 'down'} ${Math.abs(deltaPct)}% vs. session start.`,
      trend: driftDirection === 'up' ? 'increasing' : driftDirection === 'down' ? 'improving' : 'stable',
    },

    analytics: {
      contentDiversity: {
        score: diversityScore,
        interpretation: diversityInterp,
        detail: `Feed spans ${uniqueCats.length} categories and ${uniqueCreators.length} creators.`,
        comparison: 'Average user: 51 / 100',
        color: diversityColor,
      },

      creatorConcentration: {
        topPct: Math.round(topPct * 100),
        topN: topCreators.length,
        detail: topCreators.length
          ? `${topCreators.length} accounts drove ${Math.round(topPct * 100)}% of today's posts.`
          : 'Not enough creator data yet.',
        color: '#fbbf24',
        topCreators,
      },

      rabbitHole: {
        score: rabbitScore,
        severity: rabbitSeverity,
        detail: `Concentrated on "${categoryBreakdown[0]?.shortLabel ?? 'content'}" for this session.`,
        color: rabbitColor,
      },

      sessionDrift: {
        deltaPct: Math.abs(deltaPct),
        direction: driftDirection,
        fromPct: olderEmoPct,
        toPct: recentEmoPct,
        detail: driftDirection === 'up'
          ? 'High-emotion content share grew as the session continued.'
          : driftDirection === 'down'
            ? 'High-emotion content share decreased during the session.'
            : 'Emotional tone has remained stable throughout the session.',
        color: driftColor,
      },

      emotionalIntensity: {
        score: emotionalScore,
        detail: emotionalScore >= 6
          ? 'Content is triggering high emotional engagement.'
          : emotionalScore >= 3
            ? 'Moderate emotional content in this session.'
            : 'Low emotional intensity in this session.',
        comparison: 'Avg content baseline: 5.2 / 10',
        color: emotionalColor,
      },

      intentionalVsPassive: {
        intentionalPct: 0.2,
        passivePct: 0.8,
        detail: 'Data not available — intentionality tracking requires search history access.',
        color: '#9ca3af',
      },
    },

    categoryBreakdown,
    recommendations,
    recentItems,
    lastUpdated: new Date().toISOString(),
  };
}

async function getRealData() {
  const keys = [
    'scrollsense_session_history',
    'scrollsense_session_insights',
    'scrollsense_current_analysis',
  ];
  const s = await chrome.storage.local.get(keys);
  const history = s.scrollsense_session_history ?? [];
  const insights = s.scrollsense_session_insights ?? null;

  if (history.length === 0) {
    return { user: null, noData: true };
  }

  return { user: buildUserFromStorage(history, insights) };
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
    { label: 'Posts Today', value: session.postsToday, sub: `${session.platforms.join(', ')}` },
    { label: 'Session Length', value: session.duration, sub: `started ${session.startedAt}` },
    { label: 'High-Emotion Rate', value: fmtPct(highEmotionPct), sub: 'of classified posts', accent: true },
    { label: 'Diversity Score', value: `${analytics.contentDiversity.score}/100`, sub: 'feed variety', dim: true },
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
  const trendLabel = { increasing: '↑ Rising', stable: '→ Stable', improving: '↓ Improving' };
  const trendClass = { increasing: 'drift-trend--up', stable: 'drift-trend--stable', improving: 'drift-trend--down' };

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

// ── Empty state ───────────────────────────────────────────────────────────────

function renderEmptyState() {
  const main = document.querySelector('.app-main');
  if (!main) return;
  main.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-icon">📊</p>
      <p class="empty-state-title">No session data yet</p>
      <p class="empty-state-hint">Start browsing YouTube or Reddit and WatchTrace will build your dashboard automatically.</p>
    </div>
  `;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

async function init() {
  const { user, noData } = await getData();

  if (noData || !user) {
    renderEmptyState();
    return;
  }

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
