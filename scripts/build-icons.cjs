const { copyFileSync, mkdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { build } = require('esbuild');
const { icons } = require('lucide');
const root = join(__dirname, '..');

async function main() {
  // Discover icons from the page so adding a data-lucide attribute and rebuilding
  // is enough. Named imports let esbuild discard the rest of Lucide's catalogue.
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const names = [...new Set([...html.matchAll(/data-lucide\s*=\s*["']([^"']+)["']/g)]
    .map((match) => match[1]))].sort();
  if (!names.length) throw new Error('No data-lucide icons found in index.html');
  const exports = names.map((name) => {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
      throw new Error(`Invalid Lucide icon name: ${name}`);
    }
    const exportName = name.replace(/(^|-)([a-z0-9])/g, (_, prefix, char) => char.toUpperCase());
    if (!Object.hasOwn(icons, exportName)) throw new Error(`Unknown Lucide icon: ${name}`);
    return exportName;
  });
  mkdirSync(join(root, 'assets/vendor'), { recursive: true });
  await build({
    stdin: {
      contents: `import { createIcons, ${exports.join(', ')} } from 'lucide';\n` +
        `createIcons({ icons: { ${exports.join(', ')} } });\n`,
      resolveDir: root,
      sourcefile: 'site-icons.js',
    },
    outfile: join(root, 'assets/vendor/lucide.min.js'),
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    legalComments: 'eof',
  });
  copyFileSync(join(root, 'node_modules/lucide/LICENSE'), join(root, 'assets/vendor/lucide-LICENSE'));
  console.log(`Bundled ${names.length} Lucide icons: ${names.join(', ')}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
