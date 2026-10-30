const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const css = read('assets/site.css');
assert(!/cdn\.tailwindcss\.com|unpkg\.com\/lucide|tailwind\.config/.test(html));
assert(html.includes('href="assets/site.css"'));
assert(html.includes('src="assets/vendor/lucide.min.js"'));
assert(html.indexOf('href="assets/site.css"') > html.indexOf('</style>'));
// Include responsive, dark and icon visibility utilities, including states that
// are not visible on the initial light/desktop render.
for (const selector of ['.hidden', '.block', '.md\\:hidden', '.md\\:flex',
  '.dark\\:block', '.dark\\:hidden', '.dark\\:text-gray-100',
  '.md\\:grid-cols-\\[1\\.15fr_\\.85fr\\]', '.aspect-\\[4\\/5\\]']) {
  assert(css.includes(selector), `Missing generated selector: ${selector}`);
}
assert(css.includes('(min-width:768px)'));
assert(html.includes('[hidden] { display: none !important; }'));
assert(html.includes('.tab-btn[aria-selected="true"]'));
for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  new vm.Script(script[1]);
}
const icons = {};
vm.runInNewContext(read('assets/vendor/lucide.min.js'), icons);
for (const match of html.matchAll(/data-lucide="([^"]+)"/g)) {
  const name = match[1].replace(/(^|-)([a-z])/g, (_, prefix, char) => char.toUpperCase());
  assert(icons.lucide.icons[name], `Missing icon: ${name}`);
}
console.log('Local assets, critical CSS states, inline JS syntax and all icons verified.');
