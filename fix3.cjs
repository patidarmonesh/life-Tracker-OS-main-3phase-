const fs = require('fs');
let code = fs.readFileSync('src/pages/Finance.jsx', 'utf8');
code = code.replace(
  'unit="month"',
  'unit="month" today={localDate()}'
);
fs.writeFileSync('src/pages/Finance.jsx', code);
