const fs = require('fs');
const path = 'src/utils/planning.js';
let content = fs.readFileSync(path, 'utf8');

const target = `  const isP = (c, name, isWaste) => !isWaste && (c === 'Study' || /study|padhai|class/i.test(c) || /study|padhai|class/i.test(name || ''))
  const isW = (c, name, isWaste) => !isP(c, name, isWaste)
  const isS = (c) => false`;

const repl = `  const isP = (c, name, isWaste) => c === 'Study' || /study|padhai|class/i.test(c) || /study|padhai|class/i.test(name || '')
  const isS = (c) => c === 'Sleep'
  // Waste is bucketed later in TimeFlow, here we just track actual waste categories
  const isW = (c, name, isWaste) => isWaste || c === 'Timepass' || c === 'Waste Time'`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    fs.writeFileSync(path, content);
    console.log('Fixed categories logic');
} else {
    // Try LF
    const targetLF = target.replace(/\r\n/g, '\n');
    const replLF = repl.replace(/\r\n/g, '\n');
    content = content.replace(/\r\n/g, '\n');
    if (content.includes(targetLF)) {
        content = content.replace(targetLF, replLF);
        fs.writeFileSync(path, content);
        console.log('Fixed categories logic (LF)');
    } else {
        console.log('Could not find target in planning.js');
    }
}
