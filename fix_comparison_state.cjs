const fs = require('fs');
const path = 'src/components/ui/DayPlanner.jsx';
let c = fs.readFileSync(path, 'utf8');

const oldState = `const [comparisonMode, setComparisonMode] = useState('current')`;
const newState = `const comparisonMode = state.timeflow?.comparisonMode || 'current'\r\n  const setComparisonMode = (mode) => setModule('timeflow', current => ({ ...current, comparisonMode: mode }))`;

if (c.includes(oldState)) {
  c = c.replace(oldState, newState);
  fs.writeFileSync(path, c);
  console.log('Replaced useState with Redux for comparisonMode');
} else {
  console.log('Could not find useState comparisonMode');
}
