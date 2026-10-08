const fs = require('fs');
let code = fs.readFileSync('src/pages/Finance.jsx', 'utf8');
code = code.replace("function YearTab({ expenses }) {\\\\n  const today = localDate();", "function YearTab({ expenses }) {\\n  const today = localDate();");
fs.writeFileSync('src/pages/Finance.jsx', code);
