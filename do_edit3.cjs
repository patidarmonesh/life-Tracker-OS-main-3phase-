const fs = require('fs');

const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const startIndex = content.indexOf('{plans.map(slot => {\n            const actual = entries.find(e => e.planSlotId === slot.id)');
const endIndexStr = '          })}\n        </div>\n        <p style={{ fontSize: 12, color: \'var(--text-muted)\' }}>Adherence = minutes';
const endIndex = content.indexOf(endIndexStr);

if (startIndex !== -1 && endIndex !== -1) {
   const originalStr = content.substring(startIndex, endIndex);

const repl = `{plans.map(slot => {
            const slotActuals = entries.filter(e => e.planSlotId === slot.id && !e.ghost).sort((a,b) => timeMinutes(a.start) - timeMinutes(b.start));
            const hasActuals = slotActuals.length > 0;
            const isMissedCompletely = hasActuals && slotActuals.every(a => a.planOutcome === 'missed');
            const { due, inProgress } = getSlotStatus(slot);
            const color = categoryColor(slot.category);
            
            let status = ['Upcoming', '#94A3B8'];
            if (hasActuals) {
               if (isMissedCompletely) status = ['Missed', '#F87171'];
               else if (slotActuals.some(a => a.planOutcome === 'changed')) status = ['Changed', '#FB7185'];
               else if (slotActuals.some(a => a.planOutcome === 'followed')) status = ['Done', '#34D399'];
               else status = ['In Progress', '#60A5FA'];
            } else if (due) {
               status = ['Check in', '#FBBF24'];
            } else if (inProgress) {
               status = ['In Progress', '#60A5FA'];
            }

            return <div key={slot.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <div style={{ width: 42, flexShrink: 0, textAlign: 'right', paddingTop: 14, fontFamily: 'JetBrains Mono, monospace', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{slot.start}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{slot.end}</div>
              </div>
              <div style={{ flex: 1, padding: 12, border: '1px solid var(--border)', borderLeft: \`4px solid \${color}\`, borderRadius: 10, background: \`\${color}0A\` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 14, wordBreak: 'break-word' }}>{slot.name}</strong>
                    <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{slot.category} &middot; {durationMinutes(slot.start, slot.end)}m {chip(status[0], status[1])}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <Button data-edit-action variant="secondary" onClick={() => openCheck(slot)} disabled={!hasActuals && !due && !inProgress} style={{ padding: '8px 12px', fontSize: 12.5 }}>
                      {hasActuals ? (slotActuals.length > 1 ? 'Edit first log' : 'Edit check-in') : (due || inProgress) ? 'Check in' : 'Upcoming'}
                    </Button>
                    {hasActuals && !isMissedCompletely && (
                      <Button variant="secondary" onClick={() => openCheck(slot, true)} style={{ padding: '4px 8px', fontSize: 11, color: 'var(--accent-indigo)', borderColor: 'rgba(99,102,241,0.2)' }}>+ Add log</Button>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 6, fontSize: 12, color: hasActuals ? 'var(--text-secondary)' : 'var(--text-muted)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!hasActuals ? 'Actual: awaiting your confirmation' : 
                     slotActuals.map((actual, idx) => (
                        <div key={actual.id} style={{ display: 'flex', flexDirection: 'column', paddingBottom: idx < slotActuals.length - 1 ? 8 : 0, borderBottom: idx < slotActuals.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                               <div style={{ flex: 1, minWidth: 0 }}>
                                 {actual.planOutcome === 'missed' ? 
                                    <span><strong style={{ color: 'var(--text-primary)' }}>Actual:</strong> Missed completely</span> : 
                                    <span><strong style={{ color: 'var(--text-primary)' }}>Actual:</strong> {actual.start}–{actual.end} &middot; {actual.name} <span style={{ color: actual.planOutcome === 'followed' ? '#34D399' : '#FB7185' }}>({actual.planOutcome})</span></span>
                                 }
                               </div>
                               {slotActuals.length > 1 && (
                                   <button type="button" onClick={() => openCheckSpecific(slot, actual)} aria-label="Edit this segment" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', textDecoration: 'underline' }}>
                                     edit
                                   </button>
                               )}
                           </div>
                           {actual.deviationReason && <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>Why:</strong> {actual.deviationReason}</div>}
                        </div>
                     ))
                  }
                </div>
              </div>
            </div>
          })}`;

   content = content.replace(originalStr, repl);
   fs.writeFileSync(path, content);
   console.log('Successfully replaced plans.map logic');
} else {
   console.log('Could not find start or end index', startIndex, endIndex);
}
