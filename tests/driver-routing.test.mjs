import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderDriverShell } from '../scripts/site-shell.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('driver routes share exact landing chrome and serve every module without exposing source documents', async t => {
  const child = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true });
  t.after(() => child.kill());
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Local server did not start.')), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', value => {
      output += value;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.once('exit', code => { if (!output.match(/http:\/\/localhost:/)) { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); } });
  });
  const landing = await (await fetch(`${base}/`)).text();
  const template = await readFile(new URL('../driver.html', import.meta.url), 'utf8');
  const expected = renderDriverShell(template, landing);
  for (const route of ['/driver-application', '/driver-application/', '/driver.html']) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(await response.text(), expected, route);
  }
  assert.match(expected, /href="\/#business"/);
  assert.match(expected, /href="\/driver-application">Become an Operator/);
  assert.doesNotMatch(expected, /<!-- SITE_(HEADER|FOOTER)/);
  for (const file of ['main.js', 'camera.js', 'flow.js', 'summary.js', 'model.js', 'data.js', 'views.js']) {
    const response = await fetch(`${base}/src/driver/${file}`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type'), /text\/javascript/);
  }
  for (const file of ['/src/driver/driver.css', '/src/typography.css', '/assets/fonts/satoshi-regular.woff2', '/logo.png']) assert.equal((await fetch(`${base}${file}`)).status, 200, file);
  for (const privateFile of ['/docs/driver-reference.md', '/scripts/server.mjs', '/.git/config', '/package.json']) assert.equal((await fetch(`${base}${privateFile}`)).status, 404, privateFile);
});

test('production rewrite and shared-shell boundaries remain explicit', async () => {
  const configuration = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(configuration.rewrites.some(route => route.source === '/driver-application' && route.destination === '/driver.html'));
  assert.throws(() => renderDriverShell('<!-- SITE_HEADER -->', '<header>missing chrome</header>'), /Missing shared site fragment/);
});
