import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../design/figma/', import.meta.url);
const screens = new Set(['landing-desktop', 'landing-mobile', 'waitlist-desktop', 'waitlist-mobile', 'confirmation-desktop', 'confirmation-mobile']);
const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  const name = new URL(request.url, 'http://localhost').pathname.slice(1).replace(/\.json$/, '');
  if (request.method !== 'GET' || !screens.has(name)) { response.writeHead(404); response.end(); return; }
  try {
    const data = await readFile(new URL(`source/${name}.json`, root));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(data);
  } catch { response.writeHead(500); response.end('Capture unavailable'); }
});
server.listen(9227, 'localhost', () => console.log(`Figma captures: http://localhost:9227 (only six screen snapshots from ${fileURLToPath(root)})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
