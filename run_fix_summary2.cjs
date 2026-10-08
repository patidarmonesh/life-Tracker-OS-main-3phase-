const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { durationMinutes, planComparison, timeMinutes, validateSlots, WASTE_CATEGORIES } from '../../utils/planning'",
  "import { durationMinutes, planComparison, timeMinutes, validateSlots, WASTE_CATEGORIES, summarizeDay } from '../../utils/planning'"
);

const breakdownBlock = `        <Button variant="secondary" onClick={() => setDraft(items => [...items, blank()])} disabled={busy} style={{ marginTop: 10 }}>+ Add activity</Button>
        {(() => {
          const ds = summarizeDay(draft.map(s => ({...s, planOutcome: 'followed', date: draftDate})), draftDate, 1440, []);
          return (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                <span style={{ color: '#10B981' }}>Padhai (Productive) &middot; {formatMinutes(ds.productiveMins)}</span>
                <span style={{ color: '#EF4444' }}>Waste &middot; {formatMinutes(ds.wasteMins)}</span>
              </div>
              <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                {ds.productiveMins > 0 && <div style={{ width: \`\${(ds.productiveMins / (ds.productiveMins + ds.wasteMins || 1)) * 100}%\`, background: '#10B981' }} />}
                {ds.wasteMins > 0 && <div style={{ width: \`\${(ds.wasteMins / (ds.productiveMins + ds.wasteMins || 1)) * 100}%\`, background: '#EF4444' }} />}
              </div>
              <div style={{ fontSize: 12, color: ds.loggedMins !== 1440 ? '#FBBF24' : 'var(--text-muted)', marginTop: 8 }}>
                Total planned: {formatMinutes(ds.loggedMins)} {ds.loggedMins !== 1440 ? '(Warning: must equal 24h)' : ''}
              </div>
            </div>
          )
        })()}`;

content = content.replace(/<Button variant="secondary" onClick=\{[^}]+\} disabled=\{busy\} style=\{\{ marginTop: 10 \}\}>\+ Add activity<\/Button>/, breakdownBlock);
fs.writeFileSync(path, content);
console.log('Added summary to DayPlanner');
