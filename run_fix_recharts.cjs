const fs = require('fs');
const path = 'src/pages/TimeFlow.jsx';
let content = fs.readFileSync(path, 'utf8');

const importRegex = /import \{ PieChart(.*?) \} from 'recharts'/;
content = content.replace(importRegex, "import { PieChart$1, LineChart, Line } from 'recharts'");

fs.writeFileSync(path, content);
console.log('Recharts imports updated');
