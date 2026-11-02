const { join } = require('node:path');
const sharp = require('sharp');
const root = join(__dirname, '..');
const source = join(root, 'images/headshot-original.jpg');

async function main() {
  // Match the existing centered object-cover crop at 4:5. The largest variant
  // uses the original's full height (1365px), avoiding artificial upscaling.
  for (const width of [400, 800, 1092]) {
    const portrait = sharp(source).rotate().resize({
      width,
      height: width * 5 / 4,
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    });
    await portrait.clone().avif({ quality: 50, effort: 6 })
      .toFile(join(root, `assets/headshot-${width}.avif`));
    await portrait.clone().webp({ quality: 75, effort: 6 })
      .toFile(join(root, `assets/headshot-${width}.webp`));
    await portrait.clone().jpeg({ quality: 85, mozjpeg: true })
      .toFile(join(root, `assets/headshot-${width}.jpg`));
  }
  // Keep the existing social-preview URL and landscape composition, but compress
  // it too. This file is not a homepage image candidate.
  await sharp(source).rotate().resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true }).toFile(join(root, 'assets/headshot.jpg'));
  console.log('Generated responsive AVIF/WebP/JPEG portraits and the social-preview JPEG.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
