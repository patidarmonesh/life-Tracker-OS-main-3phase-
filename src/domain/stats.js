/** Small, dependency-free statistics helpers shared by domain modules. */
/**
 * quantile function
 * @param {any} values, q
 * @returns {any}
 */
export function quantile(values, q) {
  const s = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  if (!s.length) return null
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}
/**
 * median
 * @description Automatically documented.
 */
export const median = values => quantile(values, 0.5)
/**
 * mean
 * @description Automatically documented.
 */
export const mean = values => { const s = values.filter(v => Number.isFinite(v)); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null }
/** Pearson correlation; null when fewer than `min` paired samples or zero variance. */
/**
 * pearson function
 * @param {any} xs, ys, min = 21
 * @returns {any}
 */
export function pearson(xs, ys, min = 21) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  if (pairs.length < min) return null
  const mx = mean(pairs.map(p => p[0])), my = mean(pairs.map(p => p[1]))
  let num = 0, dx = 0, dy = 0
  for (const [x, y] of pairs) { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2 }
  return dx && dy ? { r: num / Math.sqrt(dx * dy), n: pairs.length } : null
}


