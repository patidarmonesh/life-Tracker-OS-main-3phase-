const fs = require('fs');
let code = fs.readFileSync('src/pages/Finance.jsx', 'utf8');
code = code.replace(/monthDate={selectedDate}/, 'month={selectedDate.slice(0, 7)}');
fs.writeFileSync('src/pages/Finance.jsx', code);
