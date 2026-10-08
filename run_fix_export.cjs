const fs = require('fs');
const path = 'src/utils/planning.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace("import { resolveMinutes, kindOf } from './timeModel.js'", "import { resolveMinutes, kindOf } from './timeModel.js'\nexport { resolveMinutes }");
fs.writeFileSync(path, content);
