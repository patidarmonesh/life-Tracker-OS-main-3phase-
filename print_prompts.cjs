const fs = require('fs');
let prompts = fs.readFileSync('user_prompts.txt', 'utf8').split('====================');
// Get the last 15 prompts
for (let i = Math.max(0, prompts.length - 15); i < prompts.length; i++) {
   console.log(`PROMPT ${i + 1}:\n${prompts[i].trim().slice(0, 500)}...\n\n`);
}
