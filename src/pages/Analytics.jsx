import React, { useState } from 'react';
import { ChartNoAxesCombined, Calendar, Download } from 'lucide-react';
import { Page, Card, StatCard, Button } from '../ui/index';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { localDate } from '../domain/metrics/dates';

export default function Analytics() {
  const [anchorDate, setAnchorDate] = useState(localDate());
  const [period, setPeriod] = useState('7');
  
  // Mock data to perfectly match the visual state of the screenshot for now,
  // before we wire up the complex metric engines.
  const chartData = [
    { date: '09-28', planned: 0, recorded: 0, done: 0, other: 0, unanswered: 0 },
    { date: '09-29', planned: 0, recorded: 0, done: 0, other: 0, unanswered: 0 },
    { date: '09-30', planned: 0, recorded: 0, done: 0, other: 0, unanswered: 0 },
    { date: '10-01', planned: 0, recorded: 0, done: 0, other: 0, unanswered: 0 },
    { date: '10-02', planned: 150, recorded: 90, done: 1, other: 1, unanswered: 0 },
    { date: '10-03', planned: 0, recorded: 0, done: 0, other: 0, unanswered: 0 },
    { date: '10-04', planned: 0, recorded: 0, done: 0, other: 0, unanswered: 0 },
  ];

  const sparklineData = chartData.map(d => ({ date: d.date, value: 0 }));

  return (
    <Page title="Insights" icon={ChartNoAxesCombined} color="#B2D0BF">
      <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
        Every figure comes from the same versioned calculations as your Areas.
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.3rem' }}>Anchor date</div>
            <div className="ui-row" style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--line-strong)', borderRadius: '0', background: 'transparent' }}>
              <input type="date" value={anchorDate} onChange={e => setAnchorDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-1)', border: 'none', outline: 'none' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.3rem' }}>Period</div>
            <select style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--line-strong)', borderRadius: '0', background: 'var(--bg)', color: 'var(--text-1)', minWidth: '180px' }} value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="7">Selected seven days</option>
              <option value="30">Selected thirty days</option>
            </select>
          </div>
          <Button variant="ghost" style={{ border: '1px solid var(--line-strong)' }}>Export this report</Button>
        </div>
        
        <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1rem' }}>
          2026-09-28 through 2026-10-04 · Asia/Kolkata
        </div>

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
          {['time', 'study', 'sleep', 'money', 'routines'].map(cat => (
            <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: '#B2D0BF' }} />
              {cat}
            </label>
          ))}
        </div>
      </Card>

      <div style={{ background: 'rgba(178, 208, 191, 0.1)', padding: '0.75rem 1rem', borderRadius: '0', color: '#B2D0BF', fontSize: '0.9rem', border: '1px solid rgba(178, 208, 191, 0.2)' }}>
        Sleep: 0 nights recorded; 7 gaps. Time coverage 1%. Incomplete observations cannot prove inactivity.
      </div>

      <div className="ui-grid cols-2" style={{ alignItems: 'stretch' }}>
        <Card title="Intention & recorded time">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Minutes per day · latest 31 days in this range. Recorded time includes all activities, not just planned tasks. Gaps mean no evidence.
          </p>
          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ left: -25, bottom: -10 }}>
                <XAxis dataKey="date" tick={{fontSize: 11, fill: 'var(--text-3)'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: 'var(--text-3)'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#151A17', borderColor: '#2E3833' }} />
                <Bar dataKey="planned" fill="#88D1A3" name="Planned min" />
                <Bar dataKey="recorded" fill="#75A4E8" name="Recorded min" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-2)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, background: '#88D1A3' }} /> Planned min</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, background: '#75A4E8' }} /> Recorded min</span>
          </div>
        </Card>

        <Card title="How your commitments went">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Original task outcomes · unanswered tasks stay unknown, not failed. Select a day in Calendar to complete its check-ins.
          </p>
          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ left: -25, bottom: -10 }}>
                <XAxis dataKey="date" tick={{fontSize: 11, fill: 'var(--text-3)'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 11, fill: 'var(--text-3)'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#151A17', borderColor: '#2E3833' }} />
                <Bar dataKey="done" stackId="a" fill="#3D9970" name="Done" />
                <Bar dataKey="other" stackId="a" fill="#D4A373" name="Other outcomes" />
                <Bar dataKey="unanswered" stackId="a" fill="#6C757D" name="Unanswered" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-2)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, background: '#3D9970' }} /> Done</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, background: '#D4A373' }} /> Other outcomes</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 10, height: 10, background: '#6C757D' }} /> Unanswered</span>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)' }}>LifeOS report</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
          2026-09-28 – 2026-10-04 · Asia/Kolkata<br/>
          Static snapshot · source revision data-3e7c4799 · metrics lifeos-metrics/2.0.0<br/>
          Generated 4/10/2026, 5:30:00 pm. Later edits do not change this snapshot.
        </p>

        <div className="ui-grid cols-4">
          {[
            { label: 'Focus', val: '0m', sub: 'incomplete · 1 observations\nCoverage: 0.9%' },
            { label: 'Confirmed drift', val: '0m', sub: 'incomplete · 1 observations\nCoverage: 0.9%' },
            { label: 'Conflicting time', val: '0m', sub: 'observed · 7 observations\nCoverage: 0.9%' },
            { label: 'Reported study', val: 'Unknown', sub: 'incomplete · 0 observations\nGoal: 0m\nCoverage: 0.9%' },
            { label: 'Study target attainment', val: 'Unknown', sub: 'not applicable · 0 observations\nCoverage: 0.9%' },
            { label: 'Mean reported sleep', val: 'Unknown', sub: 'incomplete · 0 observations\nCoverage: 0.9%' },
            { label: 'Confirmed spending', val: 'Unknown', sub: 'incomplete · 0 observations\nCoverage: 0.9%' },
            { label: 'Scheduled routine completion', val: 'Unknown', sub: 'not applicable · 0 observations\nCoverage: 0.9%' }
          ].map(stat => (
            <Card key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stat.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{stat.val}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                {stat.sub}
              </div>
              <div style={{ height: 60, marginTop: 'auto', paddingTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <YAxis domain={[0, 4]} hide />
                    <Line type="step" dataKey="value" stroke="#5C7A68" strokeWidth={2} dot={{ fill: '#5C7A68', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#B2D0BF', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                ▶ Daily values and goals
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Page>
  );
}
