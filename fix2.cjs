const fs = require('fs');
let code = fs.readFileSync('src/pages/Finance.jsx', 'utf8');
code = code.replace(/<DateNavigator\\s+date={selectedDate}\\s+onDateChange={onDateChange}\\s+mode="month"/, '<DateNavigator\\n          value={selectedDate}\\n          onChange={onDateChange}\\n          unit="month"');
code = code.replace(/date={selectedDate}/g, 'value={selectedDate}');
code = code.replace(/onDateChange={onDateChange}/g, 'onChange={onDateChange}');
code = code.replace(/mode="month"/g, 'unit="month"');
fs.writeFileSync('src/pages/Finance.jsx', code);
