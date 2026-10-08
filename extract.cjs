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
      if (parsed.content && parsed.content.includes('export default function DayPlanner({ date, categories }) {') && parsed.content.includes('import { useEffect')) {
        console.log('Found full file in step: ' + parsed.step_index);
        // Maybe it's a diff? Let's check length
        if (parsed.content.length > 5000) {
            fs.writeFileSync('extracted_DayPlanner.jsx', parsed.content);
            console.log('Wrote to extracted_DayPlanner.jsx');
            return;
        }
      }
    } catch (e) {}
  }
  console.log('Done scanning.');
}

processLineByLine();
