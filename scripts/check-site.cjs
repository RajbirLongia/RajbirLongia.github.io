const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sharp = require('sharp');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const css = read('assets/site.css');
assert(!/cdn\.tailwindcss\.com|unpkg\.com\/lucide|tailwind\.config/.test(html));
assert(html.includes('href="assets/site.css"'));
assert(html.includes('src="assets/vendor/lucide.min.js"'));
assert(/<script\s+defer\s+src="assets\/vendor\/lucide\.min\.js"><\/script>/.test(html));
assert(!html.includes('lucide.createIcons'), 'The deferred bundle must initialize its own icons');
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
const attributes = (markup) => Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)]
  .map((match) => [match[1], match[2]]));
// Run the shipped bundle against every placeholder, rather than just testing
// exports. Catch missing icons, lost classes/ARIA, or a missing initialization.
function element(tagName, attrs = {}) {
  return {
    tagName, attrs, children: [],
    get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); },
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    appendChild(child) { this.children.push(child); },
  };
}
const placeholders = [...html.matchAll(/<i\b[^>]*data-lucide="[^"]+"[^>]*><\/i>/g)]
  .map((match) => element('i', attributes(match[0])));
assert.equal(placeholders.length, [...html.matchAll(/data-lucide=/g)].length);
for (const placeholder of placeholders) {
  placeholder.parentNode = { replaceChild(svg, old) { assert.equal(old, placeholder); placeholder.svg = svg; } };
}
vm.runInNewContext(read('assets/vendor/lucide.min.js'), {
  document: {
    querySelectorAll: (selector) => selector === '[data-lucide]' ? placeholders : [],
    createElementNS(namespace, tag) {
      assert.equal(namespace, 'http://www.w3.org/2000/svg');
      return element(tag);
    },
  },
  console: { warn(message) { assert.fail(message); } },
});
const { icons } = require('lucide');
for (const placeholder of placeholders) {
  const name = placeholder.attrs['data-lucide'];
  const exportName = name.replace(/(^|-)([a-z])/g, (_, prefix, char) => char.toUpperCase());
  const svg = placeholder.svg;
  assert(svg, `Missing rendered icon: ${name}`);
  assert.equal(svg.tagName, 'svg');
  assert.equal(svg.attrs['aria-hidden'], 'true');
  assert.equal(svg.attrs.viewBox, '0 0 24 24');
  for (const className of placeholder.attrs.class.split(' ')) {
    assert(svg.attrs.class.split(' ').includes(className), `Lost ${className} on ${name}`);
  }
  assert.deepEqual(svg.children.map((child) => [child.tagName, child.attrs]), icons[exportName]);
}
assert(fs.statSync(path.join(root, 'assets/vendor/lucide.min.js')).size < 12_000,
  'Icon bundle exceeded its 12 KB budget; check for whole-catalogue imports');
assert.equal(read('assets/vendor/lucide-LICENSE'), read('node_modules/lucide/LICENSE'));

async function checkImages() {
  const picture = html.match(/<picture>([\s\S]*?)<\/picture>/)?.[1];
  assert(picture, 'Headshot needs a responsive picture element');
  const sources = [...picture.matchAll(/<(?:source|img)\b[^>]*>/g)].map((match) => attributes(match[0]));
  assert.deepEqual(sources.map((attrs) => attrs.type ?? 'image/jpeg'),
    ['image/avif', 'image/webp', 'image/jpeg']);
  const expectedSizes = '(min-width: 1024px) 399.2px, (min-width: 768px) calc(42.5vw - 36px), calc(100vw - 34px)';
  const budgets = { avif: [20_000, 90_000, 210_000], webp: [40_000, 160_000, 340_000], jpg: [50_000, 200_000, 400_000] };
  for (const [index, extension] of ['avif', 'webp', 'jpg'].entries()) {
    const attrs = sources[index];
    assert.equal(attrs.sizes, expectedSizes);
    const candidates = attrs.srcset.split(',').map((candidate) => candidate.trim().split(/\s+/));
    assert.equal(candidates.length, 3);
    for (const [i, width] of [400, 800, 1092].entries()) {
      const file = `assets/headshot-${width}.${extension}`;
      assert.deepEqual(candidates[i], [file, `${width}w`]);
      const filename = path.join(root, file);
      const metadata = await sharp(filename).metadata();
      assert.equal(metadata.width, width, file);
      assert.equal(metadata.height, width * 5 / 4, file);
      assert.equal(metadata.format, { avif: 'heif', webp: 'webp', jpg: 'jpeg' }[extension], file);
      assert(!metadata.exif && !metadata.icc, `Unnecessary metadata in ${file}`);
      assert(fs.statSync(filename).size < budgets[extension][i], `Size budget exceeded: ${file}`);
    }
  }
  const img = sources[2];
  assert.equal(img.src, 'assets/headshot-800.jpg');
  assert.equal(img.alt, 'Headshot of Rajbir Longia');
  assert.equal(img.width, '800');
  assert.equal(img.height, '1000');
  assert.equal(img.fetchpriority, 'high');
  assert.notEqual(img.loading, 'lazy', 'Keep the hero image eager');
  const social = await sharp(path.join(root, 'assets/headshot.jpg')).metadata();
  assert.equal(social.width, 1200);
  assert.equal(social.height, 800);
  assert(fs.statSync(path.join(root, 'assets/headshot.jpg')).size < 200_000);
  console.log(`Local assets, critical CSS, inline JS, ${placeholders.length} rendered icons, responsive images and size budgets verified.`);
}

checkImages().catch((error) => { console.error(error); process.exitCode = 1; });
