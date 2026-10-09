import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDriverShell } from './site-shell.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'index.html',
  'driver.html',
  'logo.png',
  'src/styles.css',
  'src/fleet.css',
  'src/main.js',
  'src/fleet.js',
  'src/redesign.css',
  'src/polish.css',
  'src/typography.css',
  'src/landing.css',
  'src/comparison.css',
  'src/driver/main.js',
  'src/driver/model.js',
  'src/driver/data.js',
  'src/driver/views.js',
  'src/driver/driver.css',
  'src/driver/camera.js',
  'src/driver/flow.js',
  'src/driver/summary.js',
  'assets/hero-flag.png',
  'assets/download-qr.png',
  'assets/fonts/satoshi-regular.woff2',
  'assets/fonts/satoshi-medium.woff2',
  'assets/fonts/satoshi-bold.woff2',
  'assets/fleet/premium.webp',
  'assets/fleet/executive.webp',
  'assets/fleet/luxury.webp',
  'assets/fleet/commercial.webp',
  'assets/fleet/electric.webp',
  'assets/fleet/minivan.webp',
  'assets/fleet/motorcoach.webp',
];

for (const file of files) {
  const destination = path.join(root, 'dist', file);
  await mkdir(path.dirname(destination), { recursive: true });
  if (file === 'driver.html') {
    const [template, landing] = await Promise.all([readFile(path.join(root, file), 'utf8'), readFile(path.join(root, 'index.html'), 'utf8')]);
    await writeFile(destination, renderDriverShell(template, landing));
  } else await copyFile(path.join(root, file), destination);
}
console.log(`Built ${files.length} public files into dist/`);
