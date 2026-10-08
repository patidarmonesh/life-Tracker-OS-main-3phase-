const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<div style=\{\{ marginTop: 8, fontSize: 12 \}\}>Padhai planned by now: \{formatMinutes\(timeSummary\.plannedProductiveMins\)\}.*?<\/div>\s*<\/div>\s*<\/Card>/s;

const match = content.match(regex);
if (match) {
    const repl = match[0].replace('</div>\n              </Card>', `</div>
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                     <h4 style={{ fontSize: 13, marginBottom: 12 }}>Cumulative Study Progress (24h)</h4>
                     <ResponsiveContainer width="100%" height={160}>
                       <LineChart data={cumulativeData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                         <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" minTickGap={30} stroke="var(--border)" />
                         <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => Math.round(v/60) + 'h'} stroke="var(--border)" />
                         <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }} itemStyle={{ fontSize: 12 }} labelStyle={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }} />
                         <Line type="monotone" dataKey="planned" name="Planned Study (m)" stroke="#10B981" strokeWidth={2} dot={false} opacity={0.4} />
                         <Line type="monotone" dataKey="actual" name="Logged Study (m)" stroke="#10B981" strokeWidth={2} dot={false} />
                       </LineChart>
                     </ResponsiveContainer>
                  </div>
                </div>
              </Card>`);
    content = content.replace(regex, repl);
    fs.writeFileSync(path, content);
    console.log('Cumulative Graph added to TimeFlow UI via regex');
} else {
    console.log('Regex target not found');
}
