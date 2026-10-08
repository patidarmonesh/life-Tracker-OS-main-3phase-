const fs = require('fs');
const content = fs.readFileSync('src/utils/planning.js');
console.log(content.slice(0, 100));
