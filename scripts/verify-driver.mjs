/** Optional dependency-free, isolated Edge/Chromium browser verification. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.resolve(root, '.driver-qa');
const profile = path.join(artifacts, `profile-${process.pid}`);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const candidates = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Try another installed browser. */ } }
if (!executable) throw new Error('Set BROWSER_PATH to an installed Chromium browser to run this optional check.');
await mkdir(profile, { recursive: true });
const server = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true });
let browser;
let socket;
let browserSocket;
try {
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Server startup timed out.')), 10000);
    server.once('error', reject);
    server.stdout.on('data', chunk => { output += chunk; const match = output.match(/localhost:(\d+)/); if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); } });
  });
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let debugging;
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
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timeout } = pending.get(message.id); pending.delete(message.id); clearTimeout(timeout);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out.`)); }, 10000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 80; attempt += 1) { if (await evaluate(expression)) return; await delay(50); }
    const diagnostic = await evaluate('({url:location.href,title:document.title,body:document.body.innerText.slice(0,1800)})');
    throw new Error(`Page condition timed out: ${expression}\n${JSON.stringify({ diagnostic, failures }, null, 2)}`);
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = (name, value) => evaluate(`(() => { const element = [...document.querySelectorAll('[data-field]')].find(item => item.dataset.field === ${JSON.stringify(name)}); if (!element) throw new Error('Missing field: ' + ${JSON.stringify(name)}); element.value = ${JSON.stringify(value)}; element.dispatchEvent(new Event('input', {bubbles:true})); element.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  const page = id => waitFor(`location.hash === '#${id}' && !!document.querySelector('#driver-screen h1')`);
  const next = async id => { await click('#driver-actions button[type="submit"]'); await page(id); };
  const photo = async id => { await click('[data-action="camera-demo"]'); await waitFor(`!!document.querySelector('.driver-capture-preview')`); await click('[data-action="camera-accept"]'); await page(id); };
  const capture = async name => {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(artifacts, name), Buffer.from(result.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/driver-application` });
  await waitFor(`!!document.querySelector('[data-action="start"]')`);
  await evaluate('document.fonts.ready');
  assert.equal(await evaluate('getComputedStyle(document.body).fontSize'), '16px');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".header")).position'), 'sticky');
  await capture('welcome-desktop.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('getComputedStyle(document.body).fontSize'), '12px');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await evaluate('document.querySelector("[data-action=start]").getBoundingClientRect().bottom < innerHeight'), true);
  await capture('welcome-mobile.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await click('[data-action="start"]'); await page('account');
  await click('#driver-actions button[type="submit"]');
  assert.equal(await evaluate('document.querySelector("#driver-error-summary").hidden'), false);
  await fill('account.email', 'preview.driver@example.com'); await fill('account.password', 'Example1!'); await fill('account.confirmPassword', 'Example1!');
  assert.equal(await evaluate('document.querySelector("#driver-account-email").getBoundingClientRect().height'), 36);
  await click('[data-action="save-exit"]'); await send('Page.reload');
  await waitFor(`!!document.querySelector('[data-action="resume"]')`);
  await click('[data-action="resume"]'); await page('account');
  assert.equal(await evaluate('document.querySelector("#driver-account-password").value'), '');
  assert.equal(await evaluate('document.querySelector("#driver-account-email").value'), 'preview.driver@example.com');
  await fill('account.password', 'Example1!'); await fill('account.confirmPassword', 'Example1!');
  await capture('account-desktop.png'); await next('email'); await fill('otp', '123456'); await next('jurisdiction');
  await fill('jurisdiction.country', 'US'); await fill('jurisdiction.state', 'CA'); await fill('jurisdiction.city', 'Los Angeles'); await fill('jurisdiction.zip', '90001'); await next('identity');
  for (const [key, value] of Object.entries({ firstName: 'Demo', lastName: 'Driver', middleInitial: 'A', dob: '1990-01-15', phone: '5551234567' })) await fill(`identity.${key}`, value);
  await click('input[data-field="identity.sex"][value="Male"]'); await click('input[data-field="identity.sex"][value="Female"]');
  assert.equal(await evaluate('document.querySelectorAll(".driver-choice.is-selected").length'), 1);
  await next('license-front'); await photo('license-back'); await photo('license-details');
  await fill('license.number', 'D1234567'); await fill('license.stateOfIssue', 'CA'); await fill('license.issueDate', '2020-01-01'); await fill('license.expirationDate', '2030-01-01'); await next('portrait'); await photo('roles');
  for (const role of ['cl', 'id', 'lb', 'w2']) await click(`input[data-role][value="${role}"]`);
  await next('vehicles'); await click('input[data-field="vehicles.0.ownership"][value="Lease"]');
  for (const [key, value] of Object.entries({ make: 'Toyota', model: 'Camry', year: '2022', vin: '1HGBH41JXMN109186', plateState: 'CA', plateNumber: 'ABC1234', lessorName: 'Demo Lessor', leaseStart: '2024-01-01', leaseEnd: '2028-01-01' })) await fill(`vehicles.0.${key}`, value);
  await click('[data-action="toggle-vehicle"]'); assert.equal(await evaluate('document.querySelector("#driver-vehicle-fields-0").hidden'), true);
  await click('[data-action="toggle-vehicle"]'); await click('[data-action="add-vehicle"]'); await click('[data-action="remove-vehicle"][data-index="1"]'); await click('[data-action="dialog-confirm"]');
  assert.equal(await evaluate('document.querySelectorAll(".driver-repeat-card").length'), 1);
  await capture('vehicles-desktop.png');
  await next('business'); await click('input[data-field="business.structure"][value="LLC"]');
  for (const [key, value] of Object.entries({ legalName: 'Demo Livery LLC', dba: 'Demo Rides', yearEstablished: '2018', ein: '12-3456789', contactName: 'Demo Driver', title: 'Owner' })) await fill(`business.${key}`, value);
  await click('input[data-field="business.authorized"][value="No"]'); await next('fleets'); await click('input[data-field="fleets.0.relationship"][value="Other"]');
  await fill('fleets.0.name', 'Demo Fleet'); await fill('fleets.0.code', 'FLT-88291'); await fill('fleets.0.other', 'Approved affiliate'); await next('review');
  await click('[data-action="edit-step"][data-step="identity"]'); await page('identity'); await fill('identity.lastName', 'Updated'); await next('review');
  assert.equal(await evaluate('document.querySelector("[data-field=\\"certification.accepted\\"]").checked'), false);
  await click('input[data-field="certification.accepted"]'); await next('final'); await next('received');
  assert.equal(await evaluate('document.querySelector("[role=progressbar]").getAttribute("aria-valuenow")'), '100');
  assert.equal(await evaluate('document.querySelectorAll(".driver-milestones button[data-state=complete]").length'), 5);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await capture('complete-mobile.png');
  const draft = await evaluate('JSON.parse(sessionStorage.getItem("rydepro.driver.draft.v1")).state');
  assert.equal(draft.identity.lastName, 'Updated'); assert.equal(draft.account.password, ''); assert.equal(draft.license.frontImage, null); assert.equal(draft.passport.image, null); assert.equal(draft.certification.accepted, false);
  assert.deepEqual(failures, []);
  const downloads = path.join(artifacts, 'downloads');
  await mkdir(downloads, { recursive: true });
  const summaryFile = path.join(downloads, 'rydepro-driver-application-preview.json');
  await rm(summaryFile, { force: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await click('[data-action="download-summary"]');
  let downloaded;
  for (let attempt = 0; attempt < 80; attempt += 1) { try { downloaded = JSON.parse(await readFile(summaryFile, 'utf8')); break; } catch { await delay(50); } }
  assert.equal(downloaded?.preview.delivery, 'not-sent');
  assert.equal(downloaded.identity.lastName, 'Updated');
  assert.equal(downloaded.vehicles[0].lessorName, 'Demo Lessor');
  assert.equal(downloaded.fleets[0].other, 'Approved affiliate');
  assert.equal(downloaded.roles.primary.id, 'cl');
  assert.equal(downloaded.captures['passport.image'].demo, true);
  assert.equal(JSON.stringify(downloaded).includes('Example1!'), false);
  console.log('Browser checks passed: full multi-role flow, conditional fields, edit/review, validation, draft reload, desktop/mobile sizing, and shared sticky header.');
  console.log(`Screenshots: ${artifacts}`);
  browserSocket = new WebSocket(`ws://127.0.0.1:${debugging[0]}${debugging[1]}`);
  await new Promise(resolve => browserSocket.addEventListener('open', resolve, { once: true }));
  browserSocket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
} finally {
  socket?.close(); browserSocket?.close(); server.kill();
  await delay(350); browser?.kill();
  // This profile is newly created by this script, beneath the checked workspace artifact directory.
  if (!path.resolve(profile).startsWith(artifacts + path.sep)) throw new Error('Unsafe browser-profile cleanup path.');
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
