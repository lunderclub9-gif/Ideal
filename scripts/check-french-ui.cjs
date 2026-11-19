const fs = require('node:fs');
const path = require('node:path');

const roots = ['src', 'electron'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.css']);
const arabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u;
const violations = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (extensions.has(path.extname(entry.name))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (arabic.test(line)) violations.push(`${fullPath}:${index + 1}: ${line.trim()}`);
      });
    }
  }
}

for (const root of roots) walk(root);
if (violations.length) {
  console.error('Arabic characters found in application source:');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('French-only UI check passed: no Arabic characters found in src/ or electron/.');
