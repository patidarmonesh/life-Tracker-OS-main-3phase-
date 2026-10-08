const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const anchor = `</div>
              </Card>
  
            )}
          </>}`;

const repl = `</div>
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
              </Card>
  
            )}
          </>}`;

// Find the anchor. It appears multiple times maybe? Let's find the index of "Padhai planned by now:" and search for the anchor after that.
const pIdx = content.indexOf('Padhai planned by now:');
if (pIdx !== -1) {
    const endCardIdx = content.indexOf('</Card>', pIdx);
    if (endCardIdx !== -1) {
        // Just insert before </Card>
        const originalPart = content.substring(pIdx, endCardIdx);
        content = content.substring(0, endCardIdx) + `  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
                ` + content.substring(endCardIdx);
        fs.writeFileSync(path, content);
        console.log('Graph UI applied');
    }
}
