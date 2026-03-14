export const CATEGORY_COLORS = {
  'Educational':              '#4ade80',
  'Entertainment':            '#60a5fa',
  'Credible News':            '#2dd4bf',
  'Opinion / Commentary':     '#fbbf24',
  'High-Emotion / Rage-Bait': '#f87171',
  'Other':                    '#9ca3af',
  'Unclassified':             '#9ca3af',
};

export function categoryColor(cat) {
  return CATEGORY_COLORS[cat] ?? '#9ca3af';
}

export function classifySentiment(item) {
  const edu  = item?.scores?.educational      ?? 0;
  const emo  = item?.scores?.high_emotion     ?? 0.2;
  const risk = item?.scores?.credibility_risk ?? 0;
  if (emo > 0.6 || risk > 0.6) return 'negative';
  if (edu > 0.5 || (emo < 0.25 && risk < 0.25)) return 'positive';
  return 'neutral';
}

// Returns an emotion score from an all-time log item (0–1).
export function emotionScore(item) {
  if (item?.scores?.high_emotion != null) return item.scores.high_emotion;
  if (item?.category === 'High-Emotion / Rage-Bait') return 0.9;
  if (item?.category === 'Educational') return 0.05;
  return 0.3;
}
