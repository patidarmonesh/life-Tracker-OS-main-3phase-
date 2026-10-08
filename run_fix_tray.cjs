const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{\/\* Day at a glance .*? 24h ribbon \*\/\}/s;
const match = content.match(regex);

if (match) {
    const repl = `{timeSummary.displaced && timeSummary.displaced.length > 0 && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', margin: 0, color: '#F59E0B' }}>Displaced Activities Tray</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Overrun tasks that need rescheduling</span>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {timeSummary.displaced.filter(d => !(state.timeflow?.displacedDecisions || []).some(dec => dec.sourceSlotId === d.sourceSlotId)).map(d => (
                    <div key={d.id} style={{ padding: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{d.affectedMinutes} minutes were occupied by something else.</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button style={{ padding: '6px 10px', fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6 }} onClick={() => dispatchDecision(d.sourceSlotId, 'keep')}>Keep schedule</button>
                        <button style={{ padding: '6px 10px', fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6 }} onClick={() => moveTomorrow(d)}>Move to tomorrow</button>
                        <button style={{ padding: '6px 10px', fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6 }} onClick={() => alert('Reschedule today modal would open here')}>Reschedule today</button>
                        <button style={{ padding: '6px 10px', fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6 }} onClick={() => dispatchDecision(d.sourceSlotId, 'skip')}>Skip</button>
                      </div>
                    </div>
                  ))}
                  {timeSummary.displaced.filter(d => !(state.timeflow?.displacedDecisions || []).some(dec => dec.sourceSlotId === d.sourceSlotId)).length === 0 && <div style={{fontSize: 12, color: 'var(--text-muted)'}}>All clear!</div>}
                </div>
              </Card>
            )}
            
            ${match[0]}`;

    content = content.replace(regex, repl);
    
    // Add dispatch functions inside the component
    const functionsTarget = `const deleteEntry = (id) => {`;
    const functionsRepl = `const dispatchDecision = (sourceSlotId, status) => {
    setModule('timeflow', current => ({
      ...current,
      displacedDecisions: [...(current.displacedDecisions || []), { sourceSlotId, status, date: new Date().toISOString() }]
    }))
  }

  const moveTomorrow = (d) => {
    const slot = allPlans.find(p => p.id === d.sourceSlotId)
    if (!slot) return
    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    
    setModule('timeflow', current => ({
      ...current,
      plans: [...(current.plans || []), { ...slot, id: slot.id + '-moved', date: tomorrowStr, calendarEventKey: slot.calendarEventKey + '-moved' }],
      displacedDecisions: [...(current.displacedDecisions || []), { sourceSlotId: d.sourceSlotId, status: 'moved', date: new Date().toISOString() }]
    }))
    showToast('Moved to tomorrow!', 'success')
  }

  const deleteEntry = (id) => {`;
    
    content = content.replace(functionsTarget, functionsRepl);
    
    fs.writeFileSync(path, content);
    console.log('Displaced Tray injected via regex');
} else {
    console.log('Regex target not found for Displaced Tray');
}
