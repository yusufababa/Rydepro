/**
 * Import browser-measured RYDEPRO snapshots into editable Figma Design nodes.
 * This module deliberately does not touch Figma until importRydeproSnapshot runs.
 * Captures, rather than screenshots, provide all text, layout, and asset data.
 */
const PAGE_NAME = 'RYDEPRO · Web design';
const SNAPSHOT_KEY = 'rydepro.snapshot';
const IMPORT_VERSION = '1';
const INLINE_TAGS = new Set(['span', 'strong', 'b', 'em', 'i', 'small', 'a', 'abbr', 'time', 'code', 'kbd', 'sup', 'sub', 'br']);
const EPSILON = 1.25;

function css(styles = {}, name, fallback = '') {
  const camel = name.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
  return styles[name] ?? styles[camel] ?? fallback;
}
function number(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function clamp(value, low = 0, high = 1) { return Math.min(high, Math.max(low, value)); }
function size(value) { return Math.max(0.01, number(value, 0.01)); }
function rect(node) {
  if (node?.rect) return { x: number(node.rect.x), y: number(node.rect.y), width: size(node.rect.width), height: size(node.rect.height) };
  return union(node?.rects || []);
}
function union(rectangles) {
  const boxes = rectangles.filter(Boolean);
  if (!boxes.length) return { x: 0, y: 0, width: 0.01, height: 0.01 };
  const x = Math.min(...boxes.map(box => box.x));
  const y = Math.min(...boxes.map(box => box.y));
  return { x, y, width: size(Math.max(...boxes.map(box => box.x + box.width)) - x), height: size(Math.max(...boxes.map(box => box.y + box.height)) - y) };
}
function splitCSS(value) {
  const parts = [];
  let start = 0, depth = 0, quote = '';
  for (let index = 0; index < String(value).length; index += 1) {
    const character = value[index];
    if (quote) { if (character === quote && value[index - 1] !== '\\') quote = ''; }
    else if (character === '"' || character === "'") quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === ',' && depth === 0) { parts.push(value.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(String(value).slice(start).trim());
  return parts.filter(Boolean);
}
function color(value) {
  if (!value || value === 'none' || value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const match = String(value).match(/^rgba?\(([^)]+)\)/i);
  if (match) {
    const channels = match[1].replace(/\//g, ',').split(/[\s,]+/).filter(Boolean);
    const channel = token => clamp(number(token) / (token?.endsWith('%') ? 100 : 255));
    return { r: channel(channels[0]), g: channel(channels[1]), b: channel(channels[2]), a: channels[3] === undefined ? 1 : clamp(number(channels[3]) / (channels[3].endsWith('%') ? 100 : 1)) };
  }
  const hex = String(value).match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map(character => character + character).join('') : hex;
    if (expanded.length === 6 || expanded.length === 8) return { r: Number.parseInt(expanded.slice(0, 2), 16) / 255, g: Number.parseInt(expanded.slice(2, 4), 16) / 255, b: Number.parseInt(expanded.slice(4, 6), 16) / 255, a: expanded.length === 8 ? Number.parseInt(expanded.slice(6), 16) / 255 : 1 };
  }
  const named = { white: '#ffffff', black: '#000000', gold: '#ffd700', red: '#ff0000', gray: '#808080', grey: '#808080' };
  return named[value] ? color(named[value]) : null;
}
function solid(value) {
  const rgba = color(value);
  return rgba && rgba.a > 0 ? { type: 'SOLID', color: { r: rgba.r, g: rgba.g, b: rgba.b }, opacity: rgba.a } : null;
}
function fontStyle(styles) {
  const weight = number(css(styles, 'font-weight'), 400);
  return weight >= 600 ? 'Bold' : weight >= 450 ? 'Medium' : 'Regular';
}
function nodeName(source) {
  const classes = Array.isArray(source.classes) ? source.classes : String(source.classes || '').split(/\s+/);
  const label = source.attributes?.['aria-label'] || source.attributes?.ariaLabel;
  const tag = source.tag || 'text';
  const identifier = source.id ? `#${source.id}` : classes.filter(Boolean).slice(0, 2).map(item => `.${item}`).join('');
  return `${tag}${identifier ? ` · ${identifier}` : ''}${label ? ` · ${label}` : ''}`;
}
function visible(source) {
  return css(source.css, 'display') !== 'none' && css(source.css, 'visibility') !== 'hidden'
    && (source.type !== 'ELEMENT' || (number(source.rect?.width) > 0 && number(source.rect?.height) > 0));
}
function isInlineTree(source) {
  if (/flex|grid/.test(css(source.css, 'display')) && (source.children || []).some(child => child.type === 'ELEMENT')) return false;
  return (source.children || []).every(child => child.type === 'TEXT' || (INLINE_TAGS.has(child.tag) && isInlineTree(child)));
}
function measuredSingleLine(source) {
  const rectangles = [];
  let breaks = 0;
  function walk(node) {
    if (node.tag === 'br') breaks += 1;
    if (node.type === 'TEXT') rectangles.push(...(node.rects || []));
    for (const child of node.children || []) walk(child);
  }
  walk(source);
  const lines = [];
  for (const rectangle of rectangles.filter(r => r.width > 0.01 && r.height > 0.01)) {
    const line = lines.find(row => Math.min(row.bottom, rectangle.y + rectangle.height) - Math.max(row.top, rectangle.y) > 1);
    if (line) { line.top = Math.min(line.top, rectangle.y); line.bottom = Math.max(line.bottom, rectangle.y + rectangle.height); }
    else lines.push({ top: rectangle.y, bottom: rectangle.y + rectangle.height });
  }
  return lines.length > 0 && lines.length === breaks + 1;
}
function isOverlay(source) {
  return ['absolute', 'fixed'].includes(css(source.css, 'position')) || source.tag === 'dialog';
}
function transformedText(text, styles) {
  const transform = css(styles, 'text-transform');
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') return text.replace(/\b\p{L}/gu, character => character.toUpperCase());
  return text;
}
function textRuns(source) {
  const runs = [];
  function add(text, styles, preserve = false) {
    if (!text) return;
    const whiteSpace = css(styles, 'white-space');
    const normalized = preserve || /^pre/.test(whiteSpace) ? text.replace(/\r\n?/g, '\n') : text.replace(/\s+/g, ' ');
    runs.push({ text: transformedText(normalized, styles), css: styles });
  }
  function walk(node) {
    if (node.type === 'TEXT') { add(node.text || '', node.css || source.css); return; }
    if (node.tag === 'br') { add('\n', node.css || source.css, true); return; }
    const block = node !== source && ['block', 'flex', 'grid'].includes(css(node.css, 'display'));
    if (block && runs.length && !runs.at(-1).text.endsWith('\n')) add('\n', node.css, true);
    (node.children || []).forEach(walk);
    if (block && runs.length && !runs.at(-1).text.endsWith('\n')) add('\n', node.css, true);
  }
  walk(source);
  // Collapse whitespace across inline DOM boundaries without joining separate words.
  let previousSpace = true;
  for (const run of runs) {
    if (previousSpace) run.text = run.text.replace(/^ +/, '');
    previousSpace = /[ \n]$/.test(run.text) || (!run.text && previousSpace);
  }
  while (runs.length && !runs[0].text) runs.shift();
  while (runs.length && !runs.at(-1).text) runs.pop();
  if (runs.length) { runs[0].text = runs[0].text.replace(/^\n+/, ''); runs.at(-1).text = runs.at(-1).text.replace(/[ \n]+$/, ''); }
  return runs.filter(run => run.text);
}
function base64Bytes(data, api) {
  if (api.base64Decode) return api.base64Decode(data);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = data.replace(/\s/g, '');
  const bytes = [];
  let bits = 0, value = 0;
  for (const character of clean) {
    if (character === '=') break;
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Invalid base64 image data in snapshot.');
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((value >> bits) & 255); }
  }
  return new Uint8Array(bytes);
}
function assetFor(snapshot, url) {
  if (snapshot.assets?.[url]) return snapshot.assets[url];
  let pathname = url;
  try { pathname = new URL(url, snapshot.url || 'https://rydepro.local').pathname; } catch { /* pathname keys remain usable in plugin sandboxes */ }
  return snapshot.assets?.[pathname] || Object.values(snapshot.assets || {}).find(asset => asset.src === url || asset.key === pathname);
}
function imageReferences(nodes, found = new Set()) {
  for (const source of nodes || []) {
    if (source.tag === 'img' && (source.assetKey || source.src)) found.add(source.assetKey || source.src);
    for (const match of String(css(source.css, 'background-image')).matchAll(/url\(["']?([^"')]+)["']?\)/g)) found.add(match[1]);
    for (const pseudo of source.pseudo || []) for (const match of String(css(pseudo.css, 'background-image')).matchAll(/url\(["']?([^"')]+)["']?\)/g)) found.add(match[1]);
    imageReferences(source.children, found);
  }
  return found;
}
function cluster(items, axis) {
  const groups = [];
  for (const item of [...items].sort((a, b) => a.rect[axis] - b.rect[axis])) {
    const group = groups.find(candidate => Math.abs(candidate[0].rect[axis] - item.rect[axis]) < 2.5);
    if (group) group.push(item); else groups.push([item]);
  }
  return groups;
}
function horizontalGeometry(items) {
  if (items.length < 2) return false;
  const sorted = [...items].sort((a, b) => a.rect.x - b.rect.x);
  return sorted.every((item, index) => !index || item.rect.x >= sorted[index - 1].rect.x + sorted[index - 1].rect.width - EPSILON)
    && Math.max(...items.map(item => item.rect.y)) < Math.min(...items.map(item => item.rect.y + item.rect.height));
}
function gradient(value, box, warn) {
  const match = value.match(/^(linear|radial)-gradient\((.*)\)$/i);
  if (!match) { warn(`Unsupported CSS background layer: ${value.slice(0, 100)}`); return null; }
  const parts = splitCSS(match[2]);
  let descriptor = '';
  if (!color(parts[0]?.match(/^(rgba?\([^)]*\)|#[\da-f]+|\w+)/i)?.[1])) descriptor = parts.shift() || '';
  const stops = parts.map(part => {
    const stop = part.match(/^(rgba?\([^)]*\)|#[\da-f]+|\w+)\s*(.*)$/i);
    const rgba = color(stop?.[1]);
    if (!rgba) throw new Error(`Unsupported captured gradient color: ${part}`);
    const token = stop[2].split(/\s+/)[0];
    return { position: token.endsWith('%') ? clamp(number(token) / 100) : null, color: rgba };
  });
  if (!stops.length) return null;
  if (stops[0].position === null) stops[0].position = 0;
  if (stops.at(-1).position === null) stops.at(-1).position = 1;
  for (let index = 1; index < stops.length; index += 1) {
    if (stops[index].position !== null) continue;
    const start = index - 1;
    let end = index + 1;
    while (end < stops.length && stops[end].position === null) end += 1;
    for (let cursor = index; cursor < end; cursor += 1) stops[cursor].position = stops[start].position + (stops[end].position - stops[start].position) * (cursor - start) / (end - start);
    index = end;
  }
  let transform;
  if (match[1].toLowerCase() === 'linear') {
    let angle = 180;
    if (/deg/.test(descriptor)) angle = number(descriptor);
    else if (/rad/.test(descriptor)) angle = number(descriptor) * 180 / Math.PI;
    else if (/turn/.test(descriptor)) angle = number(descriptor) * 360;
    else if (/to /.test(descriptor)) {
      const dx = /right/.test(descriptor) ? 1 : /left/.test(descriptor) ? -1 : 0;
      const dy = /bottom/.test(descriptor) ? 1 : /top/.test(descriptor) ? -1 : 0;
      angle = Math.atan2(dx, -dy) * 180 / Math.PI;
    }
    const dx = Math.sin(angle * Math.PI / 180), dy = -Math.cos(angle * Math.PI / 180);
    const length = Math.abs(dx) * box.width + Math.abs(dy) * box.height;
    // Figma transforms normalized local coordinates into canonical gradient coordinates.
    const a = dx * box.width / Math.max(length, 0.01), b = dy * box.height / Math.max(length, 0.01);
    transform = [[a, b, 0.5 - (a + b) / 2], [-b, a, 0.5 + (b - a) / 2]];
  } else {
    const position = descriptor.match(/at\s+([^,]+)/)?.[1]?.trim().split(/\s+/) || ['50%', '50%'];
    const fraction = (token, dimension) => token === 'left' || token === 'top' ? 0 : token === 'right' || token === 'bottom' ? 1 : token === 'center' ? 0.5 : token?.endsWith('%') ? number(token) / 100 : number(token, dimension / 2) / dimension;
    const cx = fraction(position[0], box.width), cy = fraction(position[1] || '50%', box.height);
    let rx = Math.max(cx, 1 - cx), ry = Math.max(cy, 1 - cy);
    if (/closest/.test(descriptor)) { rx = Math.min(cx, 1 - cx); ry = Math.min(cy, 1 - cy); }
    if (/circle/.test(descriptor)) { const radius = Math.hypot(rx * box.width, ry * box.height); rx = radius / box.width; ry = radius / box.height; }
    else if (!/side/.test(descriptor)) { rx *= Math.SQRT2; ry *= Math.SQRT2; }
    const a = 1 / Math.max(2 * rx, 0.01), d = 1 / Math.max(2 * ry, 0.01);
    transform = [[a, 0, 0.5 - cx * a], [0, d, 0.5 - cy * d]];
  }
  return { type: match[1].toLowerCase() === 'linear' ? 'GRADIENT_LINEAR' : 'GRADIENT_RADIAL', gradientTransform: transform, gradientStops: stops };
}

/**
 * @param {object} snapshot Browser capture from design/figma/source.
 * @param {{figma?: object, replace?: boolean, focus?: boolean}} options
 * @returns {Promise<{id:string,url?:string,warnings:string[],textCount:number,autoLayoutCount:number,skipped?:boolean}>}
 */
export async function importRydeproSnapshot(snapshot, options = {}) {
  const api = options.figma || globalThis.figma;
  if (!api?.createFrame || !api?.createText || !api?.listAvailableFontsAsync || !api?.loadFontAsync) throw new Error('The RYDEPRO importer must run inside a connected Figma Design plugin or Figma plugin execution bridge. No Figma document was changed.');
  if (api.editorType && api.editorType !== 'figma') throw new Error('Open a Figma Design file before importing RYDEPRO. FigJam and Slides are not supported.');
  if (!snapshot?.name || !Array.isArray(snapshot.tree) || !number(snapshot.viewport?.width) || !number(snapshot.viewport?.height)) throw new Error('Invalid RYDEPRO snapshot: name, viewport dimensions, and a captured element tree are required.');

  const available = await api.listAvailableFontsAsync();
  const fonts = {};
  const family = ['RYDEPRO Satoshi', 'Satoshi'].find(candidate => ['Regular', 'Medium', 'Bold'].every(style => available.some(entry => entry.fontName?.family?.toLowerCase() === candidate.toLowerCase() && entry.fontName.style?.toLowerCase() === style.toLowerCase()))) || 'RYDEPRO Satoshi';
  for (const style of ['Regular', 'Medium', 'Bold']) fonts[style] = available.find(entry => entry.fontName?.family?.toLowerCase() === family.toLowerCase() && entry.fontName.style?.toLowerCase() === style.toLowerCase())?.fontName;
  const missing = Object.keys(fonts).filter(style => !fonts[style]);
  if (missing.length) throw new Error(`Satoshi ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} unavailable in Figma. Install the three desktop TTFs in design/figma/fonts (family RYDEPRO Satoshi), restart Figma (or enable its local font helper), and retry. No design nodes were created.`);
  try { await Promise.all(Object.values(fonts).map(font => api.loadFontAsync(font))); }
  catch (error) { throw new Error(`Figma could not load Satoshi: ${error.message}. Restart Figma after installing the supplied desktop fonts. No design nodes were created.`); }

  const warnings = new Set();
  const warn = message => warnings.add(message);
  const imageCache = new Map();
  // Figma accepts PNG/JPEG/GIF. WebP source assets use the capture's PNG conversion.
  for (const url of imageReferences(snapshot.tree)) {
    const asset = assetFor(snapshot, url);
    const dataURI = asset?.pngDataUri || asset?.pngDataURI || asset?.dataUri || asset?.dataURI;
    if (!dataURI) throw new Error(`Missing captured image asset ${url}. Regenerate the snapshots before importing. No design nodes were created.`);
    const match = dataURI.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/s);
    if (!match) throw new Error(`Asset ${url} needs a PNG conversion for Figma. Regenerate the capture assets. No design nodes were created.`);
    const existing = imageCache.get(dataURI);
    const image = existing || api.createImage(base64Bytes(match[2], api));
    imageCache.set(dataURI, image);
    imageCache.set(url, { image, asset });
  }

  let page = options.pageId
    ? await api.getNodeByIdAsync(options.pageId)
    : api.root.children.find(node => node.type === 'PAGE' && node.name === PAGE_NAME);
  if (options.pageId && page?.type !== 'PAGE') throw new Error('The requested Figma page is unavailable. No design nodes were created.');
  if (page?.loadAsync) await page.loadAsync();
  const targetSection = options.sectionId ? await api.getNodeByIdAsync(options.sectionId) : null;
  if (options.sectionId && (targetSection?.type !== 'SECTION' || targetSection.parent !== page)) throw new Error('The requested Figma section is unavailable on the target page. No design nodes were created.');
  const key = `${snapshot.name}:${snapshot.viewport.width}x${snapshot.viewport.height}`;
  const searchRoot = targetSection || page;
  const ownedFrames = searchRoot?.findAll ? searchRoot.findAll(node => node.getPluginData?.(SNAPSHOT_KEY) === key) : [];
  const existing = ownedFrames[0];
  const resultFor = (frame, skipped = false) => ({ id: frame.id, ...(api.fileKey ? { url: `https://www.figma.com/design/${api.fileKey}?node-id=${encodeURIComponent(frame.id)}` } : {}), warnings: [...warnings], textCount: number(frame.getPluginData?.('rydepro.textCount')), autoLayoutCount: number(frame.getPluginData?.('rydepro.autoLayoutCount')), ...(skipped ? { skipped: true } : {}) });
  if (existing && !options.replace) {
    if (options.focus !== false) { await api.setCurrentPageAsync(page); api.currentPage.selection = [existing]; api.viewport.scrollAndZoomIntoView([existing]); }
    return resultFor(existing, true);
  }

  let newPage = false, newSection = false, section, root;
  let textCount = 0, autoLayoutCount = 0;
  const created = [];
  const track = node => { created.push(node); return node; };
  const resize = (node, width, height) => node.resize(size(width), size(height));
  const frame = (name, box) => { const node = track(api.createFrame()); node.name = name; node.fills = []; node.clipsContent = false; resize(node, box.width, box.height); return node; };
  const auto = (node, direction) => {
    if (node.layoutMode !== direction) autoLayoutCount += 1;
    node.layoutMode = direction;
    // Captured CSS padding already includes border edges; avoid counting them twice.
    node.strokesIncludedInLayout = false;
    node.primaryAxisSizingMode = 'FIXED'; node.counterAxisSizingMode = 'FIXED';
    node.primaryAxisAlignItems = 'MIN'; node.counterAxisAlignItems = 'MIN';
    node.itemSpacing = 0;
    node.paddingTop = 0; node.paddingRight = 0; node.paddingBottom = 0; node.paddingLeft = 0;
  };
  const fills = (styles, box) => {
    const paints = [];
    const backgrounds = splitCSS(css(styles, 'background-image', 'none'));
    for (let index = 0; index < backgrounds.length; index += 1) {
      const layer = backgrounds[index];
      if (layer === 'none') continue;
      const url = layer.match(/^url\(["']?([^"')]+)["']?\)$/)?.[1];
      if (url) {
        const entry = imageCache.get(url);
        if (!entry) throw new Error(`Missing cached background image: ${url}`);
        const backgroundSize = splitCSS(css(styles, 'background-size'))[index] || splitCSS(css(styles, 'background-size'))[0] || 'cover';
        paints.push({ type: 'IMAGE', imageHash: entry.image.hash, scaleMode: backgroundSize === 'contain' ? 'FIT' : 'FILL' });
      } else { const paint = gradient(layer, box, warn); if (paint) paints.push(paint); }
    }
    const paint = solid(css(styles, 'background-color'));
    if (paint) paints.push(paint);
    return paints;
  };
  const effects = styles => {
    const output = [];
    for (const shadow of splitCSS(css(styles, 'box-shadow', 'none'))) {
      if (shadow === 'none') continue;
      const rgba = color(shadow.match(/rgba?\([^)]*\)|#[\da-f]+/i)?.[0]) || color('black');
      const lengths = shadow.replace(/rgba?\([^)]*\)|#[\da-f]+/gi, '').match(/-?[\d.]+px/g)?.map(value => number(value)) || [];
      if (lengths.length >= 2) output.push({ type: /\binset\b/.test(shadow) ? 'INNER_SHADOW' : 'DROP_SHADOW', color: rgba, offset: { x: lengths[0], y: lengths[1] }, radius: Math.max(0, lengths[2] || 0), spread: lengths[3] || 0, visible: true, blendMode: 'NORMAL' });
    }
    const blur = css(styles, 'filter').match(/blur\(([^)]+)\)/);
    const backdrop = css(styles, 'backdrop-filter').match(/blur\(([^)]+)\)/);
    if (blur) output.push({ type: 'LAYER_BLUR', radius: Math.max(0, number(blur[1])), visible: true });
    if (backdrop) output.push({ type: 'BACKGROUND_BLUR', radius: Math.max(0, number(backdrop[1])), visible: true });
    return output;
  };
  const styleFrame = (node, source) => {
    const box = rect(source), styles = source.css || {};
    node.fills = fills(styles, box);
    node.opacity = clamp(number(css(styles, 'opacity'), 1));
    node.effects = effects(styles);
    node.clipsContent = /hidden|clip|auto|scroll/.test(css(styles, 'overflow'));
    const sides = ['top', 'right', 'bottom', 'left'];
    const weights = sides.map(side => /none|hidden/.test(css(styles, `border-${side}-style`, 'none')) ? 0 : number(css(styles, `border-${side}-width`)));
    const strokeSide = weights.findIndex(weight => weight > 0);
    if (strokeSide >= 0) {
      node.strokes = [solid(css(styles, `border-${sides[strokeSide]}-color`))].filter(Boolean);
      node.strokeAlign = 'INSIDE';
      node.strokeTopWeight = weights[0]; node.strokeRightWeight = weights[1]; node.strokeBottomWeight = weights[2]; node.strokeLeftWeight = weights[3];
      if (sides.some((side, index) => weights[index] > 0 && css(styles, `border-${side}-color`) !== css(styles, `border-${sides[strokeSide]}-color`))) warn(`${node.name}: individual border colors require a final visual check.`);
    }
    for (const [property, corner] of [['topLeftRadius', 'top-left'], ['topRightRadius', 'top-right'], ['bottomRightRadius', 'bottom-right'], ['bottomLeftRadius', 'bottom-left']]) {
      const token = css(styles, `border-${corner}-radius`, css(styles, 'border-radius'));
      node[property] = Math.min(Math.min(box.width, box.height) / 2, token.includes('%') ? number(token) / 100 * Math.min(box.width, box.height) : number(token));
    }
    const blend = css(styles, 'mix-blend-mode');
    if (blend === 'multiply') node.blendMode = 'MULTIPLY';
    node.setPluginData('rydepro.source', JSON.stringify({ tag: source.tag, id: source.id, classes: source.classes, rect: box }));
  };
  const makeText = (runs, box, styles, name, singleLine = false) => {
    const node = track(api.createText());
    textCount += 1;
    node.name = name;
    node.fontName = fonts[fontStyle(styles)];
    node.fontSize = Math.max(1, number(css(styles, 'font-size'), 12));
    node.characters = runs.map(run => run.text).join('');
    node.textAutoResize = 'NONE';
    resize(node, box.width, box.height);
    node.textAlignHorizontal = { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' }[css(styles, 'text-align')] || 'LEFT';
    node.textAlignVertical = 'TOP';
    let offset = 0;
    for (const run of runs) {
      const end = offset + run.text.length;
      if (end === offset) continue;
      const runStyles = run.css || styles;
      node.setRangeFontName(offset, end, fonts[fontStyle(runStyles)]);
      node.setRangeFontSize(offset, end, Math.max(1, number(css(runStyles, 'font-size'), 12)));
      node.setRangeFills(offset, end, [solid(css(runStyles, 'color', '#0b0d13'))].filter(Boolean));
      const lineHeight = css(runStyles, 'line-height');
      node.setRangeLineHeight(offset, end, lineHeight === 'normal' || !lineHeight ? { unit: 'AUTO' } : { unit: 'PIXELS', value: Math.max(0, number(lineHeight)) });
      node.setRangeLetterSpacing(offset, end, { unit: 'PIXELS', value: number(css(runStyles, 'letter-spacing')) });
      const decoration = css(runStyles, 'text-decoration-line');
      if (node.setRangeTextDecoration) node.setRangeTextDecoration(offset, end, /underline/.test(decoration) ? 'UNDERLINE' : /line-through/.test(decoration) ? 'STRIKETHROUGH' : 'NONE');
      offset = end;
    }
    if (singleLine) {
      node.textAutoResize = 'WIDTH_AND_HEIGHT';
      const fittedWidth = Math.max(box.width, node.width);
      node.textAutoResize = 'NONE';
      resize(node, fittedWidth, box.height);
      if (fittedWidth > box.width + 0.01) node.setPluginData('rydepro.fittedTextWidth', String(fittedWidth));
    }
    return node;
  };
  const contentBox = source => {
    const box = rect(source), styles = source.css || {};
    const edge = side => number(css(styles, `padding-${side}`)) + (/none|hidden/.test(css(styles, `border-${side}-style`, 'none')) ? 0 : number(css(styles, `border-${side}-width`)));
    const left = edge('left'), right = edge('right'), top = edge('top'), bottom = edge('bottom');
    return { x: box.x + left, y: box.y + top, width: size(box.width - left - right), height: size(box.height - top - bottom) };
  };
  const spacer = (parent, direction, distance) => {
    if (distance < 0.01) return;
    const node = frame(`Spacing · ${Math.round(distance * 100) / 100}px`, { width: direction === 'HORIZONTAL' ? distance : 0.01, height: direction === 'VERTICAL' ? distance : 0.01 });
    node.setPluginData('rydepro.layoutSpacer', 'true');
    parent.appendChild(node);
    if (direction === 'VERTICAL') node.layoutSizingHorizontal = 'FILL'; else node.layoutSizingVertical = 'FILL';
  };
  const arrange = (parent, items, box, direction, hug = false) => {
    auto(parent, direction);
    if (!items.length) return;
    const horizontal = direction === 'HORIZONTAL';
    const start = horizontal ? 'x' : 'y', extent = horizontal ? 'width' : 'height';
    const cross = horizontal ? 'y' : 'x', crossExtent = horizontal ? 'height' : 'width';
    const sorted = [...items].sort((a, b) => a.rect[start] - b.rect[start]);
    const leading = Math.max(0, sorted[0].rect[start] - box[start]);
    if (horizontal) parent.paddingLeft = leading; else parent.paddingTop = leading;
    let cursor = sorted[0].rect[start];
    for (const item of sorted) {
      const gap = item.rect[start] - cursor;
      if (gap < -EPSILON) {
        // CSS floats, negative margins, and genuine overlapping decorations are exceptions.
        parent.appendChild(item.node); item.node.layoutPositioning = 'ABSOLUTE';
        item.node.x = item.rect.x - box.x; item.node.y = item.rect.y - box.y;
        warn(`${parent.name}: an overlapping source child retained measured absolute positioning.`);
        continue;
      }
      spacer(parent, direction, Math.max(0, gap));
      const crossOffset = Math.max(0, item.rect[cross] - box[cross]);
      const crossRemainder = Math.max(0, box[crossExtent] - crossOffset - item.rect[crossExtent]);
      const wrapper = frame(`Layout · ${item.node.name}`, { width: horizontal ? item.rect.width : box.width, height: horizontal ? box.height : item.rect.height });
      auto(wrapper, horizontal ? 'VERTICAL' : 'HORIZONTAL');
      if (horizontal) { wrapper.paddingTop = crossOffset; wrapper.paddingBottom = crossRemainder; }
      else { wrapper.paddingLeft = crossOffset; wrapper.paddingRight = crossRemainder; }
      parent.appendChild(wrapper); wrapper.appendChild(item.node);
      if (horizontal) { wrapper.layoutSizingVertical = 'FILL'; item.node.layoutSizingHorizontal = 'FILL'; }
      else { wrapper.layoutSizingHorizontal = 'FILL'; item.node.layoutSizingHorizontal = 'FILL'; }
      const fittedTextWidth = number(item.node.getPluginData?.('rydepro.fittedTextWidth'));
      if (fittedTextWidth) { item.node.layoutSizingHorizontal = 'FIXED'; resize(item.node, fittedTextWidth, item.rect.height); }
      item.node.layoutSizingVertical = item.node.layoutMode === 'VERTICAL' && item.node.primaryAxisSizingMode === 'AUTO' ? 'HUG' : 'FIXED';
      cursor = Math.max(cursor, item.rect[start] + item.rect[extent]);
    }
    const trailing = Math.max(0, box[start] + box[extent] - cursor);
    if (horizontal) parent.paddingRight = trailing; else parent.paddingBottom = trailing;
    if (hug && direction === 'VERTICAL') parent.primaryAxisSizingMode = 'AUTO';
  };
  const group = (name, items, direction, fixedBox) => {
    const box = fixedBox || union(items.map(item => item.rect));
    const node = frame(name, box);
    arrange(node, items, box, direction);
    return { node, rect: box };
  };
  const gridGroups = (items, box, name) => {
    if (items.length < 2) return items;
    // Spanning grid areas (fleet assurance, table captions) split full-width bands.
    const full = items.filter(item => item.rect.width >= box.width * 0.9);
    const bands = [];
    let pending = [];
    const flush = () => {
      if (!pending.length) return;
      const bounds = union(pending.map(item => item.rect));
      const columns = cluster(pending, 'x');
      const columnsClean = columns.length > 1 && columns.every(column => Math.max(...column.map(item => item.rect.width)) - Math.min(...column.map(item => item.rect.width)) < 3)
        && columns.every((column, index) => !index || column[0].rect.x >= columns[index - 1][0].rect.x + Math.max(...columns[index - 1].map(item => item.rect.width)) - EPSILON);
      if (columnsClean) {
        const columnNodes = columns.map((column, index) => group(`Column ${index + 1} · ${name}`, column, 'VERTICAL', { x: column[0].rect.x, y: bounds.y, width: Math.max(...column.map(item => item.rect.width)), height: bounds.height }));
        bands.push(group(`Columns · ${name}`, columnNodes, 'HORIZONTAL', bounds));
      } else {
        const rows = cluster(pending, 'y');
        for (const [index, row] of rows.entries()) bands.push(row.length > 1 ? group(`Row ${index + 1} · ${name}`, row, 'HORIZONTAL') : row[0]);
      }
      pending = [];
    };
    for (const item of [...items].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)) {
      if (full.includes(item)) { flush(); bands.push(item); }
      else pending.push(item);
    }
    flush();
    return bands;
  };
  const placeAbsolute = (parent, node, childBox, parentBox) => {
    parent.appendChild(node);
    if (parent.layoutMode !== 'NONE') node.layoutPositioning = 'ABSOLUTE';
    node.x = childBox.x - parentBox.x; node.y = childBox.y - parentBox.y;
  };
  const buildPseudo = async (source, parent) => {
    const host = rect(source);
    for (const pseudo of source.pseudo || []) {
      const styles = pseudo.css || {};
      if (css(styles, 'display') === 'none') continue;
      let content = pseudo.content || css(styles, 'content');
      if (/^(none|normal)$/.test(content)) continue;
      content = content.replace(/^(["'])(.*)\1$/s, '$2').replace(/\\A\s?/g, '\n').replace(/\\(["'\\])/g, '$1');
      const width = number(css(styles, 'width')), height = number(css(styles, 'height'));
      if (!width || !height) { if (content) warn(`${parent.name}${pseudo.selector}: pseudo-element geometry is unavailable.`); continue; }
      const left = css(styles, 'left') === 'auto' ? host.width - number(css(styles, 'right')) - width : number(css(styles, 'left'));
      const top = css(styles, 'top') === 'auto' ? host.height - number(css(styles, 'bottom')) - height : number(css(styles, 'top'));
      const box = { x: host.x + left, y: host.y + top, width, height };
      const node = content ? makeText([{ text: transformedText(content, styles), css: styles }], box, styles, `${pseudo.selector} · ${content}`) : frame(`${pseudo.selector} · ${parent.name}`, box);
      if (!content) styleFrame(node, { tag: pseudo.selector, css: styles, rect: box });
      placeAbsolute(parent, node, box, host);
      if (!content && pseudo.selector === '::before') parent.insertChild(0, node);
    }
  };
  const build = async source => {
    const box = rect(source);
    if (source.type === 'TEXT') {
      const runs = textRuns(source);
      return runs.length ? { node: makeText(runs, box, source.css || {}, 'Text · ' + runs.map(run => run.text).join('').slice(0, 60), measuredSingleLine(source)), rect: box, source } : null;
    }
    if (!visible(source)) return null;
    if (source.tag === 'svg' || source.outerHTML?.startsWith('<svg')) {
      let svg = source.outerHTML || source.svg;
      if (!svg) throw new Error(`Native SVG content is missing for ${nodeName(source)}.`);
      svg = svg.replace(/currentColor/g, css(source.css, 'color', '#0b0d13'));
      const node = track(api.createNodeFromSvg(svg));
      node.name = nodeName(source); resize(node, box.width, box.height);
      node.setPluginData('rydepro.source', JSON.stringify({ tag: 'svg', id: source.id, rect: box }));
      return { node, rect: box, source };
    }
    if (source.tag === 'img') {
      const node = track(api.createRectangle());
      node.name = `Image · ${source.alt || source.id || source.assetKey || source.src}`; resize(node, box.width, box.height);
      const entry = imageCache.get(source.assetKey || source.src);
      if (!entry) throw new Error(`Missing image ${source.assetKey || source.src}`);
      node.fills = [{ type: 'IMAGE', imageHash: entry.image.hash, scaleMode: css(source.css, 'object-fit') === 'contain' ? 'FIT' : 'FILL' }];
      node.opacity = clamp(number(css(source.css, 'opacity'), 1));
      if (css(source.css, 'mix-blend-mode') === 'multiply' || source.id === 'fleet-image') node.blendMode = 'MULTIPLY';
      node.setPluginData('rydepro.asset', source.assetKey || source.src);
      return { node, rect: box, source };
    }
    const node = frame(nodeName(source), box);
    styleFrame(node, source);
    const items = [];
    const overlays = [];
    if (['input', 'select', 'textarea'].includes(source.tag)) {
      const placeholder = !source.value && source.tag !== 'select';
      const text = source.tag === 'select' ? source.displayText || source.value || '' : source.value || source.placeholder || '';
      const styles = placeholder ? { ...source.css, ...(source.placeholderCss || source.placeholderStyle) } : source.css;
      const inner = contentBox(source);
      const lineHeight = number(css(styles, 'line-height'), number(css(styles, 'font-size'), 12) * 1.2);
      const textBox = { x: inner.x, y: box.y + (box.height - lineHeight) / 2, width: Math.max(0.01, inner.width - (source.tag === 'select' ? 16 : 0)), height: lineHeight };
      if (text) items.push({ node: makeText([{ text, css: styles }], textBox, styles, `${placeholder ? 'Placeholder' : 'Value'} · ${source.id || source.tag}`, true), rect: textBox });
      if (source.tag === 'select' && css(source.css, 'appearance') !== 'none') {
        const arrowBox = { x: inner.x + inner.width - 10, y: box.y + box.height / 2 - 3, width: 8, height: 5 };
        const arrow = track(api.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" fill="none" stroke="${css(source.css, 'color', '#0b0d13')}" stroke-width="1.3"/></svg>`));
        arrow.name = 'Native select indicator'; overlays.push({ node: arrow, rect: arrowBox });
      }
      arrange(node, items, box, 'HORIZONTAL');
    } else if (isInlineTree(source)) {
      const runs = textRuns(source), inner = contentBox(source);
      if (runs.length) {
        const text = makeText(runs, inner, source.css, `Text · ${runs.map(run => run.text).join('').slice(0, 60)}`, measuredSingleLine(source));
        if (css(source.css, 'align-items') === 'center' || ['button'].includes(source.tag) || (source.classes || []).includes('button')) text.textAlignVertical = 'CENTER';
        items.push({ node: text, rect: inner });
      }
      arrange(node, items, box, 'VERTICAL');
    } else {
      // Consecutive inline siblings remain one editable rich text layer.
      let inline = [];
      const flushInline = () => {
        if (!inline.length) return;
        const synthetic = { type: 'ELEMENT', tag: 'span', css: source.css, children: inline };
        const runs = textRuns(synthetic);
        const boxes = inline.flatMap(child => child.type === 'TEXT' ? child.rects || [] : [rect(child)]);
        if (runs.length && boxes.length) { const textBox = union(boxes); items.push({ node: makeText(runs, textBox, source.css, 'Text · ' + runs.map(run => run.text).join('').slice(0, 60), measuredSingleLine(synthetic)), rect: textBox }); }
        inline = [];
      };
      for (const child of source.children || []) {
        if (child.type === 'TEXT' || (INLINE_TAGS.has(child.tag) && isInlineTree(child) && css(child.css, 'display') === 'inline')) { inline.push(child); continue; }
        flushInline();
        const item = await build(child);
        if (item) (isOverlay(child) ? overlays : items).push(item);
      }
      flushInline();
      const display = css(source.css, 'display');
      let direction = display.includes('flex') && !css(source.css, 'flex-direction').startsWith('column') ? 'HORIZONTAL' : 'VERTICAL';
      let arranged = items;
      if (display.includes('grid') || source.tag === 'tr') { arranged = gridGroups(items, contentBox(source), node.name); direction = 'VERTICAL'; }
      else if (direction === 'HORIZONTAL' && css(source.css, 'flex-wrap') === 'wrap' && cluster(items, 'y').length > 1) { arranged = cluster(items, 'y').map((row, index) => group(`Wrapped row ${index + 1} · ${node.name}`, row, 'HORIZONTAL')); direction = 'VERTICAL'; }
      else if (!display.includes('flex') && horizontalGeometry(items)) direction = 'HORIZONTAL';
      else if (!display.includes('flex') && cluster(items, 'y').some(row => row.length > 1 && horizontalGeometry(row))) { arranged = gridGroups(items, contentBox(source), node.name); direction = 'VERTICAL'; }
      arrange(node, arranged, box, direction, !['button', 'a', 'input', 'select', 'textarea'].includes(source.tag) && direction === 'VERTICAL');
    }
    for (const overlay of overlays) placeAbsolute(node, overlay.node, overlay.rect, box);
    await buildPseudo(source, node);
    if (source.tag === 'header' && css(source.css, 'position') === 'sticky') node.setPluginData('rydepro.stickyHeader', 'true');
    return { node, rect: box, source };
  };

  try {
    if (!page) { page = api.createPage(); page.name = PAGE_NAME; newPage = true; }
    await api.setCurrentPageAsync(page);
    const sectionName = snapshot.viewport.width > 700 ? 'Desktop' : 'Mobile';
    section = targetSection || page.children.find(node => node.type === 'SECTION' && node.name === sectionName && node.getPluginData?.('rydepro.section') === IMPORT_VERSION);
    if (!section) {
      section = api.createSection(); section.name = sectionName; section.setPluginData('rydepro.section', IMPORT_VERSION); newSection = true;
      page.appendChild(section);
      section.x = sectionName === 'Desktop' ? 0 : 4800; section.y = 0;
    }
    const height = snapshot.clipToViewport ? snapshot.viewport.height : snapshot.pageHeight || snapshot.viewport.height;
    const rootBox = { x: 0, y: 0, width: snapshot.viewport.width, height };
    root = frame(`${snapshot.name} · ${snapshot.viewport.width}px`, rootBox);
    root.fills = [solid(css(snapshot.bodyCss, 'background-color', '#ffffff'))].filter(Boolean);
    root.clipsContent = true;
    const flow = [], dialogs = [], fixed = [];
    for (const source of snapshot.tree) {
      const item = await build(source);
      if (!item) continue;
      if (source.id === snapshot.backdrop?.dialogId || source.tag === 'dialog') dialogs.push(item);
      else if (isOverlay(source)) fixed.push(item);
      else flow.push(item);
    }
    arrange(root, flow, rootBox, 'VERTICAL', !snapshot.clipToViewport);
    for (const item of fixed) placeAbsolute(root, item.node, item.rect, rootBox);
    if (snapshot.backdrop) {
      const backdrop = frame('Confirmation · dimmed background', snapshot.backdrop.rect || rootBox);
      styleFrame(backdrop, { tag: '::backdrop', css: snapshot.backdrop.css, rect: snapshot.backdrop.rect || rootBox });
      placeAbsolute(root, backdrop, snapshot.backdrop.rect || rootBox, rootBox);
    }
    for (const dialog of dialogs) { dialog.node.name = 'Confirmation · dialog'; placeAbsolute(root, dialog.node, dialog.rect, rootBox); }
    // Replacement is transactional: old imported frames survive any build failure.
    const otherFrames = section.children.filter(node => node !== existing && node !== root);
    const x = existing?.x ?? (otherFrames.length ? Math.max(...otherFrames.map(node => node.x + node.width)) + 120 : 60);
    section.appendChild(root); root.x = x; root.y = existing?.y ?? 80;
    root.setPluginData(SNAPSHOT_KEY, key);
    root.setPluginData('rydepro.importVersion', IMPORT_VERSION);
    root.setPluginData('rydepro.textCount', String(textCount));
    root.setPluginData('rydepro.autoLayoutCount', String(autoLayoutCount));
    root.setPluginData('rydepro.sourceUrl', snapshot.url || '');
    root.setPluginData('rydepro.capturedAt', snapshot.capturedAt || '');
    section.resizeWithoutConstraints(Math.max(targetSection ? section.width : 300, ...section.children.map(node => node.x + node.width + 60)), Math.max(targetSection ? section.height : 300, ...section.children.map(node => node.y + node.height + 60)));
    if (options.focus !== false) { page.selection = [root]; api.viewport.scrollAndZoomIntoView([root]); }
    const result = resultFor(root);
    for (const old of ownedFrames) if (!old.removed) old.remove();
    return result;
  } catch (error) {
    // Plugin-created detached nodes are removed too, not just the final frame.
    for (const node of [...created].reverse()) if (!node.removed) node.remove();
    if (newSection && section && !section.removed) section.remove();
    if (newPage && page && !page.removed) page.remove();
    throw new Error(`RYDEPRO import failed: ${error.message}. Existing imported frames were retained.`);
  }
}
