import React, { useMemo } from 'react';
import { categoryColor } from '../utils.js';

export default function Timeline({ allTimeLog }) {
  // Build a 24-slot strip (one slot per hour) using today's items only.
  const slots = useMemo(() => {
    const today = new Date().toDateString();
    const arr = Array.from({ length: 24 }, () => null);

    allTimeLog.forEach((item) => {
      if (!item.captured_at) return;
      try {
        const d = new Date(item.captured_at);
        if (d.toDateString() !== today) return;
        const h = d.getHours();
        if (!arr[h]) arr[h] = item.category ?? 'Other';
      } catch {}
    });

    return arr;
  }, [allTimeLog]);

  const hasAny = slots.some(Boolean);

  return (
    <div style={{ display: 'flex', height: '28px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {slots.map((cat, i) => (
        <div
          key={i}
          title={cat ? `${i}:00 — ${cat}` : `${i}:00 — no data`}
          style={{
            flex: 1,
            background: cat ? categoryColor(cat) : 'transparent',
            opacity: cat ? 0.75 : 0.15,
            transition: 'opacity 0.2s',
          }}
        />
      ))}
      {!hasAny && (
        <div style={{ position: 'absolute', width: '100%', textAlign: 'center', color: '#475569', fontSize: '11px', lineHeight: '28px', pointerEvents: 'none' }}>
          No activity today yet
        </div>
      )}
    </div>
  );
}
