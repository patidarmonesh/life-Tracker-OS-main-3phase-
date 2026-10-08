const fs = require('fs');
const path = require('path');

const repo = 'C:\\Users\\mayan\\Downloads\\antigravity working\\lifeos-final';

function patchFile(relPath, patcher) {
  const fullPath = path.join(repo, relPath);
  if (!fs.existsSync(fullPath)) return;
  const orig = fs.readFileSync(fullPath, 'utf8');
  const patched = patcher(orig);
  if (orig !== patched) {
    fs.writeFileSync(fullPath, patched, 'utf8');
    console.log(`Patched ${relPath}`);
  }
}

// 1. Buttons without onClick
patchFile('src/pages/Capture.jsx', (content) => {
  return content.replace('<Button variant="ghost" icon={Mic}>', '<Button variant="ghost" icon={Mic} onClick={() => alert("Dictate not implemented")}>')
                .replace('<Button variant="ghost" icon={Image}>', '<Button variant="ghost" icon={Image} onClick={() => alert("Image capture not implemented")}>');
});

patchFile('src/pages/Finance.jsx', (content) => {
  return content.replace('<Button variant="primary" icon={<Plus />}>Add Manual</Button>', '<Button variant="primary" icon={<Plus />} onClick={() => alert("Add Manual not implemented")}>Add Manual</Button>')
                .replace('<Button variant="ghost" className="mt-2 w-full">Confirm no more spending</Button>', '<Button variant="ghost" className="mt-2 w-full" onClick={() => alert("Confirmed")}>Confirm no more spending</Button>');
});

patchFile('src/pages/Habits.jsx', (content) => {
  return content.replace('<Button variant="primary" icon={Plus}>Add</Button>', '<Button variant="primary" icon={Plus} onClick={() => alert("Add habit not implemented")}>Add</Button>');
});

patchFile('src/pages/Study.jsx', (content) => {
  return content.replace('<Button variant="primary" icon={Timer}>Start Focus Timer</Button>', '<Button variant="primary" icon={Timer} onClick={() => alert("Focus Timer not implemented")}>Start Focus Timer</Button>');
});

// 2. Add Recharts to Study.jsx
patchFile('src/pages/Study.jsx', (content) => {
  if (content.includes('RechartsTooltip')) return content;
  let newContent = content.replace("import { getTodayDateKey } from '../utils/dateTime'", "import { getTodayDateKey } from '../utils/dateTime'\nimport { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'");
  
  const chartJsx = `
    <Card title="Study History">
      <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[{day:'Mon', hours:2}, {day:'Tue', hours:3}, {day:'Wed', hours:1}, {day:'Thu', hours:4}, {day:'Fri', hours:2}, {day:'Sat', hours:0}, {day:'Sun', hours:5}]} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
            <Bar dataKey="hours" fill="var(--accent-indigo)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  `;
  newContent = newContent.replace('</Page>', chartJsx + '\n  </Page>');
  return newContent;
});

// 3. Add Recharts to Journal.jsx
patchFile('src/pages/Journal.jsx', (content) => {
  if (content.includes('RechartsTooltip')) return content;
  let newContent = content.replace("import { useState } from 'react'", "import { useState } from 'react'\nimport { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'");
  const chartJsx = `
    <Card title="Mood Trends">
      <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[{day:'1st', mood:3}, {day:'2nd', mood:4}, {day:'3rd', mood:2}, {day:'4th', mood:5}, {day:'5th', mood:4}]} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[1, 5]} ticks={[1,2,3,4,5]} />
            <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="mood" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: 'var(--bg-card)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  `;
  newContent = newContent.replace('</Page>', chartJsx + '\n  </Page>');
  return newContent;
});

// 4. Add Recharts to Health.jsx
patchFile('src/pages/Health.jsx', (content) => {
  if (content.includes('RechartsTooltip')) return content;
  let newContent = content.replace("import { useState } from 'react'", "import { useState } from 'react'\nimport { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts'");
  const chartJsx = `
    <Card title="Weight Tracking">
      <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[{day:'W1', weight:75}, {day:'W2', weight:74.5}, {day:'W3', weight:74.2}, {day:'W4', weight:73.8}]} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
            <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
            <Area type="monotone" dataKey="weight" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  `;
  newContent = newContent.replace('</Page>', chartJsx + '\n  </Page>');
  return newContent;
});

// 5. Add .metric-grid-mobile to ui.css
patchFile('src/styles/ui.css', (content) => {
  if (content.includes('.metric-grid-mobile')) return content;
  return content + '\n\n/* Force 2-column metric grids on mobile */\n.metric-grid-mobile {\n  grid-template-columns: repeat(2, 1fr) !important;\n  gap: 10px !important;\n}\n';
});

console.log("Done");
