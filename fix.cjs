const fs = require('fs');
let code = fs.readFileSync('src/pages/Finance.jsx', 'utf8');
code = code.replace(/id: 'today'/g, "key: 'today'")
           .replace(/id: 'month'/g, "key: 'month'")
           .replace(/id: 'year'/g, "key: 'year'")
           .replace(/id: 'bills'/g, "key: 'bills'")
           .replace('selected={activeTab} onSelect={setActiveTab}', 'value={activeTab} onChange={setActiveTab}');
fs.writeFileSync('src/pages/Finance.jsx', code);
