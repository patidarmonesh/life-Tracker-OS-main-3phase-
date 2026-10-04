const fs = require('fs');
let code = fs.readFileSync('src/pages/Finance.jsx', 'utf8');
code = code.replace(/heatColor\\(daySpend, dailyBudget \\* 2, 'red'\\)/g, "heatColor('#EF4444', daySpend / (dailyBudget * 2))");
code = code.replace(/heatColor\\(daySpend, 2000, 'red'\\)/g, "heatColor('#EF4444', daySpend / 2000)");
fs.writeFileSync('src/pages/Finance.jsx', code);
