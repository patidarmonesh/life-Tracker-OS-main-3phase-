const fs = require('fs');
const content = fs.readFileSync('src/components/ui/DayPlanner.jsx', 'utf8');
const idx = content.indexOf('async function generateActuals() {');
console.log(content.substring(idx, idx + 2500));
