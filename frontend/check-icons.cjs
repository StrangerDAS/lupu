const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('/Users/stranger/lupu/frontend/src');

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find all used icons (e.g., <FiStar, <RiCar)
  const regex = /<(Fi[A-Z]\w+|Ri[A-Z]\w+|Md[A-Z]\w+)/g;
  const matches = [...content.matchAll(regex)];
  
  if (matches.length > 0) {
    const usedIcons = new Set(matches.map(m => m[1]));
    
    // Find all imports
    const importRegex = /import\s+{[^}]+}\s+from\s+['"]react-icons\/[^'"]+['"]/g;
    const imports = [...content.matchAll(importRegex)].join(' ');
    
    usedIcons.forEach(icon => {
      if (!imports.includes(icon)) {
        console.log(`[MISSING IMPORT] ${icon} in ${file}`);
      }
    });
  }
});
console.log('Scan complete.');
