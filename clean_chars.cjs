const fs = require('fs');

for (const file of ['src/pages/TimeFlow.jsx', 'src/components/ui/DayPlanner.jsx', 'src/utils/planning.js', 'src/constants.js']) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\?"/g, "-");
    content = content.replace(/A/g, "·");
    content = content.replace(/s,\?/g, "??");
    content = content.replace(/dY-`,\?/g, "??");
    fs.writeFileSync(file, content);
}
console.log('Cleaned garbled characters');
