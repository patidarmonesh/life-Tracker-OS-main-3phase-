const fs = require('fs');
const lines = fs.readFileSync('extracted_DayPlanner.jsx', 'utf8').split('\n');
const cleaned = lines
  .filter(line => /^\d+: /.test(line))
  .map(line => line.replace(/^\d+: /, ''))
  .join('\n');
fs.writeFileSync('src/components/ui/DayPlanner.jsx', cleaned);
console.log('Restored DayPlanner.jsx');
