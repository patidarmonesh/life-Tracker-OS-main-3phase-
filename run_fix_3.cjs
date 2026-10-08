const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /entries: \[\.\.\.\(current\.entries \|\| \[\]\), \.\.\.newEntries\],/,
  "entries: [...(current.entries || []).filter(e => !(e.date === draftDate && e.source === 'auto-diary')), ...newEntries],"
);
fs.writeFileSync(path, content);
console.log('Replaced successfully');
