const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

// Find the exact problematic block by searching for each line individually
// and doing a positional replacement.

const line47_marker = '  const comparison = planComparison(referencePlans, entries, nowMin)';
const line56_marker = '  const referencePlans = comparisonMode === \'original\' && baseline ? baseline.slots : plans';

const idx47 = c.indexOf(line47_marker);
const idx56 = c.indexOf(line56_marker);

if (idx47 === -1 || idx56 === -1) {
  console.log('Could not find markers. idx47=' + idx47 + ' idx56=' + idx56);
  process.exit(1);
}

// Find the end of line 56 (after referencePlans declaration)
const endOfLine56 = c.indexOf('\n', idx56) + 1;

// Find the start of line 47 (beginning of comparison declaration)
const startOfLine47 = idx47;

// Extract the block between start of line 47 and end of line 56
const oldBlock = c.substring(startOfLine47, endOfLine56);
console.log('Found block to replace (' + oldBlock.length + ' chars):');
console.log(JSON.stringify(oldBlock.substring(0, 200)));

// New block: reorder so useState comes first, then referencePlans, then comparison
const newBlock = 
  '  const [open, setOpen] = useState(false)\r\n' +
  '  const [actualsOpen, setActualsOpen] = useState(false)\r\n' +
  '  const [expanded, setExpanded] = useState(null)\r\n' +
  '  const [draftDate, setDraftDate] = useState(date)\r\n' +
  '  const [draft, setDraft] = useState([])\r\n' +
  '  const [actualDraft, setActualDraft] = useState(null)\r\n' +
  '  const [comparisonMode, setComparisonMode] = useState(\'current\')\r\n' +
  '  const referencePlans = comparisonMode === \'original\' && baseline ? baseline.slots : plans\r\n' +
  '  const comparison = planComparison(referencePlans, entries, nowMin)\r\n';

c = c.substring(0, startOfLine47) + newBlock + c.substring(endOfLine56);

fs.writeFileSync(path, c);
console.log('FIX 1 applied: initialization order fixed');
