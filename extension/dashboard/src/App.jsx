import React from 'react';
import { useExtensionData } from './hooks/useExtensionData.js';
import StatsCards from './components/StatsCards.jsx';
import Timeline from './components/Timeline.jsx';
import HourlyHeatmap from './components/HourlyHeatmap.jsx';
import WeeklyBars from './components/WeeklyBars.jsx';
import EmotionalSection from './components/EmotionalSection.jsx';
import CategoryStatsTable from './components/CategoryStatsTable.jsx';
import SentimentAnalysis from './components/SentimentAnalysis.jsx';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
};

export default function App() {
  const { allTimeLog, dashboardData, loading, error, lastSynced } = useExtensionData();

  const syncLabel = lastSynced
    ? `last synced: ${lastSynced.toLocaleTimeString()}`
    : 'syncing…';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b14',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <header style={{ ...glass, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>ScrollSense</span>
            {allTimeLog.length > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', color: '#94a3b8' }}>
                {allTimeLog.length} items
              </span>
            )}
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>{syncLabel}</span>
        </header>

        {/* Status messages */}
        {(loading || (error && !loading)) && (
          <div style={{ marginBottom: '20px' }}>
            {loading && <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Analyzing your browsing history…</p>}
            {error && !loading && (
              <p style={{ color: allTimeLog.length === 0 ? '#94a3b8' : '#f87171', fontSize: '13px', margin: 0 }}>
                {allTimeLog.length === 0
                  ? 'No data yet — browse YouTube, Reddit, or X with ScrollSense active.'
                  : `Backend unavailable — showing local data only. (${error})`}
              </p>
            )}
          </div>
        )}

        {/* Overall statement */}
        {dashboardData?.overall_statement && (
          <div style={{ ...glass, padding: '16px 24px', marginBottom: '24px', borderLeft: '3px solid rgba(148,163,184,0.3)' }}>
            <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>
              {dashboardData.overall_statement}
            </p>
          </div>
        )}

        {/* Stats cards */}
        <StatsCards allTimeLog={allTimeLog} dashboardData={dashboardData} />

        {/* Sentiment analysis — prominent */}
        {allTimeLog.length > 0 && (
          <SentimentAnalysis allTimeLog={allTimeLog} />
        )}

        {/* Today's timeline */}
        {allTimeLog.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Today's Timeline
            </p>
            <Timeline allTimeLog={allTimeLog} />
          </div>
        )}

        {/* Charts row */}
        {allTimeLog.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ ...glass, padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Hourly Heatmap
              </p>
              <HourlyHeatmap allTimeLog={allTimeLog} />
            </div>
            <div style={{ ...glass, padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Day of Week
              </p>
              <WeeklyBars allTimeLog={allTimeLog} />
            </div>
          </div>
        )}

        {/* Category stats table */}
        {allTimeLog.length > 0 && (
          <CategoryStatsTable allTimeLog={allTimeLog} />
        )}

        {/* Time block statements */}
        {dashboardData?.time_blocks?.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Time Block Analysis
            </p>
            <EmotionalSection timeBlocks={dashboardData.time_blocks} />
          </div>
        )}

      </div>
    </div>
  );
}
