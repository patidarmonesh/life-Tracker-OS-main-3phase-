const fs = require('fs');
const content = fs.readFileSync('src/utils/planning.js', 'utf8');
console.log(content.slice(0, 50));
