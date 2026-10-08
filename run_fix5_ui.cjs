const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{error && <p role="alert" style=\{\{ color: '#F87171' \}\}>\{error\}<\/p>\}\s*<\/Modal>\s*<Modal isOpen=\{\!\!check\}/;
const match = content.match(regex);

if (match) {
    const repl = `{actualDraft && (
           <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
             <h4 style={{ fontSize: 13, marginBottom: 12 }}>Preview Imports (Edit if needed)</h4>
             <div style={{ display: 'grid', gap: 12 }}>
               {actualDraft.map(act => (
                 <div key={act.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <input style={{...input, padding: '4px 8px'}} value={act.name} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, name: e.target.value} : x))} />
                    <select style={{...input, padding: '4px 8px'}} value={act.category} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, category: e.target.value} : x))}>
                       {[...new Set([...categories, act.category])].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input type="time" style={{...input, padding: '4px 8px'}} value={act.start} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, start: e.target.value} : x))} />
                    <input type="time" style={{...input, padding: '4px 8px'}} value={act.end} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, end: e.target.value} : x))} />
                    <label style={{ gridColumn: '1 / -1', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                       <input type="checkbox" checked={act.isWaste} onChange={e => setActualDraft(d => d.map(x => x.id === act.id ? {...x, isWaste: e.target.checked} : x))} /> Mark as Waste
                    </label>
                 </div>
               ))}
             </div>
             <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
               <Button onClick={commitActualDraft} disabled={busy}>Confirm & Save Actuals</Button>
               <Button variant="secondary" onClick={() => setActualDraft(null)} disabled={busy}>Cancel</Button>
             </div>
           </div>
        )}
        {error && <p role="alert" style={{ color: '#F87171' }}>{error}</p>}
      </Modal>
      <Modal isOpen={!!check}`;
      
    content = content.replace(regex, repl);
    fs.writeFileSync(path, content);
    console.log('Fix 5 UI applied via Regex');
} else {
    console.log('regex match failed for Fix 5 UI');
}
