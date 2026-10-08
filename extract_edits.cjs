const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/mayan/.gemini/antigravity/brain/9436d56a-ba9a-4d0a-958d-ad3d7ca621d9/.system_generated/logs/transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.tool_calls) {
        for (const call of parsed.tool_calls) {
           if (call.name === 'replace_file_content' && call.args.TargetFile && call.args.TargetFile.includes('DayPlanner.jsx')) {
              console.log('--- replace_file_content ---');
              console.log('TargetContent:\n' + call.args.TargetContent);
              console.log('\nReplacementContent:\n' + call.args.ReplacementContent);
              console.log('----------------------------\n');
           }
           if (call.name === 'run_command' && call.args.CommandLine.includes('DayPlanner.jsx') && call.args.CommandLine.includes('Set-Content')) {
              console.log('--- run_command (DayPlanner) ---');
              console.log(call.args.CommandLine);
              console.log('----------------------------\n');
           }
        }
      }
    } catch (e) {}
  }
}

processLineByLine();
