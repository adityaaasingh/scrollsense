import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { categoryColor } from '../utils.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(8,11,20,0.9)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '12px',
      color: '#e2e8f0',
    }}>
      <p style={{ marginBottom: '4px', fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function WeeklyBars({ allTimeLog }) {
  const data = useMemo(() => {
    const counts = Array.from({ length: 7 }, (_, d) => ({ day: DAYS[d], total: 0, emo: 0 }));
    allTimeLog.forEach((item) => {
      if (!item.captured_at) return;
      try {
        const d = new Date(item.captured_at).getDay();
        counts[d].total++;
        if (item.category === 'High-Emotion / Rage-Bait' || (item.scores?.high_emotion ?? 0) > 0.6) {
          counts[d].emo++;
        }
      } catch {}
    });
    return counts;
  }, [allTimeLog]);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={18} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill="#60a5fa" fillOpacity={0.6} />
          ))}
        </Bar>
        <Bar dataKey="emo" name="High-Emotion" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill="#f87171" fillOpacity={0.75} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
