import React, { useMemo } from 'react';
import { CATEGORY_COLORS } from '../utils.js';

const KNOWN_CATEGORIES = [
  'Educational',
  'Entertainment',
  'Credible News',
  'Opinion / Commentary',
  'High-Emotion / Rage-Bait',
  'Other',
];

const glass = {
  background: 'rgba(8, 11, 20, 0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
};

function ScoreBar({ value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0 }}>
        <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '10px', color: '#94a3b8', minWidth: '28px' }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function CategoryStatsTable({ allTimeLog }) {
  const rows = useMemo(() => {
    const total = allTimeLog.length || 1;
    return KNOWN_CATEGORIES.map((cat) => {
      const items = allTimeLog.filter((i) => (i.category ?? 'Other') === cat);
      const count = items.length;
      const pct = count / total;

      const avgEdu  = count ? items.reduce((s, i) => s + (i.scores?.educational      ?? 0), 0) / count : 0;
      const avgEmo  = count ? items.reduce((s, i) => s + (i.scores?.high_emotion     ?? 0), 0) / count : 0;
      const avgRisk = count ? items.reduce((s, i) => s + (i.scores?.credibility_risk ?? 0), 0) / count : 0;

      // Most frequent non-falsy creator
      const creatorCounts = {};
      items.forEach((i) => {
        if (i.creator) creatorCounts[i.creator] = (creatorCounts[i.creator] ?? 0) + 1;
      });
      const topCreator = Object.keys(creatorCounts).length
        ? Object.entries(creatorCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;

      return { cat, count, pct, avgEdu, avgEmo, avgRisk, topCreator };
    }).sort((a, b) => b.count - a.count);
  }, [allTimeLog]);

  if (!allTimeLog.length) return null;

  const thStyle = {
    fontSize: '10px',
    fontWeight: 600,
    color: '#64748b',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0 8px 10px 8px',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  return (
    <div style={{ ...glass, padding: '20px', marginBottom: '24px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
        Category Breakdown
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Category</th>
            <th style={thStyle}>Count</th>
            <th style={thStyle}>Educational</th>
            <th style={thStyle}>Emotional</th>
            <th style={thStyle}>Cred. Risk</th>
            <th style={thStyle}>Top Creator</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cat, count, pct, avgEdu, avgEmo, avgRisk, topCreator }) => (
            <tr key={cat} style={{ opacity: count === 0 ? 0.4 : 1 }}>
              <td style={{ padding: '8px', fontSize: '12px', color: '#e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: CATEGORY_COLORS[cat] ?? '#9ca3af',
                    flexShrink: 0,
                    display: 'inline-block',
                  }} />
                  {cat}
                </div>
              </td>
              <td style={{ padding: '8px', fontSize: '12px', color: '#94a3b8' }}>
                {count} <span style={{ color: '#475569' }}>({Math.round(pct * 100)}%)</span>
              </td>
              <td style={{ padding: '8px' }}><ScoreBar value={avgEdu}  color="#4ade80" /></td>
              <td style={{ padding: '8px' }}><ScoreBar value={avgEmo}  color="#f87171" /></td>
              <td style={{ padding: '8px' }}><ScoreBar value={avgRisk} color="#fb923c" /></td>
              <td style={{ padding: '8px', fontSize: '11px', color: '#94a3b8', maxWidth: '120px' }}>
                {topCreator ? topCreator.slice(0, 18) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
