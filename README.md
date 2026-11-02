# Rajbir Longia’s research website

A static GitHub Pages site. Edit `index.html` for content; `assets/` contains the
published files. No server-side runtime or Pages build customization is needed.

## Rebuild styles, icons and images

Use Node.js 22 LTS (with npm), then run from the repository root:

```sh
npm ci
npm run build
npm test
```

Commit all generated files in `assets/` together with source changes and the
lockfile. GitHub Pages serves these checked-in assets directly; visitors
never download Tailwind or Lucide from a third-party CDN. To preview the site,
serve the repository with any static HTTP server (for example,
`python3 -m http.server 8000`) and open `http://localhost:8000`.

- `styles/tailwind.css` is the CSS entry point; `tailwind.config.cjs` scans
  `index.html`, including its inline JavaScript. Dark mode uses the `.dark` class.
- Keep utility class names complete (for example, `dark:block`), not assembled
  from fragments in JavaScript. If adding another HTML/JS file, include it in the
  Tailwind `content` list and rebuild. The current navigation and tabs use
  `hidden`/ARIA attributes, and the theme toggles `.dark`; their styles are retained.
- The stylesheet follows the existing custom `<style>` block, preserving the
  original browser-generated Tailwind cascade. Keep that order.
- `scripts/build-icons.cjs` discovers `data-lucide` names in `index.html` and uses
  esbuild to bundle only those named Lucide exports plus `createIcons`. Unknown
  names fail the build. The bundle initializes itself and is loaded with `defer`,
  after the HTML has been parsed; no inline Lucide call or global API is needed.
  The license is retained in `assets/vendor/`. Add icons in the HTML and rebuild.
- Tailwind **3.4.17** and Lucide **1.65.0** match the CDN versions at migration.
  Exact versions plus `package-lock.json` make installs repeatable. Update them
  deliberately with `npm install --save-dev --save-exact <package>@<version>`,
  then rebuild, test, and commit the lockfile and generated assets. A Tailwind
  major-version upgrade is a separate migration, not a routine rebuild.

## Responsive headshot

`images/headshot-original.jpg` is the unchanged source photograph. Replace that
file when updating the photo, then run `npm run build:images` (or the full build).
Do not edit the generated images or use the original as a page image.

The pinned Sharp build generates 400, 800 and 1092 pixel wide portraits with the
same centered 4:5 crop previously applied by CSS. The largest size uses the
source's full height; images are never upscaled. AVIF quality 50 is preferred,
with WebP quality 75 and progressive MozJPEG quality 85 fallbacks. Metadata is
stripped. The browser downloads just one candidate from `<picture>` based on
format support, viewport width and pixel density. `sizes` matches the existing
grid, padding and card borders; update it if that layout changes. Intrinsic
dimensions reserve space, and the hero image loads eagerly with high priority.

`assets/headshot.jpg` retains the social-preview URL and original landscape
composition at 1200 pixels wide, compressed to JPEG. It is not a homepage image
candidate. The original photograph remains in the repository for regeneration.

Uncompressed file sizes compared with commit `c10374d0` (network compression may
reduce JavaScript further):

| Resource | Before | After |
| --- | ---: | ---: |
| Homepage portrait, 400px AVIF | 1,166,827 B | 12,392 B |
| Homepage portrait, 800px AVIF | 1,166,827 B | 72,063 B |
| Homepage portrait, 1092px AVIF | 1,166,827 B | 171,421 B |
| Lucide JavaScript | 473,410 B | 4,682 B |
| Social-preview JPEG | 1,166,827 B | 170,638 B |

The portrait plus icons falls from 1,640,237 B to 17,074–176,103 B with AVIF,
a reduction of 89.3–99.0%, depending on the selected image. These are asset byte
savings, not measured loading-time or Lighthouse scores.

## Verification

`npm test` checks the existing critical CSS and inline JavaScript, executes the
shipped icon bundle against every placeholder, checks SVG paths/classes/ARIA,
and validates all responsive image candidates, dimensions and size budgets.

For browser checks, install Chromium once and run:

```sh
npx playwright install chromium
npm run test:browser
```

The browser checks cover 360, 390, 767, 768, 1024 and 1440 pixel viewports in light
and dark themes, high-density image selection, format fallbacks, delayed icon
loading, theme persistence, mobile navigation and keyboard tabs. Optional
`SCREENSHOT_DIR=.qa/screenshots` saves desktop/mobile screenshots. Set
`BASELINE_ROOT=/path/to/original-checkout` to also compare content, rendered SVGs
and layout geometry with an earlier checkout, and save before screenshots.
`CHROMIUM_EXECUTABLE_PATH` can select an already-installed Chromium binary.

GitHub Actions runs these checks on pull requests and `main`, verifies rebuilding
does not change committed assets, and uploads screenshots. A manual workflow run
can optionally take `baseline_ref` for an unchanged-design comparison; ordinary
checks allow intentional research-content and layout edits. The workflow does
not change the static GitHub Pages deployment.

Before publishing changes, check desktop and narrow-screen layouts in both
light and dark themes. Verify the menu opens/closes (including Escape and link
selection), keyboard focus stays visible, and publication tabs respond to clicks,
Left/Right arrows, Home, and End with the selected underline and correct panel.
