/**
 * Generate PWA icons from the source SVG using sharp.
 *
 * Outputs:
 *   public/icons/icon-192.png   (192x192)
 *   public/icons/icon-512.png   (512x512)
 *   public/icons/icon-maskable-512.png (512x512, with safe-zone padding)
 */

import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'assets', 'icon-source.svg');
const outDir = resolve(root, 'public', 'icons');

mkdirSync(outDir, { recursive: true });

const svgBuffer = readFileSync(svgPath);

// Standard icon 192x192
await sharp(svgBuffer).resize(192, 192).png().toFile(resolve(outDir, 'icon-192.png'));

console.log('✓ public/icons/icon-192.png (192x192)');

// Standard icon 512x512
await sharp(svgBuffer).resize(512, 512).png().toFile(resolve(outDir, 'icon-512.png'));

console.log('✓ public/icons/icon-512.png (512x512)');

// Maskable icon 512x512 with safe-zone padding.
// Maskable icons require the important content to fit within the inner 80% circle (safe zone).
// We render the SVG at a smaller size and composite it onto a padded background.
const padding = Math.round(512 * 0.1); // 10% padding on each side
const innerSize = 512 - padding * 2; // 80% of 512 = ~410

const innerIcon = await sharp(svgBuffer).resize(innerSize, innerSize).png().toBuffer();

await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0f172a
  },
})
  .composite([{ input: innerIcon, left: padding, top: padding }])
  .png()
  .toFile(resolve(outDir, 'icon-maskable-512.png'));

console.log('✓ public/icons/icon-maskable-512.png (512x512, maskable)');
console.log('\nDone! All icons generated.');
