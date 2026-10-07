import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'index.html',
  'logo.png',
  'src/styles.css',
  'src/fleet.css',
  'src/main.js',
  'assets/hero-flag.png',
  'assets/download-qr.png',
];

for (const file of files) {
  const destination = path.join(root, 'dist', file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(root, file), destination);
}
console.log(`Built ${files.length} public files into dist/`);
