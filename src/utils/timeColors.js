export const CATEGORY_COLORS = {
  'Sleep': '#8B5CF6',
  'Morning Routine': '#F59E0B',
  'Exercise': '#10B981',
  'Study': '#3B82F6',
  'Deep Work': '#1D4ED8',
  'Meals': '#F97316',
  'Social Media': '#EF4444',
  'Entertainment': '#EC4899',
  'Travel': '#06B6D4',
  'Self-Care': '#84CC16',
  'Waste Time': '#DC2626',
  'Other': '#6B7280',
}

const FALLBACK_PALETTE = ['#22D3EE', '#A78BFA', '#F472B6', '#FBBF24', '#34D399', '#60A5FA', '#FB923C', '#C084FC']

// Stable colour for custom categories too (hash → palette).
export function categoryColor(category) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category]
  const text = String(category || 'Other')
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

export function formatMinutes(mins) {
  const m = Math.max(0, Math.round(mins || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}m`
  return r ? `${h}h ${r}m` : `${h}h`
}
