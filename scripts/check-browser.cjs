const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const baselineRoot = process.env.BASELINE_ROOT && path.resolve(process.env.BASELINE_ROOT);
const screenshotDir = process.env.SCREENSHOT_DIR && path.resolve(process.env.SCREENSHOT_DIR);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif' };

async function main() {
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const iconCount = [...html.matchAll(/data-lucide=/g)].length;
  if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });
  const server = http.createServer(async (request, response) => {
    let pathname = new URL(request.url, 'http://localhost').pathname;
    let directory = root;
    if (baselineRoot && pathname.startsWith('/__baseline__/')) {
      directory = baselineRoot;
      pathname = pathname.slice('/__baseline__'.length);
    }
    const file = path.resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return; }
    try {
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.end(await fs.readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
    const url = `http://127.0.0.1:${server.address().port}/`;
    // The breakpoint edges catch incorrect sizes calculations as well as layout
    // regressions. Fresh contexts prevent cached large images masking selection.
    for (const width of [360, 390, 767, 768, 1024, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const deviceScaleFactor = width < 768 ? 3 : 2;
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor, colorScheme });
        const page = await context.newPage();
        const errors = [];
        const requests = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
        page.on('request', (request) => requests.push(request.url()));
        page.on('response', (response) => { if (!response.ok()) errors.push(`${response.status()} ${response.url()}`); });
        await page.goto(url, { waitUntil: 'networkidle' });
        const image = page.locator('picture img');
        await image.evaluate((img) => img.decode());
        assert.equal(await page.locator('i[data-lucide]').count(), 0);
        assert.equal(await page.locator('svg[data-lucide]').count(), iconCount);
        assert.equal(await page.locator('svg[data-lucide][aria-hidden="true"]').count(), iconCount);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
          `Horizontal overflow at ${width}px`);
        const bounds = await image.boundingBox();
        const expectedWidth = width >= 1024 ? 399.2 : width >= 768 ? width * 0.425 - 36 : width - 34;
        assert(Math.abs(bounds.width - expectedWidth) < 1, `Incorrect image slot at ${width}px`);
        assert(Math.abs(bounds.height / bounds.width - 1.25) < 0.01, 'Portrait crop changed');
        const currentSrc = await image.evaluate((img) => img.currentSrc);
        const requiredPixels = expectedWidth * deviceScaleFactor;
        const candidate = [400, 800, 1092].find((size) => size >= requiredPixels) || 1092;
        assert(currentSrc.endsWith(`headshot-${candidate}.avif`), `Unexpected source: ${currentSrc}`);
        assert.equal(requests.filter((request) => /headshot.*\.(avif|webp|jpg)$/.test(request)).length, 1,
          'Only one portrait should download');
        assert(requests.every((request) => request.startsWith(url)), 'Unexpected third-party request');

        if ([390, 1440].includes(width)) {
          const label = `${width}-${colorScheme}`;
          if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `${label}-after.png`), fullPage: true, scale: 'css' });
          if (baselineRoot) {
            const before = await context.newPage();
            await before.goto(url + '__baseline__/', { waitUntil: 'networkidle' });
            await before.locator('img[alt="Headshot of Rajbir Longia"]').evaluate((img) => img.decode());
            const snapshot = (target) => target.evaluate(() => ({
              text: document.body.innerText,
              icons: [...document.querySelectorAll('svg[data-lucide]')].map((icon) => icon.outerHTML),
              regions: [...document.querySelectorAll('header, h1, img, main, #research, #publications, #contact')].map((el) => {
                const { x, y, width, height } = el.getBoundingClientRect();
                return [x, y, width, height].map((value) => Math.round(value * 100) / 100);
              }),
            }));
            assert.deepEqual(await snapshot(page), await snapshot(before), 'Content, icon SVGs or layout changed');
            if (screenshotDir) await before.screenshot({ path: path.join(screenshotDir, `${label}-before.png`), fullPage: true, scale: 'css' });
            await before.close();
          }
        }

        const theme = page.locator('#themeToggle');
        assert.equal(await theme.getAttribute('aria-label'), colorScheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        assert.equal(await page.locator('[data-lucide="sun"]').isVisible(), colorScheme === 'dark');
        assert.equal(await page.locator('[data-lucide="moon"]').isVisible(), colorScheme === 'light');
        await theme.click();
        assert.equal(await page.locator('[data-lucide="sun"]').isVisible(), colorScheme === 'light');
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await theme.getAttribute('aria-label'), colorScheme === 'light' ? 'Switch to light theme' : 'Switch to dark theme');

        const menu = page.locator('#menuToggle');
        if (width < 768) {
          assert(await menu.isVisible());
          await menu.click();
          assert.equal(await menu.getAttribute('aria-expanded'), 'true');
          assert(await page.locator('#mobileNav').isVisible());
          await page.keyboard.press('Escape');
          assert.equal(await menu.getAttribute('aria-expanded'), 'false');
          assert.equal(await page.locator(':focus').getAttribute('id'), 'menuToggle');
          await menu.click();
          await page.locator('#mobileNav a[href="#research"]').click();
          assert.equal(await menu.getAttribute('aria-expanded'), 'false');
          assert.equal(await page.locator('#mobileNav').isVisible(), false);
        } else {
          assert.equal(await menu.isVisible(), false);
        }

        await page.locator('#tab-preprints').click();
        assert(await page.locator('#panel-preprints').isVisible());
        for (const [key, name] of [['ArrowRight', 'prep'], ['ArrowRight', 'all'],
          ['ArrowLeft', 'prep'], ['Home', 'all'], ['End', 'prep']]) {
          await page.keyboard.press(key);
          assert.equal(await page.locator(':focus').getAttribute('id'), `tab-${name}`);
          assert.equal(await page.locator('[role="tab"][aria-selected="true"]').getAttribute('id'), `tab-${name}`);
          assert.equal(await page.locator('[role="tabpanel"]:visible').getAttribute('id'), `panel-${name}`);
        }
        assert.equal(await page.locator(':focus').evaluate((el) => getComputedStyle(el).outlineStyle), 'solid');
        assert.deepEqual(errors, []);
        console.log(`Verified ${width}px @${deviceScaleFactor}x ${colorScheme}: ${path.basename(currentSrc)}`);
        await context.close();
      }
    }
    // Emulate format support at initial parse time to exercise both fallbacks.
    for (const extension of ['webp', 'jpg']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: html.replace(
        /<source\b[\s\S]*?\/>/g, (source) => extension === 'jpg' || source.includes('image/avif') ? '' : source) }));
      await page.goto(url, { waitUntil: 'networkidle' });
      const image = page.locator('picture img');
      await image.evaluate((img) => img.decode());
      assert((await image.evaluate((img) => img.currentSrc)).endsWith(`headshot-400.${extension}`));
      await context.close();
    }
    // Delaying the icon script must not block parsing or break other controls.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let release;
    const delayed = new Promise((resolve) => { release = resolve; });
    await page.route('**/assets/vendor/lucide.min.js', async (route) => { await delayed; await route.continue(); });
    await page.goto(url, { waitUntil: 'commit' });
    try {
      await page.locator('#tab-all').waitFor();
      assert.equal(await page.locator('svg[data-lucide]').count(), 0);
      await page.locator('#menuToggle').click();
      assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'), 'true');
    } finally { release(); }
    await page.waitForLoadState('load');
    assert.equal(await page.locator('svg[data-lucide]').count(), iconCount);
    await context.close();
    console.log('Responsive layouts, image selection/fallbacks, deferred icons, themes, menu and keyboard tabs verified.');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
