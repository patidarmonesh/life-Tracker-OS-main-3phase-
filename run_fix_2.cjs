const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `        setModule('timeflow', current => ({
          ...current,
          entries: [...(current.entries || []), ...newEntries],`;

const repl = `        setModule('timeflow', current => ({
          ...current,
          entries: [...(current.entries || []).filter(e => !(e.date === draftDate && e.source === 'auto-diary')), ...newEntries],`;

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
