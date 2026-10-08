const fs = require('fs');

for (const file of ['src/pages/TimeFlow.jsx', 'src/components/ui/DayPlanner.jsx', 'src/utils/planning.js', 'src/constants.js']) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/'Waste Time'/g, "'Timepass'");
    content = content.replace(/"Waste Time"/g, '"Timepass"');
    content = content.replace(/Waste Time category/g, "Timepass category");
    content = content.replace(/Waste Time analysis/i, "Timepass analysis");
    content = content.replace(/StatCard label="Waste Time"/g, 'StatCard label="Timepass"');
    fs.writeFileSync(file, content);
}
console.log('Renamed Waste Time to Timepass');
