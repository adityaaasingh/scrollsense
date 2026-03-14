import React from 'react';
import { categoryColor } from '../utils.js';

const TRAFFIC_LIGHT = {
  green: { emoji: '🟢', label: 'Calm',   accent: '#4ade80' },
  amber: { emoji: '🟡', label: 'Mixed',  accent: '#fbbf24' },
  red:   { emoji: '🔴', label: 'High',   accent: '#f87171' },
};

function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: '11px', color: '#64748b' }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value * 100}%`, background: color, borderRadius: '2px', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function BlockCard({ block }) {
  const tl = TRAFFIC_LIGHT[block.traffic_light] ?? TRAFFIC_LIGHT.amber;

  return (
    <div style={{
      background: 'rgba(15, 20, 35, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${tl.accent}28`,
      borderRadius: '14px',
      padding: '18px 16px',
      flex: 1,
      minWidth: '180px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{block.block}</p>
          <p style={{ fontSize: '10px', color: '#475569' }}>{block.hours}</p>
        </div>
        <span title={tl.label} style={{ fontSize: '16px' }}>{tl.emoji}</span>
      </div>

      {/* Dominant category badge */}
      <div style={{ marginBottom: '10px' }}>
        <span style={{
          display: 'inline-block',
          background: `${categoryColor(block.dominant_category)}22`,
          color: categoryColor(block.dominant_category),
          border: `1px solid ${categoryColor(block.dominant_category)}44`,
          borderRadius: '20px',
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: 600,
        }}>
          {block.dominant_category}
        </span>
      </div>

      {/* Statement */}
      <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '12px' }}>
        {block.statement}
      </p>

      {/* Score bar */}
      <ScoreBar label="Emotional intensity" value={block.emotional_score} color={tl.accent} />
    </div>
  );
}

export default function EmotionalSection({ timeBlocks }) {
  if (!timeBlocks?.length) return null;

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      {timeBlocks.map((block) => (
        <BlockCard key={block.block} block={block} />
      ))}
    </div>
  );
}
