/** Optional dependency-free landing checks in a fresh headless Chromium profile. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = path.resolve(root, '.landing-qa');
const profile = path.join(temporary, `profile-${process.pid}`);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const candidates = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let executable;
for (const candidate of candidates) {
  try { await access(candidate); executable = candidate; break; } catch { /* Try another installed browser. */ }
}
if (!executable) throw new Error('Set BROWSER_PATH to an installed Chromium browser.');
await mkdir(profile, { recursive: true });
const server = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true });
let browser;
let socket;
let browserSocket;
let debugging;
try {
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Server startup timed out.')), 10000);
    server.once('error', reject);
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { debugging = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); break; } catch { await delay(150); }
  }
  if (!debugging) throw new Error('Headless browser startup timed out.');
  const endpoint = `http://127.0.0.1:${debugging[0]}`;
  const targets = await (await fetch(`${endpoint}/json/list`)).json();
  const target = targets.find(item => item.type === 'page' && item.url === 'about:blank') || targets.find(item => item.type === 'page');
  if (!target) throw new Error('No browser page target was available.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const failures = [];
  const responses = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.responseReceived') responses.set(new URL(message.params.response.url).pathname, message.params.response.status);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timeout } = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(timeout);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out.`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, timeout = 5000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(50); }
    throw new Error(`Page condition timed out: ${expression}`);
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const viewport = (width, height = 1000) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 700 });
  const motion = value => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
  const fleetState = () => evaluate(`({
    title: document.querySelector('#fleet-title').textContent,
    passengers: document.querySelector('#fleet-passengers').textContent,
    luggage: document.querySelector('#fleet-luggage').textContent,
    selectedClass: document.querySelector('[data-fleet][aria-selected=true]').dataset.fleet,
    options: [...document.querySelectorAll('#fleet-options button')].map(button => ({
      label: button.textContent, pressed: button.getAttribute('aria-pressed'),
      height: button.getBoundingClientRect().height, radius: getComputedStyle(button).borderRadius,
    })),
  })`);

  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await viewport(1440);
  await motion('reduce');
  await send('Page.navigate', { url: `${base}/#fleet` });
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('#fleet-options button[aria-pressed=true]')`);
  await evaluate('document.fonts.ready');
  const stylesheets = await evaluate(`[...document.querySelectorAll('link[rel=stylesheet]')].map(link => new URL(link.href).pathname)`);
  for (const stylesheet of stylesheets) assert.equal(responses.get(stylesheet), 200, `Stylesheet failed to load: ${stylesheet}`);
  assert.equal(await evaluate('document.querySelectorAll("#fleet img").length'), 0, 'Fleet must remain image-free.');
  assert.equal(await evaluate('document.querySelectorAll("#fleet-previous, #fleet-next, #fleet-play, #fleet-position").length'), 0);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.wait-times dd')].map(item => item.textContent.trim().replace(/\\s+/g, ' '))`), ['10 min', '60 min', '60 min', '5 min']);

  const classes = {
    premium: { name: 'Premium', options: ['Sedan', 'E-Sedan', 'Minivan'], passengers: ['3', '3', '5'] },
    executive: { name: 'Executive', options: ['Sedan', 'E-Sedan', 'SUV'], passengers: ['3', '3', '6'] },
    luxury: { name: 'Luxury', options: ['Sedan', 'E-Sedan', 'SUV'], passengers: ['3', '3', '6'] },
    commercial: { name: 'Commercial', options: ['Bus'], passengers: ['14'] },
  };
  for (const [key, expected] of Object.entries(classes)) {
    await click(`[data-fleet="${key}"]`);
    assert.deepEqual((await fleetState()).options.map(option => option.label), expected.options);
    for (const [index, option] of expected.options.entries()) {
      await click(`#fleet-options [data-vehicle-index="${index}"]`);
      const state = await fleetState();
      assert.equal(state.title, `${expected.name} ${option}`);
      assert.equal(state.passengers, expected.passengers[index]);
      assert.equal(state.luggage, 'Varies');
      assert.equal(state.selectedClass, key);
      assert.equal(state.options.filter(item => item.pressed === 'true').length, 1);
      assert.equal(state.options[index].pressed, 'true');
      for (const button of state.options) { assert.equal(button.height, 36); assert.equal(button.radius, '999px'); }
    }
  }
  const desktopColumns = await evaluate(`['.fleet-copy', '.fleet-specs', '.fleet-wait'].map(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { left: rect.left, right: rect.right }; })`);
  assert.ok(desktopColumns[0].right <= desktopColumns[1].left && desktopColumns[1].right <= desktopColumns[2].left, 'Desktop fleet columns must remain description, capacity, waiting time.');

  await click('[data-fleet="premium"]');
  await evaluate(`document.querySelector('#fleet').scrollIntoView({ behavior: 'instant', block: 'center' }); document.activeElement?.blur(); document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));`);
  await motion('no-preference');
  const automaticStart = Date.now();
  await waitFor(`document.querySelector('#fleet-title').textContent === 'Premium E-Sedan'`, 7000);
  const automaticElapsed = Date.now() - automaticStart;
  assert.ok(automaticElapsed >= 4700 && automaticElapsed < 7000, `Expected five-second rotation, received ${automaticElapsed}ms.`);
  await motion('reduce');
  console.log(`Fleet checks passed: all ten manual selections, waiting times, desktop columns, 36px pills, and automatic rotation (${automaticElapsed}ms).`);

  for (const width of [768, 390, 320]) {
    await viewport(width, 844);
    for (const key of Object.keys(classes)) {
      await click(`[data-fleet="${key}"]`);
      const overflow = await evaluate(`({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('#fleet *')].filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1); }).map(element => element.id || element.className || element.tagName) })`);
      assert.ok(overflow.scroll <= overflow.width, `Page overflows at ${width}px: ${JSON.stringify(overflow)}`);
      assert.deepEqual(overflow.elements, [], `Fleet overflows at ${width}px in ${key}.`);
      for (const button of (await fleetState()).options) assert.equal(button.height, 36);
    }
  }
  console.log('Responsive checks passed at 768px, 390px, and 320px with no horizontal overflow.');

  await viewport(1440);
  await click('#fleet [data-waitlist]');
  await waitFor(`location.hash === '#waitlist' && !document.querySelector('#waitlist').hidden && document.querySelector('#landing').hidden`);
  assert.equal(await evaluate('getComputedStyle(document.body).fontSize'), '16px');
  const waitlistControls = await evaluate(`[...document.querySelectorAll('#waitlist input, #waitlist select')].map(element => ({ height: element.getBoundingClientRect().height, radius: getComputedStyle(element).borderRadius }))`);
  assert.ok(waitlistControls.length > 0);
  for (const control of waitlistControls) { assert.equal(control.height, 36); assert.equal(control.radius, '999px'); }
  await viewport(390, 844);
  assert.equal(await evaluate('getComputedStyle(document.body).fontSize'), '12px');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await evaluate('document.querySelector("#waitlist input").getBoundingClientRect().height'), 36);
  assert.deepEqual(failures, []);
  console.log('Waitlist regression checks passed: 16px desktop / 12px mobile body text and 36px rounded fields. No browser runtime errors.');
} finally {
  if (debugging) {
    try {
      browserSocket = new WebSocket(`ws://127.0.0.1:${debugging[0]}${debugging[1]}`);
      await Promise.race([new Promise(resolve => browserSocket.addEventListener('open', resolve, { once: true })), delay(1000)]);
      if (browserSocket.readyState === WebSocket.OPEN) browserSocket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    } catch { /* Process cleanup below also handles a failed browser launch. */ }
  }
  socket?.close();
  browserSocket?.close();
  server.kill();
  await delay(350);
  browser?.kill();
  // Only remove the newly created isolated profile beneath this workspace directory.
  if (!path.resolve(temporary).startsWith(path.resolve(root) + path.sep) || !path.resolve(profile).startsWith(temporary + path.sep)) throw new Error('Unsafe browser-profile cleanup path.');
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
