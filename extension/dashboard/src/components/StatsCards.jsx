import React, { useMemo } from 'react';

const glass = {
  background: 'rgba(15, 20, 35, 0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  padding: '18px 20px',
  flex: 1,
};

function Card({ label, value, sub, accent }) {
  return (
    <div style={glass}>
      <p style={{ fontSize: '24px', fontWeight: 700, color: accent ?? '#e2e8f0', marginBottom: '4px' }}>{value}</p>
      <p style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{label}</p>
      {sub && <p style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>{sub}</p>}
    </div>
  );
}

export default function StatsCards({ allTimeLog, dashboardData }) {
  const stats = useMemo(() => {
    const n = allTimeLog.length;
    if (n === 0) return null;

    const cats = allTimeLog.map((i) => i.category ?? 'Other');
    const counts = {};
    cats.forEach((c) => { counts[c] = (counts[c] ?? 0) + 1; });
    const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    const platforms = new Set(allTimeLog.map((i) => i.platform).filter(Boolean));

    const eduRatio = ((counts['Educational'] ?? 0) / n * 100).toFixed(0);

    const emoScores = allTimeLog.map((i) => i.scores?.high_emotion ?? 0.2);
    const avgEmo = (emoScores.reduce((a, b) => a + b, 0) / emoScores.length * 100).toFixed(0);

    return { n, topCat, platforms: platforms.size, eduRatio, avgEmo };
  }, [allTimeLog]);

  if (!stats) return null;

  const SESSION_LABEL_ACCENT = {
    'Learning Mode':       '#4ade80',
    'Entertainment Loop':  '#60a5fa',
    'Creator Binge':       '#a78bfa',
    'Rage Feed':           '#f87171',
    'Balanced Feed':       '#6ee7b7',
    'News Spiral':         '#2dd4bf',
    'Mixed Session':       '#9ca3af',
  };

  return (
    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
      <Card
        label="Total Items"
        value={stats.n.toLocaleString()}
        sub="all time"
        accent="#e2e8f0"
      />
      <Card
        label="Top Category"
        value={stats.topCat[0]}
        sub={`${((stats.topCat[1] / stats.n) * 100).toFixed(0)}% of history`}
        accent={SESSION_LABEL_ACCENT[stats.topCat[0]] ?? '#94a3b8'}
      />
      <Card
        label="Educational"
        value={`${stats.eduRatio}%`}
        sub="of all content"
        accent="#4ade80"
      />
      <Card
        label="Platforms"
        value={stats.platforms}
        sub="active platforms"
        accent="#60a5fa"
      />
      <Card
        label="Avg Emotion"
        value={`${stats.avgEmo}%`}
        sub="intensity score"
        accent={stats.avgEmo >= 60 ? '#f87171' : stats.avgEmo >= 30 ? '#fbbf24' : '#4ade80'}
      />
    </div>
  );
}
