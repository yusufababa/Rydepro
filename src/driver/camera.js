/** Camera capture stays in memory; no gallery upload or document storage is used. */
export function createCamera({ getVideo, onState, onError }) {
  let stream = null;
  let generation = 0;
  let frameRequest = 0;
  let state = 'inactive';
  let slot = '';
  let preview = null;

  function closeStream() {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    const video = getVideo();
    if (video) video.srcObject = null;
  }
  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    preview = null;
  }
  function update(next) { state = next; onState(); }
  function stop() {
    generation += 1;
    closeStream();
    clearPreview();
    state = 'inactive';
    slot = '';
  }
  async function start(nextSlot) {
    stop();
    slot = nextSlot;
    const request = generation;
    update('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture requires a secure browser connection.');
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextSlot === 'passport.image' ? 'user' : 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false,
      });
      if (request !== generation) { nextStream.getTracks().forEach(track => track.stop()); return; }
      stream = nextStream;
      update('live');
      const video = getVideo();
      if (!video) { stop(); return; }
      video.srcObject = stream;
      try { await video.play(); } catch (error) {
        if (request !== generation || getVideo() !== video) return;
        throw error;
      }
    } catch (error) {
      if (request !== generation) return;
      closeStream();
      update('denied');
      onError(error.name === 'NotAllowedError'
        ? 'Camera access was declined. Allow camera access in your browser, then try again, or use a marked demo image to explore the preview.'
        : 'Your camera is unavailable. Check that it is connected and not being used elsewhere, then try again. Demo images are also available for this preview.');
    }
  }
  async function storeCanvas(canvas, demo) {
    const request = generation;
    const frame = ++frameRequest;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .8));
    if (!blob || request !== generation || frame !== frameRequest) return;
    clearPreview();
    preview = { url: URL.createObjectURL(blob), demo, width: canvas.width, height: canvas.height, mimeType: blob.type };
    closeStream();
    update('preview');
  }
  async function capture() {
    const video = getVideo();
    if (state !== 'live' || !video?.videoWidth) { onError('Wait until the camera preview is ready, then capture your photo.'); return; }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, (slot === 'passport.image' ? 1000 : 1600) / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    await storeCanvas(canvas, false);
  }
  async function demo(nextSlot) {
    stop();
    slot = nextSlot;
    const canvas = document.createElement('canvas');
    canvas.width = nextSlot === 'passport.image' ? 600 : 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafaf7'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#c7a35c'; ctx.lineWidth = 2; ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#98763a'; ctx.font = '18px sans-serif'; ctx.fillText('RYDEPRO · PREVIEW ONLY', canvas.width / 2, 130);
    ctx.fillStyle = '#171813'; ctx.font = '32px sans-serif';
    const label = nextSlot === 'passport.image' ? 'Demo profile photo' : nextSlot === 'license.frontImage' ? 'Demo license front' : 'Demo license back';
    ctx.fillText(label, canvas.width / 2, 280);
    ctx.fillStyle = '#656a70'; ctx.font = '20px sans-serif';
    ctx.fillText('Replace with a clear camera capture', canvas.width / 2, 345);
    ctx.font = '16px sans-serif'; ctx.fillText('Sample image — not a document or verification', canvas.width / 2, 440);
    await storeCanvas(canvas, true);
  }
  function accept() {
    const result = preview;
    preview = null; // Ownership of the object URL transfers to the application.
    generation += 1;
    closeStream();
    state = 'inactive';
    return result;
  }
  function attach() {
    const video = getVideo();
    if (state === 'live' && stream && video && video.srcObject !== stream) {
      video.srcObject = stream;
      const request = generation;
      video.play().catch(() => {
        if (request === generation && getVideo() === video) onError('Select Open camera again if the live preview cannot resume.');
      });
    }
  }
  return { start, capture, demo, stop, accept, attach,
    get context() { return { cameraState: state, captureSlot: slot, capturePreview: preview?.url || '' }; },
  };
}
