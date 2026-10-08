import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDriverShell } from './site-shell.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const publicFiles = new Set([
  'index.html', 'logo.png', 'src/styles.css', 'src/fleet.css', 'src/redesign.css', 'src/polish.css', 'src/main.js', 'src/fleet.js',
  'src/typography.css',
  'driver.html', 'src/driver/main.js', 'src/driver/model.js', 'src/driver/data.js', 'src/driver/views.js', 'src/driver/driver.css',
  'src/driver/camera.js', 'src/driver/flow.js', 'src/driver/summary.js',
  'assets/hero-flag.png', 'assets/download-qr.png',
  'assets/fonts/satoshi-regular.woff2', 'assets/fonts/satoshi-medium.woff2', 'assets/fonts/satoshi-bold.woff2',
  'assets/fleet/premium.webp', 'assets/fleet/executive.webp', 'assets/fleet/luxury.webp', 'assets/fleet/commercial.webp',
  'assets/fleet/electric.webp', 'assets/fleet/minivan.webp', 'assets/fleet/motorcoach.webp',
]);
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : /^\/driver-application\/?$/.test(pathname) ? 'driver.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || !publicFiles.has(relative.replaceAll('\\', '/'))) {
      res.writeHead(404); res.end('Not found'); return;
    }
    let content = await readFile(target);
    if (relative === 'driver.html') content = renderDriverShell(content.toString('utf8'), await readFile(path.join(root, 'index.html'), 'utf8'));
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(target)] || 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`RYDEPRO is ready at http://localhost:${server.address().port}`));
