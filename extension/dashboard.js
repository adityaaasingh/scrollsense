// dashboard.js — ScrollSense dashboard controller
// Handles takeout upload, displays results + attention bill.

import { API_BASE } from './utils/api.js';

// ─── Category colors ────────────────────────────────────────────────────────

const CAT_COLORS = {
  'Educational':              '#22c55e',
  'Entertainment':            '#3b82f6',
  'Credible News':            '#06b6d4',
  'Opinion / Commentary':     '#a855f7',
  'High-Emotion / Rage-Bait': '#ef4444',
  'Other':                    '#6b7280',
};

function catColor(cat) {
  return CAT_COLORS[cat] || '#6b7280';
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };

// ─── File upload handling ────────────────────────────────────────────────────

const dropZone = $('drop-zone');
const fileInput = $('file-input');
const statusEl  = $('upload-status');

function setStatus(msg, type = '') {
  statusEl.className = 'upload-status ' + type;
  statusEl.innerHTML = msg;
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) processFile(file);
});

// ─── Upload pipeline ─────────────────────────────────────────────────────────

async function processFile(file) {
  if (!file.name.endsWith('.json')) {
    setStatus('Please upload a .json file.', 'error');
    return;
  }

  setStatus('<span class="spinner"></span> Uploading and classifying... this may take a minute.', '');

  try {
    // Upload takeout
    const formData = new FormData();
    formData.append('file', file);

    const takeoutRes = await fetch(`${API_BASE}/takeout/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!takeoutRes.ok) {
      const err = await takeoutRes.text();
      throw new Error(err || `Upload failed (${takeoutRes.status})`);
    }

    const takeoutData = await takeoutRes.json();

    // Calculate bill
    const billRes = await fetch(`${API_BASE}/bill/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classified_videos: takeoutData.videos,
        platform: 'youtube',
        avg_watch_minutes: 8.0,
      }),
    });

    let billData = null;
    if (billRes.ok) {
      billData = await billRes.json();
    }

    setStatus('Done! Scroll down to see your results.', 'success');
    renderResults(takeoutData, billData);

  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
  }
}

// ─── Render results ──────────────────────────────────────────────────────────

function renderResults(takeout, bill) {
  const container = $('results-container');
  container.classList.remove('hidden');

  // Stats
  const totalVideos = takeout.stats.classified || takeout.stats.parsed_videos || 0;
  const estHours = bill ? bill.total_hours : Math.round(totalVideos * 8 / 60 * 10) / 10;
  setText('stat-total', totalVideos.toLocaleString());
  setText('stat-hours', estHours);
  setText('stat-days', bill ? bill.days_analyzed : (takeout.stats.date_range_start ? '—' : '0'));
  setText('stat-skipped', takeout.stats.skipped || 0);

  renderCategoryChart(takeout.category_counts);
  renderHourChart(takeout.hour_distribution);
  renderChannelsTable(takeout.top_channels);

  if (bill) renderBill(bill);
}

// ─── Category doughnut chart ─────────────────────────────────────────────────

function renderCategoryChart(counts) {
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const colors = labels.map(catColor);

  new Chart($('chart-categories'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#1a1a1a',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e8e8e8', font: { size: 11 }, padding: 12 },
        },
        title: {
          display: true,
          text: 'Content Categories',
          color: '#e8e8e8',
          font: { size: 14, weight: '700' },
        },
      },
    },
  });
}

// ─── Hour-of-day bar chart ───────────────────────────────────────────────────

function renderHourChart(distribution) {
  // Fill all 24 hours
  const labels = [];
  const values = [];
  for (let h = 0; h < 24; h++) {
    labels.push(`${h.toString().padStart(2, '0')}:00`);
    values.push(distribution[h] || 0);
  }

  new Chart($('chart-hours'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Videos Watched',
        data: values,
        backgroundColor: values.map((v) => v > 0 ? '#ff4444' : '#2a2a2a'),
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'When You Watch (Hour of Day)',
          color: '#e8e8e8',
          font: { size: 14, weight: '700' },
        },
      },
      scales: {
        x: {
          ticks: { color: '#888', font: { size: 9 }, maxRotation: 45 },
          grid: { color: '#2a2a2a' },
        },
        y: {
          ticks: { color: '#888' },
          grid: { color: '#2a2a2a' },
        },
      },
    },
  });
}

// ─── Top channels table ──────────────────────────────────────────────────────

function renderChannelsTable(channels) {
  const tbody = document.querySelector('#channels-table tbody');
  tbody.innerHTML = '';

  channels.forEach((ch, i) => {
    const tr = document.createElement('tr');
    const color = catColor(ch.primary_category);
    tr.innerHTML = `
      <td style="color:var(--muted)">${i + 1}</td>
      <td>${esc(ch.channel)}</td>
      <td>${ch.count}</td>
      <td><span class="cat-badge" style="color:${color};border:1px solid ${color}">${esc(ch.primary_category)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Attention bill receipt ──────────────────────────────────────────────────

function renderBill(bill) {
  setText('bill-platform', bill.platform);
  setText('bill-period', `${bill.days_analyzed} days analysed`);

  // Line items
  const tbody = document.querySelector('#bill-lines tbody');
  tbody.innerHTML = '';
  bill.line_items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(item.category)}</td>
      <td>${item.videos}</td>
      <td>${item.hours}h</td>
      <td>$${item.value.toFixed(4)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Totals
  setText('bill-total', `$${bill.total_value.toFixed(4)}`);
  setText('bill-total-hours', `${bill.total_hours}h`);

  // Projections
  const p = bill.projections;
  setText('proj-weekly-hours', `${p.weekly.hours}h`);
  setText('proj-weekly-value', `$${p.weekly.value.toFixed(2)}`);
  setText('proj-monthly-hours', `${p.monthly.hours}h`);
  setText('proj-monthly-value', `$${p.monthly.value.toFixed(2)}`);
  setText('proj-yearly-hours', `${p.yearly.hours}h`);
  setText('proj-yearly-value', `$${p.yearly.value.toFixed(2)}`);

  // Trades
  const tradesList = $('trades-list');
  tradesList.innerHTML = '<p class="trades-title">Instead, you could have...</p>';
  bill.trades.forEach((t) => {
    const div = document.createElement('div');
    div.className = 'trade-item';
    div.innerHTML = `
      <span>${esc(t.label)}</span>
      <span class="trade-count">${t.count}</span>
    `;
    tradesList.appendChild(div);
  });
}

// ─── Util ────────────────────────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
