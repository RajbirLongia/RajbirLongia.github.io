const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
mkdirSync(join(root, 'assets/vendor'), { recursive: true });
for (const [source, destination] of [
  ['dist/umd/lucide.min.js', 'lucide.min.js'],
  ['LICENSE', 'lucide-LICENSE'],
]) {
  copyFileSync(join(root, 'node_modules/lucide', source), join(root, 'assets/vendor', destination));
}
