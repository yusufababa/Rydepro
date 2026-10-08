import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from '../src/driver/camera.js';

function deferred() {
  let resolve; let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function mockStream() {
  const tracks = [0, 1].map(() => ({ stops: 0, stop() { this.stops += 1; } }));
  return { tracks, getTracks: () => tracks };
}
function mockVideo(width = 3200, height = 2400) {
  return { srcObject: null, videoWidth: width, videoHeight: height, plays: 0,
    play() { this.plays += 1; return Promise.resolve(); } };
}

function installHarness(t, { automaticPermission = true } = {}) {
  const saved = new Map();
  const globals = ['document', 'navigator', 'URL', 'localStorage', 'sessionStorage'];
  globals.forEach(name => saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name)));
  const permissions = []; const canvases = []; const encodings = [];
  const created = []; const revoked = []; const storageWrites = [];
  const states = []; const errors = [];
  let video = mockVideo(); let camera;
  const urlApi = {
    createObjectURL(blob) { const url = `blob:camera-test-${created.length + 1}`; created.push({ url, blob }); return url; },
    revokeObjectURL(url) { revoked.push(url); },
  };
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const drawings = []; const labels = [];
      const context = {
        drawImage: (...args) => drawings.push(args),
        fillRect() {}, strokeRect() {}, fillText: text => labels.push(text),
      };
      const canvas = { width: 0, height: 0, drawings, labels,
        getContext(type) { assert.equal(type, '2d'); return context; },
        toBlob(callback, mimeType, quality) { encodings.push({ canvas, callback, mimeType, quality }); },
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  const navigator = { mediaDevices: {
    getUserMedia(constraints) {
      const request = deferred(); request.constraints = constraints; permissions.push(request);
      if (automaticPermission) { request.stream = mockStream(); request.resolve(request.stream); }
      return request.promise;
    },
  } };
  const storage = { setItem(...args) { storageWrites.push(args); } };
  const replacements = { document, navigator, URL: urlApi, localStorage: storage, sessionStorage: storage };
  for (const [name, value] of Object.entries(replacements)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  camera = createCamera({
    getVideo: () => video,
    onState: () => states.push(camera.context.cameraState),
    onError: message => errors.push(message),
  });
  t.after(() => {
    camera.stop();
    for (const name of globals) {
      const descriptor = saved.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { camera, permissions, canvases, encodings, created, revoked, storageWrites, states, errors, urlApi,
    get video() { return video; },
    replaceVideo(next = mockVideo()) { video = next; return next; },
    encode(index, text = 'jpeg frame') {
      const request = encodings[index];
      assert.ok(request, `encoding request ${index} exists`);
      request.callback(new Blob([text], { type: request.mimeType }));
    },
  };
}

test('stopping during a permission request disposes every late track and never attaches the stream', async t => {
  const harness = installHarness(t, { automaticPermission: false });
  const started = harness.camera.start('license.frontImage');
  assert.equal(harness.camera.context.cameraState, 'starting');
  harness.camera.stop();
  const lateStream = mockStream();
  harness.permissions[0].resolve(lateStream);
  await started;
  assert.ok(lateStream.tracks.every(track => track.stops === 1));
  assert.equal(harness.video.srcObject, null);
  assert.equal(harness.camera.context.cameraState, 'inactive');
  assert.deepEqual(harness.errors, []);
});

test('overlapping camera starts retain only the latest stream and stop superseded tracks', async t => {
  const harness = installHarness(t, { automaticPermission: false });
  const first = harness.camera.start('license.frontImage');
  const second = harness.camera.start('passport.image');
  const firstStream = mockStream(); const secondStream = mockStream();
  harness.permissions[1].resolve(secondStream); await second;
  harness.permissions[0].resolve(firstStream); await first;
  assert.equal(harness.video.srcObject, secondStream);
  assert.ok(firstStream.tracks.every(track => track.stops === 1));
  assert.ok(secondStream.tracks.every(track => track.stops === 0));
  assert.equal(harness.permissions[1].constraints.video.facingMode.ideal, 'user');
  harness.camera.stop();
  assert.ok(secondStream.tracks.every(track => track.stops === 1));
  assert.equal(harness.video.srcObject, null);
});

test('reattachment after a validation rerender keeps the live camera usable without another permission request', async t => {
  const harness = installHarness(t);
  await harness.camera.start('license.frontImage');
  const stream = harness.video.srcObject;
  const replacement = harness.replaceVideo(mockVideo(1600, 900));
  harness.camera.attach();
  assert.equal(replacement.srcObject, stream);
  assert.equal(replacement.plays, 1);
  assert.equal(harness.permissions.length, 1);
  const capturing = harness.camera.capture(); harness.encode(0); await capturing;
  assert.equal(harness.camera.context.cameraState, 'preview');
  assert.deepEqual(harness.errors, []);
});

test('an old video play rejection cannot stop a stream already attached to the replacement video', async t => {
  const harness = installHarness(t);
  const oldPlay = deferred();
  harness.video.play = () => oldPlay.promise;
  const starting = harness.camera.start('license.frontImage');
  for (let index = 0; index < 5 && harness.camera.context.cameraState !== 'live'; index += 1) await Promise.resolve();
  assert.equal(harness.camera.context.cameraState, 'live');
  const activeStream = harness.video.srcObject;
  const replacement = harness.replaceVideo();
  harness.camera.attach();
  const aborted = new Error('Old element was replaced'); aborted.name = 'AbortError';
  oldPlay.reject(aborted);
  await starting;
  assert.equal(harness.camera.context.cameraState, 'live');
  assert.equal(replacement.srcObject, activeStream);
  assert.ok(activeStream.tracks.every(track => track.stops === 0));
  assert.deepEqual(harness.errors, []);
});

test('camera captures encode JPEG with bounded dimensions, preserved proportions, and accurate metadata', async t => {
  const harness = installHarness(t);
  const cases = [
    { slot: 'license.frontImage', width: 3840, height: 2160, expected: [1600, 900] },
    { slot: 'passport.image', width: 1920, height: 2560, expected: [1000, 1333] },
    { slot: 'license.backImage', width: 640, height: 480, expected: [640, 480] },
  ];
  for (const [index, item] of cases.entries()) {
    harness.replaceVideo(mockVideo(item.width, item.height));
    await harness.camera.start(item.slot);
    const capturing = harness.camera.capture();
    const request = harness.encodings[index];
    assert.equal(request.mimeType, 'image/jpeg'); assert.equal(request.quality, .8);
    assert.deepEqual([request.canvas.width, request.canvas.height], item.expected);
    assert.deepEqual(request.canvas.drawings[0].slice(1), [0, 0, ...item.expected]);
    harness.encode(index); await capturing;
    const accepted = harness.camera.accept();
    assert.deepEqual([accepted.width, accepted.height], item.expected);
    assert.equal(accepted.mimeType, 'image/jpeg'); assert.equal(accepted.demo, false);
    assert.equal(typeof accepted.url, 'string');
    harness.urlApi.revokeObjectURL(accepted.url);
  }
  assert.ok(harness.permissions.every(request => request.stream.tracks.every(track => track.stops === 1)));
});

test('only the latest double-capture may become the preview when JPEG encoding completes out of order', async t => {
  const harness = installHarness(t);
  await harness.camera.start('license.frontImage');
  const first = harness.camera.capture();
  harness.video.videoWidth = 1600; harness.video.videoHeight = 900;
  const latest = harness.camera.capture();
  harness.encode(1, 'latest frame'); await latest;
  const latestUrl = harness.camera.context.capturePreview;
  harness.encode(0, 'older frame'); await first;
  assert.equal(harness.camera.context.capturePreview, latestUrl);
  assert.equal(harness.created.length, 1, 'discarded older frame never receives an object URL');
  assert.equal(await harness.created[0].blob.text(), 'latest frame');
  assert.equal(harness.camera.accept().height, 900);
});

test('navigation while JPEG encoding is pending discards the late result without leaking an object URL', async t => {
  const harness = installHarness(t);
  await harness.camera.start('license.frontImage');
  const capturing = harness.camera.capture();
  harness.camera.stop();
  harness.encode(0); await capturing;
  assert.equal(harness.created.length, 0);
  assert.equal(harness.camera.context.cameraState, 'inactive');
  assert.ok(harness.permissions[0].stream.tracks.every(track => track.stops === 1));
});

test('unaccepted previews are revoked, while acceptance transfers URL ownership to the application', async t => {
  const harness = installHarness(t);
  const first = harness.camera.demo('license.frontImage'); harness.encode(0); await first;
  const discardedUrl = harness.camera.context.capturePreview;
  harness.camera.stop();
  assert.deepEqual(harness.revoked, [discardedUrl]);
  const second = harness.camera.demo('license.backImage'); harness.encode(1); await second;
  const accepted = harness.camera.accept();
  harness.camera.stop();
  assert.ok(!harness.revoked.includes(accepted.url));
  assert.equal(harness.camera.accept(), null);
  harness.urlApi.revokeObjectURL(accepted.url);
  assert.deepEqual(harness.revoked, [discardedUrl, accepted.url]);
});

test('demo captures are visibly marked, expose only in-memory URL metadata, and never persist image files', async t => {
  const harness = installHarness(t);
  const creating = harness.camera.demo('passport.image');
  assert.ok(harness.canvases[0].labels.some(label => label.includes('PREVIEW ONLY')));
  assert.ok(harness.canvases[0].labels.some(label => label.includes('Demo profile photo')));
  harness.encode(0); await creating;
  const accepted = harness.camera.accept();
  assert.deepEqual(accepted, { url: harness.created[0].url, demo: true, width: 600, height: 600, mimeType: 'image/jpeg' });
  assert.deepEqual(harness.storageWrites, []);
  assert.equal(harness.permissions.length, 0);
  assert.ok(!Object.keys(harness.camera.context).some(key => /blob|file|dataURL/i.test(key)));
  harness.urlApi.revokeObjectURL(accepted.url);
});

test('declined permissions produce a recoverable denied state without an attached stream', async t => {
  const harness = installHarness(t, { automaticPermission: false });
  const started = harness.camera.start('license.frontImage');
  const error = new Error('declined'); error.name = 'NotAllowedError';
  harness.permissions[0].reject(error); await started;
  assert.equal(harness.camera.context.cameraState, 'denied');
  assert.equal(harness.video.srcObject, null);
  assert.ok(harness.errors[0].includes('declined'));
  assert.equal(harness.created.length, 0);
});
