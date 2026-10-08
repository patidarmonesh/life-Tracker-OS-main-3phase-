const fs = require('fs');
const readline = require('readline');

async function extractUserPrompts() {
    const rl = readline.createInterface({
        input: fs.createReadStream('C:/Users/mayan/.gemini/antigravity/brain/9436d56a-ba9a-4d0a-958d-ad3d7ca621d9/.system_generated/logs/transcript_full.jsonl'),
        crlfDelay: Infinity
    });

    let prompts = [];
    for await (const line of rl) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        if (entry.source === 'USER_EXPLICIT' && entry.type === 'USER_INPUT') {
            prompts.push(entry.content);
        }
    }
    
    fs.writeFileSync('user_prompts.txt', prompts.join('\n\n====================\n\n'));
    console.log(`Saved ${prompts.length} prompts to user_prompts.txt`);
}

extractUserPrompts();
