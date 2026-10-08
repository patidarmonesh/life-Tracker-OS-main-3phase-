const fs = require('fs');

for (const file of ['src/pages/TimeFlow.jsx', 'src/components/ui/DayPlanner.jsx', 'src/utils/planning.js', 'src/constants.js']) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix common capitalized words that were broken
    const words = ['ctuals', 'ctivity', 'utomatically', 'NALYSIS', 'dherence', 'pp', 'll', 'ny', 'pril', 'ugust', 'vailable', 'rray'];
    for (const w of words) {
        content = content.replace(new RegExp("·" + w, 'g'), "A" + w);
    }
    
    // Fix specific cases like "·I" -> "AI"
    content = content.replace(/·I/g, "AI");
    content = content.replace(/· /g, "A ");
    content = content.replace(/ · /g, " A ");
    content = content.replace(/set·/g, "setA");
    content = content.replace(/generate·/g, "generateA");
    content = content.replace(/get·/g, "getA");
    content = content.replace(/·"/g, "A\"");
    content = content.replace(/>·/g, ">A");
    
    fs.writeFileSync(file, content);
}
console.log('Restored A where appropriate');
