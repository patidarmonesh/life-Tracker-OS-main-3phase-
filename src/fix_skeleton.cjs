const fs = require('fs');
const file = 'C:/Users/mayan/Downloads/antigravity working/lifeos-final/src/components/ui/Skeleton.jsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/borderRadius = [^,]+/, "borderRadius = 0");
code = code.replace(/borderRadius: '[^']+'/g, "borderRadius: '0px'");
code = code.replace(/borderRadius=\{[^}]+\}/g, "borderRadius={0}");

code = code.replace(/background: 'linear-gradient\([^)]+\)',\s*backgroundSize: '200% 100%',\s*animation: 'shimmer[^']+',/g, 
  "background: 'var(--bg-card-hover)', animation: 'skeletonPulse 1.5s infinite ease-in-out',");

fs.writeFileSync(file, code);
