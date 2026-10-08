const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `  const dayEntries = useMemo(
    () => allEntries
      .filter(e => e.date === selectedDate)
      .sort((a, b) => (a.start || '').localeCompare(b.start || '')),
    [allEntries, selectedDate]
  )`;

const repl = `  const dayEntries = useMemo(
    () => allEntries
      .filter(e => e.date === selectedDate && !e.ghost && e.planOutcome !== 'missed')
      .sort((a, b) => (a.start || '').localeCompare(b.start || '')),
    [allEntries, selectedDate]
  )`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    fs.writeFileSync(path, content);
    console.log('Success (Windows line endings)');
} else {
    const targetLF = target.replace(/\r\n/g, '\n');
    const replLF = repl.replace(/\r\n/g, '\n');
    content = content.replace(/\r\n/g, '\n');
    if (content.includes(targetLF)) {
        content = content.replace(targetLF, replLF);
        fs.writeFileSync(path, content);
        console.log('Success (Unix line endings)');
    } else {
        console.log('Could not find target');
    }
}
