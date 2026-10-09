/** Capture the public landing/waitlist UI as editable Figma source geometry. */
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'design/figma/source');
const temporary = path.resolve(root, '.figma-capture');
const profile = path.join(temporary, `profile-${process.pid}`);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const candidates = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
let executable;
for (const candidate of candidates) {
  try { await access(candidate); executable = candidate; break; } catch { /* Try the next installed browser. */ }
}
if (!executable) throw new Error('Set BROWSER_PATH to an installed Chromium browser.');
await mkdir(output, { recursive: true });
await mkdir(profile, { recursive: true });

const server = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true });
let browser;
let socket;
let browserSocket;
const errors = [];
const summaries = [];

// Computed property names stay in standard CSS notation for downstream importers.
const properties = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'align-items', 'align-content', 'align-self', 'order',
  'gap', 'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows',
  'grid-template-areas', 'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
  'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'border-collapse', 'border-spacing', 'background-color', 'background-image',
  'background-size', 'background-position', 'background-repeat', 'background-clip',
  'box-shadow', 'opacity', 'visibility', 'color', 'font-family', 'font-size',
  'font-style', 'font-weight', 'font-stretch', 'font-variant', 'line-height',
  'letter-spacing', 'word-spacing', 'text-align', 'text-transform',
  'text-decoration-line', 'text-decoration-color', 'text-decoration-style',
  'text-decoration-thickness', 'text-indent', 'white-space', 'word-break',
  'overflow-wrap', 'vertical-align', 'list-style-type', 'list-style-position',
  'object-fit', 'object-position', 'overflow', 'overflow-x', 'overflow-y',
  'clip', 'clip-path', 'transform', 'transform-origin', 'filter', 'backdrop-filter',
  'outline-color', 'outline-style', 'outline-width', 'outline-offset',
  'appearance', 'content', 'fill', 'stroke', 'stroke-width',
];

/** This function is serialized into the isolated browser; it has no Node access. */
function serializePage(name, viewport, cssProperties, clipToViewport) {
  const scroll = { x: window.scrollX, y: window.scrollY };
  const assetUrls = new Set();
  const rounded = value => Math.round(value * 1000) / 1000;
  const documentRect = rectangle => ({ x: rounded(rectangle.x + scroll.x), y: rounded(rectangle.y + scroll.y), width: rounded(rectangle.width), height: rounded(rectangle.height) });
  const cssFor = (element, pseudo) => {
    const computed = getComputedStyle(element, pseudo);
    const result = Object.fromEntries(cssProperties.map(property => [property, computed.getPropertyValue(property)]));
    for (const match of result['background-image'].matchAll(/url\(["']?(.*?)["']?\)/g)) {
      try { assetUrls.add(new URL(match[1], location.href).href); } catch { /* Ignore a malformed decoration. */ }
    }
    return result;
  };
  const assetKey = url => {
    try { const parsed = new URL(url, location.href); return parsed.origin === location.origin ? parsed.pathname + parsed.search : parsed.href; } catch { return url; }
  };
  const excludedTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION']);
  const rendered = element => {
    if (excludedTags.has(element.tagName) || element.hidden || (element.tagName === 'DIALOG' && !element.open)) return false;
    const computed = getComputedStyle(element);
    if (computed.display === 'none' || computed.visibility === 'hidden' || computed.visibility === 'collapse' || Number(computed.opacity) === 0) return false;
    // Screen-reader announcements are present in the DOM but do not appear visually.
    if (element.classList.contains('sr-only') || element.classList.contains('visually-hidden')) return false;
    // A line break affects text layout even when its own box has zero width.
    if (element.tagName === 'BR') return true;
    return [...element.getClientRects()].some(rectangle => rectangle.width > 0 && rectangle.height > 0);
  };
  const pseudoFor = (element, selector) => {
    const computed = getComputedStyle(element, selector);
    if (computed.display === 'none' || computed.visibility === 'hidden' || computed.content === 'none' || computed.content === 'normal') return null;
    return { selector, content: computed.content, css: cssFor(element, selector) };
  };
  const serialize = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange(); range.selectNodeContents(node);
      // Keep rendered whitespace between inline elements; only discard text
      // whose range has no visible area (including collapsed indentation).
      const rectangles = [...range.getClientRects()].filter(rectangle => rectangle.width > 0 && rectangle.height > 0).map(documentRect);
      if (!rectangles.length) return null;
      return { type: 'TEXT', text: node.textContent, rects: rectangles, css: cssFor(node.parentElement) };
    }
    if (node.nodeType !== Node.ELEMENT_NODE || !rendered(node)) return null;
    const element = node;
    const result = {
      type: 'ELEMENT', tag: element.tagName.toLowerCase(), id: element.id || null,
      classes: [...element.classList], rect: documentRect(element.getBoundingClientRect()),
      css: cssFor(element), children: [],
    };
    const attributes = {};
    for (const key of ['role', 'aria-label', 'aria-selected', 'aria-current', 'aria-expanded', 'data-active', 'href', 'type', 'name', 'required', 'disabled', 'open', 'colspan', 'rowspan']) {
      if (element.hasAttribute(key)) attributes[key] = element.getAttribute(key);
    }
    if (Object.keys(attributes).length) result.attributes = attributes;
    const pseudo = ['::before', '::after', '::marker'].map(selector => pseudoFor(element, selector)).filter(Boolean);
    if (pseudo.length) result.pseudo = pseudo;
    if (element.tagName === 'IMG') {
      const src = element.currentSrc || element.src;
      assetUrls.add(src);
      Object.assign(result, { src, assetKey: assetKey(src), alt: element.alt, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight });
    } else if (element.tagName === 'SVG' || element instanceof SVGSVGElement) {
      result.outerHTML = element.outerHTML;
      result.currentColor = result.css.color;
      return result;
    } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      result.value = element.value;
      result.placeholder = element.placeholder || '';
      result.placeholderCss = cssFor(element, '::placeholder');
      result.checked = Boolean(element.checked);
      return result;
    } else if (element.tagName === 'SELECT') {
      result.value = element.value;
      result.displayText = element.selectedOptions[0]?.textContent || '';
      result.options = [...element.options].map(option => ({ value: option.value, text: option.textContent, selected: option.selected, disabled: option.disabled }));
      return result;
    }
    result.children = [...element.childNodes].map(serialize).filter(Boolean);
    return result;
  };
  const tree = [...document.body.childNodes].map(serialize).filter(Boolean);
  const openDialog = [...document.querySelectorAll('dialog[open]')].find(rendered);
  const backdrop = openDialog ? { dialogId: openDialog.id, rect: { x: scroll.x, y: scroll.y, width: viewport.width, height: viewport.height }, css: cssFor(openDialog, '::backdrop') } : null;
  const count = { elements: 0, text: 0, images: 0, svg: 0 };
  const visit = nodes => { for (const node of nodes) { if (node.type === 'TEXT') count.text += 1; else { count.elements += 1; if (node.tag === 'img') count.images += 1; if (node.tag === 'svg') count.svg += 1; visit(node.children || []); } } };
  visit(tree);
  const pageHeight = Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  return {
    name, viewport, pageHeight, url: location.href, capturedAt: new Date().toISOString(),
    clipToViewport, scroll, bodyCss: cssFor(document.body), tree, backdrop,
    fonts: [...document.fonts].map(font => ({ family: font.family, style: font.style, weight: font.weight, status: font.status })),
    assetUrls: [...assetUrls], counts: count,
  };
}

try {
  const base = await new Promise((resolve, reject) => {
    let stdout = ''; let stderr = '';
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out. ${stderr}`)), 10000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.stderr.on('data', chunk => { stderr += chunk; });
    server.stdout.on('data', chunk => {
      stdout += chunk; const match = stdout.match(/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
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
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push({ type: 'runtime', message: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) errors.push({ type: 'network', message: message.params.errorText, requestId: message.params.requestId });
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400 && !message.params.response.url.endsWith('/favicon.ico')) errors.push({ type: 'http', status: message.params.response.status, url: message.params.response.url });
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timeout } = pending.get(message.id); pending.delete(message.id); clearTimeout(timeout);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out.`)); }, 30000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await delay(75);
    }
    throw new Error(`Page condition timed out: ${expression}`);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  const assets = new Map();
  const captureAsset = async url => {
    const parsed = new URL(url, base);
    if (parsed.origin !== base) throw new Error(`Capture refused a non-local asset: ${parsed.origin}`);
    const key = parsed.pathname + parsed.search;
    if (assets.has(key)) return assets.get(key);
    const response = await fetch(parsed);
    if (!response.ok) throw new Error(`Asset ${key} returned HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const mimeType = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0];
    const asset = { src: parsed.href, key, mimeType, byteLength: bytes.length, dataUri: `data:${mimeType};base64,${bytes.toString('base64')}` };
    if (mimeType.startsWith('image/')) {
      const png = await evaluate(`(async () => { const image = new Image(); image.src = ${JSON.stringify(parsed.href)}; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return {pngDataUri:canvas.toDataURL('image/png'),width:image.naturalWidth,height:image.naturalHeight}; })()`);
      Object.assign(asset, png);
    }
    assets.set(key, asset);
    return asset;
  };
  const settle = async landing => {
    // Chromium full-page screenshots suppress scrollbars. Suppress them before
    // measuring too, so screenshots and editable geometry use the same width.
    // This style exists only in the isolated capture browser, never site files.
    await evaluate(`(() => { if (document.querySelector('#figma-capture-scrollbars')) return; const style = document.createElement('style'); style.id = 'figma-capture-scrollbars'; style.textContent = '* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }'; document.head.append(style); })()`);
    await evaluate('document.fonts.ready');
    if (landing) {
      await evaluate(`document.querySelector('#fleet').scrollIntoView({behavior:'instant',block:'center'})`);
      await waitFor(`document.querySelector('#fleet-panel').getAttribute('aria-busy') !== 'true' && (!document.querySelector('#fleet-image') || (document.querySelector('#fleet-image').complete && document.querySelector('#fleet-image').naturalWidth > 0))`);
    }
    await evaluate(`Promise.all([...document.images].filter(image => image.getClientRects().length && getComputedStyle(image).display !== 'none').map(image => image.decode().catch(() => null)))`);
    await evaluate(`window.scrollTo({left:0,top:0,behavior:'instant'}); document.activeElement?.blur()`);
    await delay(200);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  };
  const capture = async (fileName, name, viewport, confirmation = false) => {
    const data = await evaluate(`(${serializePage.toString()})(${JSON.stringify(name)}, ${JSON.stringify(viewport)}, ${JSON.stringify(properties)}, ${confirmation})`);
    const localAssets = {};
    for (const url of data.assetUrls) {
      const asset = await captureAsset(url); localAssets[asset.key] = asset;
    }
    data.assets = localAssets;
    // Fonts are a separate source map; DOM text remains editable, never flattened.
    data.fontAssets = ['/assets/fonts/satoshi-regular.woff2', '/assets/fonts/satoshi-medium.woff2', '/assets/fonts/satoshi-bold.woff2'];
    const screenshotHeight = confirmation ? viewport.height : data.pageHeight;
    const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: !confirmation, clip: { x: 0, y: 0, width: viewport.width, height: screenshotHeight, scale: 1 } });
    await writeFile(path.join(output, `${fileName}.json`), JSON.stringify(data, null, 2));
    await writeFile(path.join(output, `${fileName}.png`), Buffer.from(screenshot.data, 'base64'));
    if (fileName.startsWith('landing-')) {
      for (const [label, selector] of [['hero', '#home'], ['pricing', '#pricing'], ['fleet', '#fleet'], ['business', '#business']]) {
        const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:0,y:r.y+scrollY,width:innerWidth,height:r.height,scale:1}; })()`);
        const sectionShot = await send('Page.captureScreenshot', {format:'png',fromSurface:true,captureBeyondViewport:true,clip:box});
        await writeFile(path.join(output, `${fileName}-${label}.png`), Buffer.from(sectionShot.data, 'base64'));
      }
    }
    summaries.push({ name: fileName, viewport, pageHeight: data.pageHeight, screenshotHeight, ...data.counts, assets: Object.keys(localAssets).length, backdrop: Boolean(data.backdrop) });
    console.log(`${fileName}: ${data.counts.elements} elements, ${data.counts.text} text nodes, ${viewport.width}×${screenshotHeight}, ${Object.keys(localAssets).length} assets.`);
  };
  for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: label === 'mobile' });
    await send('Page.navigate', { url: `${base}/` });
    await waitFor(`document.readyState === 'complete' && !!document.querySelector('#fleet-options .fleet-option') && !document.querySelector('#landing').hidden`);
    await settle(true);
    await capture(`landing-${label}`, `Landing / ${label}`, viewport);
    await evaluate(`location.hash = 'waitlist'`);
    await waitFor(`location.hash === '#waitlist' && !document.querySelector('#waitlist').hidden && document.querySelector('#landing').hidden`);
    await settle(false);
    await capture(`waitlist-${label}`, `Join waitlist / ${label}`, viewport);
    await evaluate(`(() => { const form = document.querySelector('#waitlist-form'); const values = {name:'Alex Morgan',email:'alex@example.com',city:'New York',state:'New York',postal:'10001',phone:''}; for(const [name,value] of Object.entries(values)){const field=form.elements.namedItem(name);if(!field)throw new Error('Missing waitlist field '+name);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));} const country=form.elements.namedItem('country'); const us=[...country.options].find(option => option.value === 'US' || option.textContent.trim() === 'United States'); if(!us)throw new Error('United States option missing');country.value=us.value;country.dispatchEvent(new Event('change',{bubbles:true}));if(!form.checkValidity())throw new Error('Sample waitlist form is invalid');form.requestSubmit(); })()`);
    await waitFor(`document.querySelector('#confirmation').open && document.querySelector('#confirmed-name').textContent === 'Alex'`);
    await settle(false);
    await capture(`confirmation-${label}`, `Confirmation / ${label}`, viewport, true);
  }
  for (const font of ['/assets/fonts/satoshi-regular.woff2', '/assets/fonts/satoshi-medium.woff2', '/assets/fonts/satoshi-bold.woff2']) await captureAsset(`${base}${font}`);
  await writeFile(path.join(output, 'assets.json'), JSON.stringify(Object.fromEntries(assets), null, 2));
  await writeFile(path.join(output, 'capture-summary.json'), JSON.stringify({ capturedAt: new Date().toISOString(), captures: summaries, errors }, null, 2));
  if (errors.length) {
    console.error(`Capture completed with ${errors.length} browser error(s): ${JSON.stringify(errors)}`);
    process.exitCode = 1;
  } else console.log(`All six captures completed without browser errors. Sources: ${output}`);
  browserSocket = new WebSocket(`ws://127.0.0.1:${debugging[0]}${debugging[1]}`);
  await new Promise(resolve => browserSocket.addEventListener('open', resolve, { once: true }));
  browserSocket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
} catch (error) {
  console.error(`Figma capture failed: ${error.stack || error}`);
  await writeFile(path.join(output, 'capture-summary.json'), JSON.stringify({ capturedAt: new Date().toISOString(), captures: summaries, errors: [...errors, { type: 'capture', message: error.message }] }, null, 2));
  process.exitCode = 1;
} finally {
  socket?.close(); browserSocket?.close(); server.kill();
  await delay(350); browser?.kill();
  // Only the isolated profile created above may be recursively removed.
  if (!path.resolve(profile).startsWith(temporary + path.sep)) throw new Error('Unsafe browser-profile cleanup path.');
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
