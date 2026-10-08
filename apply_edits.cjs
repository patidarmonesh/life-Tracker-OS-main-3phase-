const fs = require('fs');
const readline = require('readline');

async function applyEdits() {
  const fileStream = fs.createReadStream('C:/Users/mayan/.gemini/antigravity/brain/9436d56a-ba9a-4d0a-958d-ad3d7ca621d9/.system_generated/logs/transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let fileContent = fs.readFileSync('src/components/ui/DayPlanner.jsx', 'utf8');
  let editCount = 0;

  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.tool_calls) {
        for (const call of parsed.tool_calls) {
           if (call.name === 'replace_file_content' && call.args.TargetFile && call.args.TargetFile.includes('DayPlanner.jsx')) {
              // Apply edit!
              if (fileContent.includes(call.args.TargetContent)) {
                 fileContent = fileContent.replace(call.args.TargetContent, call.args.ReplacementContent);
                 editCount++;
                 console.log(`Applied edit ${editCount}`);
              } else {
                 console.log('Could not find TargetContent for an edit in step ' + parsed.step_index);
              }
           }
        }
      }
    } catch (e) {}
  }
  fs.writeFileSync('src/components/ui/DayPlanner.jsx', fileContent);
  console.log('Total edits applied:', editCount);
}

applyEdits();
