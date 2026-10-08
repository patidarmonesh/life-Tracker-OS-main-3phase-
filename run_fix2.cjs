const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `  const baselines = state.timeflow?.planBaselines || []
  const baseline = baselines.find(b => b.date === date)
  const referencePlans = comparisonMode === 'original' && baseline ? baseline.slots : plans`;
  
const repl1 = `  const baselines = state.timeflow?.planBaselines || []
  const baseline = baselines.find(b => b.date === date)`;

const target2 = `  const [actualDraft, setActualDraft] = useState(null)
  const [comparisonMode, setComparisonMode] = useState('current')`;

const repl2 = `  const [actualDraft, setActualDraft] = useState(null)
  const [comparisonMode, setComparisonMode] = useState('current')
  
  const referencePlans = comparisonMode === 'original' && baseline ? baseline.slots : plans`;

if (content.includes(target1) && content.includes(target2)) {
    content = content.replace(target1, repl1).replace(target2, repl2);
    fs.writeFileSync(path, content);
    console.log('Fix 2 applied: comparisonMode reference fixed');
} else {
    console.log('Fix 2 targets not found');
}
