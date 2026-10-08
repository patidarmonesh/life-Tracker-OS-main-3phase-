const fs = require('fs');

for (const file of ['src/pages/TimeFlow.jsx', 'src/components/ui/DayPlanner.jsx', 'src/utils/planning.js', 'src/constants.js']) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // The replacement character is \uFFFD
    content = content.replace(/\uFFFD/g, 'A');
    
    fs.writeFileSync(file, content, 'utf8');
}
console.log('Restored A from replacement char');
