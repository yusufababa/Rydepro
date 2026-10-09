import { readFile, writeFile } from 'node:fs/promises';
const importerURL = new URL('../design/figma/importer.js', import.meta.url);
const controllerURL = new URL('../design/figma/plugin/controller.js', import.meta.url);
const [importer, controller] = await Promise.all([readFile(importerURL, 'utf8'), readFile(controllerURL, 'utf8')]);
const bundled = importer.replace(/^export\s+(?=async\s+function\s+importRydeproSnapshot)/m, '');
if (/^export\s/m.test(bundled)) throw new Error('Unexpected importer export: update the plugin bundler.');
await writeFile(new URL('../design/figma/plugin/code.js', import.meta.url), `${bundled}\n\n${controller}`);
console.log('Built design/figma/plugin/code.js');
