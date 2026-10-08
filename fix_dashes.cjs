const fs = require('fs');
for (const file of ['src/components/ui/DayPlanner.jsx', 'src/pages/TimeFlow.jsx', 'src/utils/planning.js']) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\?"/g, '-').replace(//g, '-');
    fs.writeFileSync(file, content);
}
console.log('Fixed dashes');
