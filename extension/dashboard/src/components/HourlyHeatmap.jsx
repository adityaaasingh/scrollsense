import React, { useMemo } from 'react';
import { categoryColor } from '../utils.js';

const CATEGORIES = [
  'Educational',
  'Entertainment',
  'Credible News',
  'Opinion / Commentary',
  'High-Emotion / Rage-Bait',
  'Other',
];

const SHORT_LABELS = {
  'Educational':              'Edu',
  'Entertainment':            'Entmt',
  'Credible News':            'News',
  'Opinion / Commentary':     'Opinion',
  'High-Emotion / Rage-Bait': 'Rage',
  'Other':                    'Other',
};

export default function HourlyHeatmap({ allTimeLog }) {
  // grid[category][hour] = count
  const grid = useMemo(() => {
    const g = {};
    CATEGORIES.forEach((c) => { g[c] = Array(24).fill(0); });
    allTimeLog.forEach((item) => {
      if (!item.captured_at) return;
      try {
        const hour = new Date(item.captured_at).getHours();
        const cat = item.category ?? 'Other';
        if (g[cat]) g[cat][hour]++;
      } catch {}
    });
    return g;
  }, [allTimeLog]);

  const maxVal = useMemo(() => {
    let m = 1;
    CATEGORIES.forEach((c) => { grid[c].forEach((v) => { if (v > m) m = v; }); });
    return m;
  }, [grid]);

  const HOUR_LABELS = ['0', '6', '12', '18', '23'];
  const LABEL_HOURS = [0, 6, 12, 18, 23];

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(24, 1fr)', gap: '2px', minWidth: '320px' }}>
        {/* Hour header */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ fontSize: '9px', color: '#475569', textAlign: 'center' }}>
            {LABEL_HOURS.includes(h) ? h : ''}
          </div>
        ))}

        {/* Rows per category */}
        {CATEGORIES.map((cat) => (
          <React.Fragment key={cat}>
            <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', paddingRight: '4px' }}>
              {SHORT_LABELS[cat]}
            </div>
            {grid[cat].map((count, h) => {
              const intensity = count / maxVal;
              const base = categoryColor(cat);
              return (
                <div
                  key={h}
                  title={`${cat} at ${h}:00 — ${count} item${count !== 1 ? 's' : ''}`}
                  style={{
                    height: '14px',
                    borderRadius: '2px',
                    background: count === 0 ? 'rgba(255,255,255,0.03)' : base,
                    opacity: count === 0 ? 1 : 0.2 + intensity * 0.8,
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
