export function finiteAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export function daysInMonth(dateKey) {
  const [year, month] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function dailyBudgetFor(monthlyBudget, dateKey) {
  return Math.max(0, finiteAmount(monthlyBudget)) / daysInMonth(dateKey)
}

export function budgetPercent(spent, budget) {
  return budget > 0 ? Math.min(100, Math.max(0, finiteAmount(spent) / budget * 100)) : (spent > 0 ? 100 : 0)
}
