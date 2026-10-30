# Rajbir Longia’s research website

A static GitHub Pages site. Edit `index.html` for content; `assets/` contains the
published files. No server-side runtime or Pages build customization is needed.

## Rebuild styles and icons

Use Node.js 22 LTS (with npm), then run from the repository root:

```sh
npm ci
npm run build
npm test
```

Commit the generated `assets/site.css` and `assets/vendor/` files together with
source changes. GitHub Pages serves these checked-in assets directly; visitors
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
- `scripts/copy-icons.cjs` copies the pinned Lucide browser bundle and its license.
  The existing `data-lucide` attributes and `lucide.createIcons()` API are unchanged.
- Tailwind **3.4.17** and Lucide **1.65.0** match the CDN versions at migration.
  Exact versions plus `package-lock.json` make installs repeatable. Update them
  deliberately with `npm install --save-dev --save-exact <package>@<version>`,
  then rebuild, test, and commit the lockfile and generated assets. A Tailwind
  major-version upgrade is a separate migration, not a routine rebuild.

Before publishing changes, check desktop and narrow-screen layouts in both
light and dark themes. Verify the menu opens/closes (including Escape and link
selection), keyboard focus stays visible, and publication tabs respond to clicks,
Left/Right arrows, Home, and End with the selected underline and correct panel.
