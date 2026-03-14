import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import { classifySentiment } from '../utils.js';

const COLORS = { positive: '#4ade80', neutral: '#60a5fa', negative: '#f87171' };

const glass = {
  background: 'rgba(8, 11, 20, 0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
};

const SentimentTooltip = ({ active, payload, label }) => {
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
      {label && <p style={{ marginBottom: '4px', fontWeight: 600 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{p.unit ?? ''}</p>
      ))}
    </div>
  );
};

export default function SentimentAnalysis({ allTimeLog }) {
  const { donut, daily, platforms, totals } = useMemo(() => {
    if (!allTimeLog.length) return { donut: [], daily: [], platforms: [], totals: { positive: 0, neutral: 0, negative: 0 } };

    // Totals
    const totals = { positive: 0, neutral: 0, negative: 0 };
    allTimeLog.forEach((item) => { totals[classifySentiment(item)]++; });

    const donut = [
      { name: 'Positive', value: totals.positive },
      { name: 'Neutral',  value: totals.neutral  },
      { name: 'Negative', value: totals.negative  },
    ];

    // Daily trend — last 30 days
    const now = new Date();
    const dayMap = {};
    for (let d = 29; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - d);
      const key = dt.toISOString().slice(0, 10);
      dayMap[key] = { positive: 0, neutral: 0, negative: 0, total: 0 };
    }
    allTimeLog.forEach((item) => {
      if (!item.captured_at) return;
      try {
        const key = new Date(item.captured_at).toISOString().slice(0, 10);
        if (dayMap[key]) {
          const s = classifySentiment(item);
          dayMap[key][s]++;
          dayMap[key].total++;
        }
      } catch {}
    });
    const daily = Object.entries(dayMap).map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      positive: v.total ? parseFloat(((v.positive / v.total) * 100).toFixed(1)) : null,
      negative: v.total ? parseFloat(((v.negative / v.total) * 100).toFixed(1)) : null,
    }));

    // Per-platform stacked bar
    const platformMap = {};
    allTimeLog.forEach((item) => {
      const p = item.platform ?? 'Unknown';
      if (!platformMap[p]) platformMap[p] = { positive: 0, neutral: 0, negative: 0 };
      platformMap[p][classifySentiment(item)]++;
    });
    const platforms = Object.entries(platformMap).map(([platform, v]) => {
      const total = v.positive + v.neutral + v.negative || 1;
      return {
        platform,
        positive: parseFloat(((v.positive / total) * 100).toFixed(1)),
        neutral:  parseFloat(((v.neutral  / total) * 100).toFixed(1)),
        negative: parseFloat(((v.negative / total) * 100).toFixed(1)),
      };
    });

    return { donut, daily, platforms, totals };
  }, [allTimeLog]);

  if (!allTimeLog.length) return null;

  const grandTotal = totals.positive + totals.neutral + totals.negative || 1;
  const positivePct = Math.round((totals.positive / grandTotal) * 100);

  return (
    <div style={{ ...glass, padding: '20px', marginBottom: '40px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
        Sentiment Analysis
      </p>
      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
        <span style={{ color: COLORS.positive }}>{totals.positive} positive</span>
        {' · '}
        <span style={{ color: COLORS.neutral }}>{totals.neutral} neutral</span>
        {' · '}
        <span style={{ color: COLORS.negative }}>{totals.negative} negative</span>
        {'  '}
        <span style={{ color: '#475569' }}>({positivePct}% positive overall)</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: '20px', alignItems: 'center' }}>

        {/* Donut */}
        <div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={donut}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
              >
                {donut.map((entry, i) => (
                  <Cell key={i} fill={Object.values(COLORS)[i]} />
                ))}
              </Pie>
              <Tooltip content={<SentimentTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {donut.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: Object.values(COLORS)[i], display: 'inline-block', flexShrink: 0 }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>

        {/* Daily trend line */}
        <div>
          <p style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', textAlign: 'center' }}>30-Day Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={daily} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={6} />
              <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<SentimentTooltip />} />
              <Line type="monotone" dataKey="positive" name="Positive" stroke={COLORS.positive} dot={false} connectNulls={false} unit="%" strokeWidth={1.5} />
              <Line type="monotone" dataKey="negative" name="Negative" stroke={COLORS.negative} dot={false} connectNulls={false} unit="%" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Platform stacked bar */}
        <div>
          <p style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', textAlign: 'center' }}>By Platform</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={platforms} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <XAxis dataKey="platform" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<SentimentTooltip />} />
              <Bar dataKey="negative" name="Negative" stackId="s" fill={COLORS.negative} />
              <Bar dataKey="neutral"  name="Neutral"  stackId="s" fill={COLORS.neutral}  />
              <Bar dataKey="positive" name="Positive" stackId="s" fill={COLORS.positive} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
