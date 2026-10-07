import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || !['index.html', 'logo.png', 'assets/hero-flag.png', 'assets/download-qr.png', 'src/styles.css', 'src/fleet.css', 'src/main.js'].includes(relative.replaceAll('\\', '/'))) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(target)] || 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`RYDEPRO is ready at http://localhost:${port}`));
