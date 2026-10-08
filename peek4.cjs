const fs = require('fs');
const content = fs.readFileSync('src/components/ui/DayPlanner.jsx', 'utf8');
const idx = content.indexOf('async function generateActuals() {');
const endSnippet = content.substring(idx + 1800, idx + 2500);
console.log(endSnippet);
