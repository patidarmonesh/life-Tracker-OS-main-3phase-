import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { latestApproved, commitmentSummary } from '../domain/planning/index'
import ChartFrame from './areas/ChartFrame'

const tooltipStyle = { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 12 }
const axis = { tick: { fontSize: 11, fill: 'var(--text-secondary)' }, axisLine: false, tickLine: false }
function Empty() { return <div className="empty-state"><p>Add a few records to see your pattern here.</p><Link to="/me#drive-import">Import your old Drive data</Link></div> }
export function PlanningCharts({ state, summary }) {
  const rows = useMemo(() => summary.days.slice(-31).map(day => {
    const plan = latestApproved(state.planning, day.date), commitments = commitmentSummary(state.planning, day.date)
    return { date: day.date, planned: plan ? plan.blocks.reduce((n, b) => n + (Date.parse(b.endAt) - Date.parse(b.startAt)) / 60000, 0) : null, recorded: day.time.loggedMinutes.value > 0 ? day.time.loggedMinutes.value : null, done: commitments.total ? commitments.completed : null, other: commitments.total ? commitments.answered - commitments.completed : null, unanswered: commitments.total ? commitments.total - commitments.answered : null }
  }), [state.planning, summary.days])
  return <div className="analysis-visuals">
    <ChartFrame title="Intention & recorded time" description="Minutes per day · latest 31 days in this range. Recorded time includes all activities, not just planned tasks. Gaps mean no evidence." rows={rows} columns={[{ key: 'date', label: 'Date' }, { key: 'planned', label: 'Planned min' }, { key: 'recorded', label: 'Recorded min' }]}>
      {rows.some(r => r.planned != null || r.recorded != null) ? <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 240 }}><BarChart data={rows}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis {...axis} dataKey="date" tickFormatter={d => d.slice(5)}/><YAxis {...axis} width={40}/><Tooltip contentStyle={tooltipStyle}/><Legend/><Bar dataKey="planned" name="Planned min" fill="#8cd5b6" radius={[4, 4, 0, 0]} isAnimationActive={false}/><Bar dataKey="recorded" name="Recorded min" fill="#91b7ed" radius={[4, 4, 0, 0]} isAnimationActive={false}/></BarChart></ResponsiveContainer> : <Empty/>}
    </ChartFrame>
    <ChartFrame title="How your commitments went" description="Original task outcomes · unanswered tasks stay unknown, not failed. Select a day in Calendar to complete its check-ins." rows={rows} columns={[{ key: 'date', label: 'Date' }, { key: 'done', label: 'Done' }, { key: 'other', label: 'Other outcomes' }, { key: 'unanswered', label: 'Unanswered' }]}>
      {rows.some(r => r.done != null) ? <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 240 }}><BarChart data={rows}><XAxis {...axis} dataKey="date" tickFormatter={d => d.slice(5)}/><YAxis {...axis} allowDecimals={false} width={30}/><Tooltip contentStyle={tooltipStyle}/><Legend/><Bar dataKey="done" name="Done" stackId="outcome" fill="#8cd5b6" isAnimationActive={false}/><Bar dataKey="other" name="Other outcomes" stackId="outcome" fill="#d8b77f" isAnimationActive={false}/><Bar dataKey="unanswered" name="Unanswered" stackId="outcome" fill="#697782" radius={[4, 4, 0, 0]} isAnimationActive={false}/></BarChart></ResponsiveContainer> : <Empty/>}
    </ChartFrame>
  </div>
}
export function FinanceCharts({ summary }) {
  const currency = summary.finance.currency, factor = ['JPY', 'KRW'].includes(currency) ? 1 : 100
  const rows = summary.days.map(day => ({ date: day.date, amount: day.finance.spend.value == null ? null : day.finance.spend.value / factor }))
  const totals = summary.finance.byCurrency[currency]
  const cash = totals ? [['Expenses', totals.expenseMinor], ['Fees', totals.feeMinor], ['Refunds', totals.refundMinor], ['Income', totals.incomeMinor], ['Transfers', totals.transferMinor], ['Investments', totals.investmentMinor]].map(([name, amount]) => ({ name, amount: amount / factor })) : []
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
  return <div className="analysis-visuals">
    <ChartFrame title="Spending through the month" description={`Confirmed net spending in ${currency}. Unrecorded days remain gaps; confirmed no-spend days appear as zero.`} rows={rows} columns={[{ key: 'date', label: 'Date' }, { key: 'amount', label: currency }]}>
      {rows.some(r => r.amount != null) ? <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 240 }}><LineChart data={rows}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis {...axis} dataKey="date" tickFormatter={d => d.slice(8)}/><YAxis {...axis} width={45}/><Tooltip contentStyle={tooltipStyle} formatter={money}/><Line dataKey="amount" name="Net spending" stroke="#8cd5b6" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer> : <Empty/>}
    </ChartFrame>
    <ChartFrame title="Where the money moved" description={`${currency} only · transfers and investments are shown separately from spending. Other currencies remain in the ledger.`} rows={cash} columns={[{ key: 'name', label: 'Type' }, { key: 'amount', label: currency }]}>
      {cash.length ? <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 240 }}><BarChart data={cash} layout="vertical" margin={{ left: 20 }}><XAxis {...axis} type="number"/><YAxis {...axis} dataKey="name" type="category" width={72}/><Tooltip contentStyle={tooltipStyle} formatter={money}/><Bar dataKey="amount" name={currency} fill="#91b7ed" radius={[0, 5, 5, 0]} isAnimationActive={false}/></BarChart></ResponsiveContainer> : <Empty/>}
    </ChartFrame>
  </div>
}
