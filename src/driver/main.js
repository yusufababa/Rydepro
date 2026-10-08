import { STEPS, CAPTURE_PATHS, DEMO_EMAIL_RESEND_SECONDS } from './data.js';
import {
  createState, createVehicle, createFleet, normalizeField, formatPhone,
  passwordRequirements, isDemoEmailCode, validateStep, isStepComplete,
  progress, visibleStepIds, checkPrerequisites, invalidateAfterChange, serializeDraft,
} from './model.js';
import { resolveStep, nextStep, previousStep, milestoneProgress } from './flow.js';
import { renderWelcome, renderScreen, escapeHTML } from './views.js';
import { createCamera } from './camera.js';
import { createApplicationSummary } from './summary.js';

const DRAFT_KEY = 'rydepro.driver.draft.v1';
const $ = selector => document.querySelector(selector);
const intro = $('#driver-intro');
const workspace = $('#driver-workspace');
const screen = $('#driver-screen');
const form = $('#driver-form');
const actions = $('#driver-actions');
const progressElement = $('#driver-progress');
const errorSummary = $('#driver-error-summary');
const status = $('#driver-status');
const dialog = $('#driver-dialog');
const titles = Object.fromEntries(STEPS.map(step => [step.id, step.title]));
Object.assign(titles, { jurisdiction: 'Operating location', portrait: 'Profile photo', review: 'Review', final: 'Final checklist', received: 'Preview complete' });
let state = createState();
let current = null;
let errors = {};
let otp = '';
let resendAt = 0;
let saveTimer;
let returnToReview = false;
let dialogCallback = null;
let dialogOpener = null;
let storageAvailable = true;
const files = {};
const captureMetadata = {};
const passwordVisible = new Set();

try {
  const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
  if (saved?.version === 1) state = createState(serializeDraft(saved.state));
} catch { storageAvailable = false; }

const camera = createCamera({
  getVideo: () => $('#driver-video'),
  onState: () => { if (capturePath()) renderPage(false); },
  onError: message => announce(message),
});

function capturePath() {
  return { 'license-front': 'license.frontImage', 'license-back': 'license.backImage', portrait: 'passport.image' }[current];
}
function getPath(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }
function setPath(object, path, value) {
  const parts = path.split('.');
  const key = parts.pop();
  const parent = parts.reduce((value, part) => value?.[part], object);
  if (parent && Object.hasOwn(parent, key)) parent[key] = value;
}
function announce(message) { status.textContent = message; }
function hasDraft() { return Boolean(state.account.email || state.identity.firstName || state.roles.length); }
function saveDraft({ quiet = false } = {}) {
  clearTimeout(saveTimer);
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, state: serializeDraft(state) }));
    storageAvailable = true;
    if (!quiet) announce('Progress saved in this browser tab. Passwords and photos stay in memory; re-enter or recapture them after reloading.');
  } catch {
    storageAvailable = false;
    announce('Browser storage is unavailable. Keep this page open to preserve your progress, or download a summary after completing the preview.');
  }
  updateSaveLabel();
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDraft({ quiet: true }), 450);
}
function updateSaveLabel() {
  const label = $('#driver-save-state');
  if (label) {
    label.textContent = storageAvailable ? 'Draft saved in this tab' : 'Progress in memory only';
    label.dataset.state = storageAvailable ? 'saved' : 'error';
  }
}
function context(extra = {}) {
  return { errors, files, passwordVisible, otp, otpRemaining: Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)), ...camera.context, ...extra };
}
function putHash(step, replace = false) {
  const url = `${location.pathname}${location.search}${step ? `#${step}` : ''}`;
  if (`${location.pathname}${location.search}${location.hash}` !== url) history[replace ? 'replaceState' : 'pushState'](null, '', url);
}
function focusHeading() {
  const heading = (current ? screen : intro).querySelector('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    (current ? progressElement : intro).scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}
function showWelcome({ replace = false } = {}) {
  saveDraft({ quiet: true });
  camera.stop();
  current = null;
  errors = {};
  intro.hidden = false;
  workspace.hidden = true;
  intro.innerHTML = renderWelcome(state, { hasDraft: hasDraft(), progressPercent: progress(state, files).percent });
  putHash(null, replace);
  document.title = 'Drive with RYDEPRO';
}
function go(requested, { replace = false, focus = true } = {}) {
  camera.stop();
  const step = resolveStep(requested, state, files);
  if (requested !== step) announce('Complete the required information first. Your other details are still saved.');
  current = step;
  state.lastStep = step;
  errors = {};
  if (step === 'vehicles' && !state.vehicles.length) state.vehicles.push(createVehicle());
  if (step === 'fleets' && !state.fleets.length) state.fleets.push(createFleet());
  intro.hidden = true;
  workspace.hidden = false;
  putHash(step, replace || requested !== step);
  renderPage(focus);
  saveDraft({ quiet: true });
  document.title = `${titles[step]} — RYDEPRO`;
}
function renderProgress() {
  const expanded = progressElement.querySelector('details')?.open;
  const value = progress(state, files);
  const canGo = id => checkPrerequisites(id, state, files).allowed;
  const milestones = milestoneProgress(state, files);
  const completed = new Set(value.completed);
  const navigation = milestones.map(item => {
    const active = item.steps.includes(current);
    return `<button type="button" data-action="navigate" data-step="${item.target}" data-state="${active ? 'current' : item.complete ? 'complete' : 'pending'}"${active ? ' aria-current="step"' : ''}${canGo(item.target) ? '' : ' disabled'}>${item.complete ? '<span aria-hidden="true">✓</span><span class="sr-only">Completed: </span>' : ''}${escapeHTML(item.label)}</button>`;
  }).join('');
  const pages = value.required.map(id => `<button type="button" data-action="navigate" data-step="${id}" title="${escapeHTML(titles[id])}" class="${completed.has(id) ? 'is-complete' : ''}"${current === id ? ' aria-current="step"' : ''}${canGo(id) ? '' : ' disabled'}>${completed.has(id) ? '<span class="step-state" aria-hidden="true">✓</span><span class="sr-only">Completed: </span>' : ''}${escapeHTML(titles[id])}</button>`).join('');
  progressElement.innerHTML = `<div class="driver-progress-top"><strong>${current === 'received' ? 'Application preview complete' : escapeHTML(titles[current])}</strong><span>${value.complete} of ${value.total} pages complete</span></div><div class="driver-progress-track" role="progressbar" aria-label="Application completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value.percent}"><span style="width:${value.percent}%"></span></div><nav class="driver-milestones" aria-label="Application milestones">${navigation}</nav><details class="driver-progress-details"${expanded ? ' open' : ''}><summary>View application pages</summary><nav class="driver-step-list" aria-label="Application pages">${pages}</nav></details>`;
}
function renderActions() {
  const previous = previousStep(current, state);
  const label = current === 'account' ? 'Create account & continue' : current === 'email' ? 'Verify & continue' : current === 'review' ? 'Continue to final review' : current === 'final' ? 'Complete application preview' : returnToReview ? 'Save & return to review' : 'Continue';
  actions.innerHTML = `<div class="driver-actions-left">${previous && current !== 'received' ? '<button type="button" class="button button-outline" data-action="back">Back</button>' : ''}<button type="button" class="button button-outline" data-action="save-exit">${current === 'received' ? 'Back to application home' : 'Save & exit'}</button></div><div class="driver-actions-right"><span class="driver-save-state" id="driver-save-state"></span>${current !== 'received' ? `<button type="submit" class="button button-dark">${label}</button>` : '<button type="button" class="button button-dark" data-action="review-complete">View your details</button>'}</div>`;
  updateSaveLabel();
}
function renderPage(focus = false) {
  if (!current) return;
  screen.innerHTML = renderScreen(current, state, context());
  camera.attach();
  renderProgress();
  renderActions();
  renderErrors();
  if (focus) focusHeading();
}
function stepForPath(path) {
  if (CAPTURE_PATHS.includes(path)) return { 'license.frontImage': 'license-front', 'license.backImage': 'license-back', 'passport.image': 'portrait' }[path];
  if (path === 'account.emailVerified' || path === 'otp') return 'email';
  return { account: 'account', jurisdiction: 'jurisdiction', identity: 'identity', license: 'license-details', roles: 'roles', vehicles: 'vehicles', business: 'business', fleets: 'fleets', certification: 'review', submitted: 'final' }[path.split('.')[0]] || current;
}
function fieldFor(path) { return [...screen.querySelectorAll('[data-field]')].find(element => element.dataset.field === path); }
function fieldErrorId(path) { return `driver-${path.replace(/[^a-zA-Z0-9_-]/g, '-')}-error`; }
function renderErrors() {
  for (const element of screen.querySelectorAll('[data-field]')) {
    const path = element.dataset.field;
    const message = errors[path];
    element.closest('.driver-field')?.classList.toggle('has-error', Boolean(message));
    if (message) {
      element.setAttribute('aria-invalid', 'true');
      const described = (element.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      element.setAttribute('aria-describedby', [...new Set([...described, fieldErrorId(path)])].join(' '));
    } else {
      element.removeAttribute('aria-invalid');
      const described = (element.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== fieldErrorId(path));
      if (described.length) element.setAttribute('aria-describedby', described.join(' '));
      else element.removeAttribute('aria-describedby');
    }
  }
  for (const element of screen.querySelectorAll('.driver-error')) {
    const path = Object.keys(errors).find(key => fieldErrorId(key) === element.id);
    element.textContent = path ? errors[path] : '';
    element.hidden = !path;
  }
  const entries = Object.entries(errors);
  errorSummary.hidden = !entries.length;
  if (entries.length) errorSummary.innerHTML = `<h2>A few details need attention</h2><ul>${entries.map(([path, message]) => `<li><a href="#${current}" data-error-field="${escapeHTML(path)}">${escapeHTML(message)} <span>(${escapeHTML(titles[stepForPath(path)])})</span></a></li>`).join('')}</ul>`;
}
function showErrors(nextErrors) {
  errors = nextErrors;
  // Make invalid fields visible even if the user collapsed a vehicle card.
  for (const path of Object.keys(errors)) {
    const match = path.match(/^vehicles\.(\d+)\./);
    if (match && state.vehicles[Number(match[1])]) state.vehicles[Number(match[1])]._collapsed = false;
  }
  renderPage();
  errorSummary.focus({ preventScroll: true });
  errorSummary.scrollIntoView({ behavior: 'auto', block: 'start' });
}
function applyField(element) {
  const path = element.dataset.field;
  if (!path || (element.type === 'radio' && !element.checked)) return;
  if (path === 'otp') { otp = element.value.replace(/\D/g, '').slice(0, 6); element.value = otp; delete errors.otp; return; }
  const raw = element.type === 'checkbox' ? element.checked : element.value;
  const value = typeof raw === 'boolean' ? raw : normalizeField(path, raw);
  if (getPath(state, path) === value) return;
  const draft = createState(state);
  setPath(draft, path, value);
  state = invalidateAfterChange(state, draft, [path]);
  if (path === 'account.email') otp = '';
  if (typeof value === 'string' && element.value !== value) element.value = value;
  delete errors[path];
}
function syncFields() {
  for (const element of screen.querySelectorAll('[data-field]')) applyField(element);
}
function refreshPasswordRules() {
  for (const [rule, met] of Object.entries(passwordRequirements(state.account.password))) {
    const item = screen.querySelector(`[data-password-rule="${rule}"]`);
    if (!item) continue;
    item.classList.toggle('is-met', met);
    item.querySelector('.driver-requirement-state').textContent = met ? '✓' : '—';
    item.querySelector('.sr-only').textContent = met ? 'Met' : 'Not yet met';
  }
}
function updateField(event) {
  const element = event.target;
  if (!element.matches('[data-field]')) return;
  const path = element.dataset.field;
  applyField(element);
  for (const choice of screen.querySelectorAll('.driver-choice')) choice.classList.toggle('is-selected', Boolean(choice.querySelector('input')?.checked));
  if (path.startsWith('account.password')) refreshPasswordRules();
  renderErrors();
  renderProgress();
  scheduleSave();
  if (event.type === 'change') {
    if (path === 'identity.phone') element.value = formatPhone(state.identity.phone);
    if (/^jurisdiction\.(country|state)$/.test(path) || /^vehicles\.\d+\.ownership$/.test(path) || /^fleets\.\d+\.relationship$/.test(path)) {
      renderPage();
      fieldFor(path)?.focus({ preventScroll: true });
    }
  }
}
function continueApplication(event) {
  event.preventDefault();
  if (!current || current === 'received') return;
  syncFields();
  if (current === 'email' && !state.account.emailVerified) {
    if (!isDemoEmailCode(otp)) { showErrors({ otp: 'Enter a six-digit code to continue the email preview.' }); return; }
    state.account.emailVerified = true;
  }
  const validation = validateStep(current, state, files);
  if (!validation.valid) { showErrors(validation.errors); return; }
  if (current === 'account') {
    state.account.createdAt ||= Date.now();
    if (!state.account.emailVerified) resendAt = Date.now() + DEMO_EMAIL_RESEND_SECONDS * 1000;
  }
  if (current === 'final') {
    state.submitted = true;
    state.submittedAt = Date.now();
    announce('Application preview complete. No application was sent. You can download or print your summary.');
    go('received');
    return;
  }
  if (returnToReview && !['email', 'review', 'final'].includes(current)) {
    const destination = resolveStep('review', state, files);
    if (destination === 'review') { returnToReview = false; go('review'); return; }
  }
  const next = nextStep(current, state);
  if (returnToReview && current === 'email' && resolveStep('review', state, files) === 'review') {
    returnToReview = false; go('review'); return;
  }
  go(next || 'review');
}
function openDialog(title, message, confirmLabel = 'Continue', callback = null) {
  dialogOpener = document.activeElement;
  dialogCallback = callback;
  $('#driver-dialog-title').textContent = title;
  $('#driver-dialog-message').textContent = message;
  $('#driver-dialog-confirm').textContent = confirmLabel;
  dialog.querySelector('[data-action="dialog-cancel"]').hidden = !callback;
  dialog.showModal();
}
function clearFiles() {
  for (const path of Object.keys(files)) { URL.revokeObjectURL(files[path]); delete files[path]; delete captureMetadata[path]; }
}
function acceptPhoto(path) {
  if (path !== capturePath()) return;
  const photo = camera.accept();
  if (photo) {
    if (files[path]) URL.revokeObjectURL(files[path]);
    files[path] = photo.url;
    captureMetadata[path] = { demo: photo.demo, width: photo.width, height: photo.height, mimeType: photo.mimeType };
    const draft = createState(state);
    setPath(draft, path, photo.url);
    state = invalidateAfterChange(state, draft, [path]);
    scheduleSave();
  }
  if (isStepComplete(current, state, files)) continueApplication({ preventDefault() {} });
}
function downloadSummary() {
  const content = JSON.stringify(createApplicationSummary(state, captureMetadata), null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'rydepro-driver-application-preview.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Your application summary was downloaded. It excludes passwords and photo files.');
}
function printSummary() {
  const previousHTML = screen.innerHTML;
  screen.innerHTML = renderScreen('final', state, context({ noEdit: true }));
  const restore = () => { screen.innerHTML = previousHTML; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore, { once: true });
  try { window.print(); } finally { restore(); }
}

form.addEventListener('submit', continueApplication);
form.addEventListener('input', updateField);
form.addEventListener('change', event => {
  const element = event.target;
  if (element.matches('[data-role]')) {
    const draft = createState(state);
    draft.roles = element.checked ? [...new Set([...draft.roles, element.value])] : draft.roles.filter(role => role !== element.value);
    state = invalidateAfterChange(state, draft, ['roles']);
    element.closest('.driver-role-card').classList.toggle('is-selected', element.checked);
    delete errors.roles;
    renderErrors(); renderProgress(); scheduleSave();
  } else updateField(event);
});

document.addEventListener('click', async event => {
  const footerLink = event.target.closest('[data-footer-page]');
  if (footerLink) {
    event.preventDefault(); $('#footer-info-title').textContent = footerLink.textContent; footerInfo.showModal(); return;
  }
  const errorLink = event.target.closest('[data-error-field]');
  if (errorLink) {
    event.preventDefault();
    const path = errorLink.dataset.errorField;
    if (stepForPath(path) !== current) go(stepForPath(path));
    const target = fieldFor(path) || document.getElementById(fieldErrorId(path)) || screen.querySelector('h1');
    if (target) { target.tabIndex = target.tabIndex < 0 ? -1 : target.tabIndex; target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'center' }); }
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (['start', 'resume'].includes(action)) { returnToReview = false; go(action === 'start' ? 'account' : state.lastStep); }
  else if (action === 'navigate') { returnToReview = false; go(button.dataset.step); }
  else if (action === 'back') { returnToReview = false; go(previousStep(current, state) || 'account'); }
  else if (action === 'save-exit') { showWelcome(); focusHeading(); announce('Your draft is saved in this tab. Passwords and photos must be re-entered after reloading.'); }
  else if (action === 'reset') openDialog('Start a fresh application?', 'This clears your current application preview, including saved details and photos.', 'Start fresh', () => {
    camera.stop(); clearFiles(); clearTimeout(saveTimer); state = createState(); otp = ''; returnToReview = false; passwordVisible.clear();
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Memory remains usable. */ }
    go('account'); announce('A fresh application is ready.');
  });
  else if (action === 'edit-step') { returnToReview = ['review', 'final'].includes(current); go(button.dataset.step); }
  else if (action === 'toggle-password') {
    const path = button.dataset.target;
    const input = fieldFor(path);
    if (!input) return;
    const visible = !passwordVisible.has(path);
    if (visible) passwordVisible.add(path); else passwordVisible.delete(path);
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show'; button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${path.endsWith('confirmPassword') ? 'confirm password' : 'password'}`);
  } else if (action === 'resend-code') {
    if (Date.now() < resendAt) return;
    resendAt = Date.now() + DEMO_EMAIL_RESEND_SECONDS * 1000;
    otp = ''; const input = fieldFor('otp'); if (input) { input.value = ''; input.focus(); }
    announce('A new code was simulated. Enter any six digits; no email is sent in this preview.'); updateResend();
  } else if (action === 'add-vehicle' || action === 'add-fleet') {
    syncFields(); const draft = createState(state);
    const section = action === 'add-vehicle' ? 'vehicles' : 'fleets';
    draft[section].push(section === 'vehicles' ? createVehicle() : createFleet());
    state = invalidateAfterChange(state, draft, [section]); errors = {}; renderPage(); scheduleSave();
    fieldFor(`${section}.${draft[section].length - 1}.${section === 'vehicles' ? 'make' : 'name'}`)?.focus();
  } else if (action === 'toggle-vehicle') {
    const index = Number(button.dataset.index);
    if (state.vehicles[index]) { syncFields(); state.vehicles[index]._collapsed = !state.vehicles[index]._collapsed; renderPage(); scheduleSave(); screen.querySelector(`[data-action="toggle-vehicle"][data-index="${index}"]`)?.focus({ preventScroll: true }); }
  } else if (action === 'remove-vehicle' || action === 'remove-fleet') {
    const section = action === 'remove-vehicle' ? 'vehicles' : 'fleets'; const index = Number(button.dataset.index);
    if (!state[section][index]) return;
    openDialog(section === 'vehicles' ? 'Remove this vehicle?' : 'Remove this fleet association?', 'The details for this entry will be removed from your application preview.', 'Remove entry', () => {
      const draft = createState(state); draft[section].splice(index, 1);
      state = invalidateAfterChange(state, draft, [section]); errors = {}; renderPage(); scheduleSave();
    });
  } else if (action === 'camera-start' || action === 'camera-retake') await camera.start(button.dataset.slot);
  else if (action === 'camera-capture') await camera.capture();
  else if (action === 'camera-demo') await camera.demo(button.dataset.slot);
  else if (action === 'camera-accept') acceptPhoto(button.dataset.slot);
  else if (action === 'review-complete') go('final');
  else if (action === 'view-status') openDialog('Preview complete', 'You have completed the application preview. No application has been sent, and verification has not started. A connected application service is required for live processing.', 'Close');
  else if (action === 'download-summary') downloadSummary();
  else if (action === 'print-summary') printSummary();
  else if (action === 'dialog-cancel') dialog.close();
  else if (action === 'dialog-confirm') { const callback = dialogCallback; dialogCallback = null; dialog.close(); callback?.(); }
});

dialog.addEventListener('close', () => { dialogCallback = null; if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true }); });
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
function updateResend() {
  if (current !== 'email') return;
  const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  const button = $('#driver-resend-code'); const message = $('#driver-resend-status');
  if (button) button.disabled = remaining > 0;
  if (message) message.textContent = remaining ? `Available in ${remaining}s` : 'You can request another preview code.';
}
setInterval(updateResend, 1000);
window.addEventListener('hashchange', () => {
  const requested = location.hash.slice(1);
  returnToReview = false;
  if (requested) go(requested, { replace: true }); else showWelcome({ replace: true });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { camera.stop(); saveDraft({ quiet: true }); if (capturePath()) renderPage(); }
});
window.addEventListener('pagehide', () => { camera.stop(); saveDraft({ quiet: true }); clearFiles(); });
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    for (const path of CAPTURE_PATHS) setPath(state, path, null);
    state.certification.accepted = false; state.submitted = false; state.submittedAt = null;
    if (current) go(current, { replace: true, focus: false }); else showWelcome({ replace: true });
  }
});

// Shared site chrome uses the same HTML fragments as the landing page.
$('#year').textContent = new Date().getFullYear();
document.querySelectorAll('[data-waitlist]').forEach(button => button.addEventListener('click', () => { saveDraft({ quiet: true }); location.href = '/#waitlist'; }));
const footerInfo = $('#footer-info');
$('#close-footer-info').addEventListener('click', () => footerInfo.close());
footerInfo.addEventListener('click', event => { if (event.target === footerInfo) footerInfo.close(); });
if (location.hash) go(location.hash.slice(1), { replace: true, focus: false });
else showWelcome({ replace: true });
