import {
  COUNTRIES, STATES, CITIES, DEFAULT_CITIES, ROLES, SEX_OPTIONS,
  OWNERSHIP_OPTIONS, PLATE_TYPES, BUSINESS_STRUCTURES,
  AUTHORIZATION_OPTIONS, FLEET_RELATIONSHIPS,
} from './data.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const get = (state, path) => path.split('.').reduce((value, key) => value?.[key], state);
const idFor = path => `driver-${path.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
const hasRole = (state, role) => (state.roles || []).includes(role);
const errorFor = (context, path) => context.errors?.[path] || '';
const checked = value => value ? ' checked' : '';
const selected = value => value ? ' selected' : '';
const action = (name, text, style = 'outline', attributes = '') =>
  `<button type="button" class="button button-${style}" data-action="${escape(name)}" ${attributes}>${escape(text)}</button>`;

function heading(category, title, description) {
  return `<header class="driver-screen-header"><span class="eyebrow gold">${escape(category)}</span><h1>${escape(title)}</h1><p>${escape(description)}</p></header>`;
}

function note(text, title = '') {
  return `<aside class="driver-note">${title ? `<strong>${escape(title)}</strong>` : ''}<p>${escape(text)}</p></aside>`;
}

function error(path, context) {
  const message = errorFor(context, path);
  return `<p class="driver-error" id="${idFor(path)}-error"${message ? '' : ' hidden'}>${escape(message)}</p>`;
}

function field(path, label, state, context, options = {}) {
  const id = idFor(path);
  const value = options.value ?? get(state, path) ?? '';
  const message = errorFor(context, path);
  const describedBy = [options.help && `${id}-help`, message && `${id}-error`].filter(Boolean).join(' ');
  const attributes = [
    `id="${id}"`, `name="${escape(path)}"`, `data-field="${escape(path)}"`,
    `type="${escape(options.type || 'text')}"`, `value="${escape(value)}"`,
    `placeholder="${escape(options.placeholder || '')}"`,
    options.required !== false && 'required',
    options.maxLength && `maxlength="${escape(options.maxLength)}"`,
    options.inputMode && `inputmode="${escape(options.inputMode)}"`,
    options.autocomplete && `autocomplete="${escape(options.autocomplete)}"`,
    options.list && `list="${escape(options.list)}"`,
    options.min && `min="${escape(options.min)}"`,
    options.max && `max="${escape(options.max)}"`,
    options.pattern && `pattern="${escape(options.pattern)}"`,
    message && 'aria-invalid="true"',
    describedBy && `aria-describedby="${describedBy}"`,
  ].filter(Boolean).join(' ');
  const visible = context.passwordVisible instanceof Set
    ? context.passwordVisible.has(path) : Boolean(context.passwordVisible?.[path]);
  const input = `<input ${options.password ? attributes.replace(/type="[^"]*"/, `type="${visible ? 'text' : 'password'}"`) : attributes}>`;
  return `<div class="driver-field${options.full ? ' driver-field-full' : ''}${message ? ' has-error' : ''}"><label for="${id}">${escape(label)}${options.required === false ? '<span class="driver-optional">Optional</span>' : '<span class="driver-required" aria-hidden="true">*</span>'}</label>${options.password ? `<div class="driver-password-field">${input}<button type="button" class="driver-password-toggle" data-action="toggle-password" data-target="${escape(path)}" aria-label="${visible ? 'Hide' : 'Show'} ${escape(label.toLowerCase())}" aria-pressed="${visible}">${visible ? 'Hide' : 'Show'}</button></div>` : options.prefix ? `<div class="driver-input-prefix"><span>${escape(options.prefix)}</span>${input}</div>` : input}${options.help ? `<p class="driver-helper" id="${id}-help">${escape(options.help)}</p>` : ''}${error(path, context)}</div>`;
}

function selectField(path, label, choices, state, context, options = {}) {
  const id = idFor(path);
  const message = errorFor(context, path);
  const value = get(state, path) || '';
  return `<div class="driver-field${options.full ? ' driver-field-full' : ''}${message ? ' has-error' : ''}"><label for="${id}">${escape(label)}<span class="driver-required" aria-hidden="true">*</span></label><select id="${id}" name="${escape(path)}" data-field="${escape(path)}" required${message ? ` aria-invalid="true" aria-describedby="${id}-error"` : options.help ? ` aria-describedby="${id}-help"` : ''}><option value="">${escape(options.placeholder || `Select ${label.toLowerCase()}`)}</option>${choices.map(choice => {
    const item = typeof choice === 'string' ? { code: choice, name: choice } : choice;
    return `<option value="${escape(item.code)}"${selected(value === item.code)}${item.supported === false ? ' disabled' : ''}>${escape(item.name)}${item.supported === false ? ' — coming later' : ''}</option>`;
  }).join('')}</select>${options.help ? `<p class="driver-helper" id="${id}-help">${escape(options.help)}</p>` : ''}${error(path, context)}</div>`;
}

function radioGroup(path, label, choices, state, context, options = {}) {
  const message = errorFor(context, path);
  return `<fieldset class="driver-radio-group${options.full ? ' driver-field-full' : ''}"><legend>${escape(label)}<span class="driver-required" aria-hidden="true">*</span></legend><div class="driver-choices${options.columns === 3 ? ' driver-choices-three' : ''}${options.columns === 1 ? ' driver-choices-single' : ''}">${choices.map(choice => {
    const item = typeof choice === 'string' ? { value: choice, title: choice } : choice;
    return `<label class="driver-choice${get(state, path) === item.value ? ' is-selected' : ''}"><input type="radio" name="${escape(path)}" data-field="${escape(path)}" value="${escape(item.value)}"${checked(get(state, path) === item.value)} required${message ? ` aria-invalid="true" aria-describedby="${idFor(path)}-error"` : ''}><span>${escape(item.title)}</span></label>`;
  }).join('')}</div>${options.help ? `<p class="driver-helper">${escape(options.help)}</p>` : ''}${error(path, context)}</fieldset>`;
}

function passwordRequirements(state) {
  const password = state.account?.password || '';
  const requirements = [
    ['length', '8–64 characters', password.length >= 8 && password.length <= 64],
    ['uppercase', 'One uppercase letter', /[A-Z]/.test(password)],
    ['lowercase', 'One lowercase letter', /[a-z]/.test(password)],
    ['number', 'One number', /\d/.test(password)],
    ['special', 'One special character', /[^A-Za-z0-9]/.test(password)],
  ];
  return `<section class="driver-password-requirements"><h2>Password requirements</h2><ul>${requirements.map(([rule, label, met]) => `<li data-password-rule="${rule}" class="${met ? 'is-met' : ''}"><span class="driver-requirement-state" aria-hidden="true">${met ? '✓' : '—'}</span><span>${label}</span><span class="sr-only">${met ? 'Met' : 'Not yet met'}</span></li>`).join('')}</ul></section>`;
}

function safePreview(value) {
  return typeof value === 'string' && /^(blob:|data:image\/(?:png|jpeg|jpg|webp);|\/assets\/)/i.test(value) ? value : '';
}

function previewFor(path, state, context) {
  const file = context.files?.[path];
  const preview = context.captureSlot === path ? context.capturePreview : '';
  return safePreview(preview || (typeof file === 'string' ? file : file?.url || file?.previewUrl)
    || context.uploadPreview?.[path] || get(state, path));
}

function captureScreen(step, state, context) {
  const portrait = step === 'portrait';
  const front = step === 'license-front';
  const path = portrait ? 'passport.image' : `license.${front ? 'frontImage' : 'backImage'}`;
  const title = portrait ? 'Take a passport-style photo' : `Capture your license ${front ? 'front' : 'back'}`;
  const cameraState = context.cameraState || 'inactive';
  const preview = cameraState === 'live' || cameraState === 'starting' ? '' : previewFor(path, state, context);
  const accepted = Boolean(get(state, path));
  const attributes = `data-slot="${path}"`;
  const quality = portrait
    ? ['Face the camera directly, with your eyes open.', 'Use a white or navy background and even lighting.', 'No hats, sunglasses, or filters.']
    : ['Keep every edge of the license inside the frame.', 'Use clear lighting and avoid glare or shadows.', 'Make sure the text is sharp and readable.'];
  return `${heading(portrait ? 'Your profile' : 'Driver license', title, portrait ? 'This photo will be used for your driver profile shown to passengers.' : `Use your camera to capture the ${front ? 'front' : 'back'} of your driver license.`)}
    <div class="driver-capture-layout"><div class="driver-capture-panel">
      <div class="driver-camera${portrait ? ' is-portrait' : ''}${preview ? ' has-preview' : ''}" id="driver-camera">
        ${preview ? `<img class="driver-capture-preview" src="${escape(preview)}" alt="${portrait ? 'Passport-style photo preview' : `Driver license ${front ? 'front' : 'back'} preview`}">` : `<video id="driver-video" autoplay muted playsinline${cameraState === 'live' ? '' : ' hidden'}></video><div class="driver-camera-guide" aria-hidden="true"></div><div class="driver-camera-placeholder${cameraState === 'live' ? ' is-live' : ''}"><span>${portrait ? 'Your profile, professionally presented.' : 'A clear view. Every detail.'}</span><p>${cameraState === 'denied' ? 'Camera access is unavailable. Allow access in your browser, then try again.' : portrait ? 'Center your face in the frame.' : 'Align the license within the frame.'}</p></div>`}
        <canvas id="driver-canvas" hidden></canvas>
      </div>
      <div class="driver-capture-actions">${preview ? `${action('camera-retake', 'Retake', 'outline', attributes)}${action('camera-accept', accepted ? 'Keep this photo' : 'Use this photo', 'dark', attributes)}` : cameraState === 'live' ? action('camera-capture', 'Capture photo', 'dark', attributes) : action('camera-start', 'Open camera', 'dark', attributes)}${action('camera-demo', 'Use demo image', 'outline', attributes)}</div>
      ${error(path, context)}
      ${accepted ? '<p class="driver-capture-saved">Photo saved in your application preview.</p>' : ''}
    </div><aside class="driver-capture-guidance"><span class="eyebrow gold">A GOOD FIRST IMPRESSION</span><h2>${portrait ? 'Look like yourself.' : 'Make it easy to read.'}</h2><ul>${quality.map(text => `<li>${escape(text)}</li>`).join('')}</ul><p class="driver-helper">${portrait ? 'Face, background, lighting, and photo clarity are reviewed before activation.' : 'Image clarity and license details are reviewed before activation.'}</p><p class="driver-helper">Demo images are clearly marked and are only for exploring this application.</p></aside></div>`;
}

function vehicleCard(vehicle, index, state, context) {
  const base = `vehicles.${index}`;
  const title = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Vehicle details';
  return `<fieldset class="driver-repeat-card"><legend class="sr-only">Vehicle ${index + 1}</legend><div class="driver-repeat-header"><div><span class="eyebrow gold">YOUR VEHICLE</span><h2>${escape(title)}</h2><p>${escape([vehicle.ownership, vehicle.plateType && `${vehicle.plateType} plates`].filter(Boolean).join(' · '))}</p></div><div class="driver-repeat-actions">${action('toggle-vehicle', vehicle._collapsed ? 'Show details' : 'Collapse', 'outline', `data-index="${index}" aria-expanded="${!vehicle._collapsed}" aria-controls="driver-vehicle-fields-${index}"`)}${action('remove-vehicle', 'Remove', 'outline', `data-index="${index}"`)}</div></div><div id="driver-vehicle-fields-${index}" class="driver-fields"${vehicle._collapsed ? ' hidden' : ''}>
    ${radioGroup(`${base}.ownership`, 'Vehicle ownership', OWNERSHIP_OPTIONS.map(value => ({ value, title: value === 'Own' ? 'I own this vehicle' : 'I lease this vehicle' })), state, context)}
    ${radioGroup(`${base}.plateType`, 'Plate type', PLATE_TYPES, state, context, { help: 'Choose the type of plate currently issued for this vehicle.' })}
    <div class="driver-grid">${field(`${base}.make`, 'Make', state, context, { placeholder: 'e.g. Toyota', maxLength: 50 })}${field(`${base}.model`, 'Model', state, context, { placeholder: 'e.g. Camry', maxLength: 50 })}${field(`${base}.year`, 'Year', state, context, { placeholder: 'YYYY', inputMode: 'numeric', maxLength: 4 })}${field(`${base}.vin`, 'VIN', state, context, { placeholder: '17-character VIN', maxLength: 17, autocomplete: 'off' })}${selectField(`${base}.plateState`, 'License plate state', STATES, state, context)}${field(`${base}.plateNumber`, 'License plate number', state, context, { placeholder: 'e.g. ABC1234', maxLength: 10 })}</div>
    ${vehicle.ownership === 'Lease' ? `<section class="driver-subsection"><h3>Lease details</h3>${field(`${base}.lessorName`, 'Lessor name', state, context, { placeholder: 'Lessor name', maxLength: 100 })}<div class="driver-grid">${field(`${base}.leaseStart`, 'Lease start date', state, context, { type: 'date' })}${field(`${base}.leaseEnd`, 'Lease end date', state, context, { type: 'date' })}</div></section>` : ''}
    </div></fieldset>`;
}

function fleetCard(fleet, index, state, context) {
  const base = `fleets.${index}`;
  return `<fieldset class="driver-repeat-card"><legend class="sr-only">Fleet association ${index + 1}</legend><div class="driver-repeat-header"><div><span class="eyebrow gold">FLEET ASSOCIATION</span><h2>${escape(fleet.name || 'Your fleet partner')}</h2></div>${action('remove-fleet', 'Remove', 'outline', `data-index="${index}"`)}</div><div class="driver-fields"><div class="driver-grid">${field(`${base}.name`, 'Fleet name', state, context, { placeholder: 'Fleet name', maxLength: 150 })}${field(`${base}.code`, 'Fleet code / invite ID', state, context, { placeholder: 'Fleet code or invite ID', maxLength: 30 })}</div>${radioGroup(`${base}.relationship`, 'Relationship type', FLEET_RELATIONSHIPS, state, context, { columns: 1 })}${fleet.relationship === 'Other' ? field(`${base}.other`, 'Relationship description', state, context, { placeholder: 'Describe your relationship', maxLength: 100 }) : ''}</div></fieldset>`;
}

function summary(title, rows, step, context = {}) {
  return `<section class="driver-summary-card"><div class="driver-summary-header"><h2>${escape(title)}</h2>${context.noEdit ? '' : action('edit-step', 'Edit', 'outline', `data-step="${escape(step)}"`)}</div><dl class="driver-summary-rows">${rows.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd${value ? '' : ' class="is-empty"'}>${escape(value || 'Not provided')}</dd></div>`).join('')}</dl></section>`;
}

function summaryDocuments(state, context) {
  const documents = [['License front', 'license.frontImage', 'license-front'], ['License back', 'license.backImage', 'license-back'], ['Passport-style photo', 'passport.image', 'portrait']];
  return `<section class="driver-summary-card"><div class="driver-summary-header"><h2>Your photos</h2></div><div class="driver-document-grid">${documents.map(([label, path, step]) => {
    const preview = previewFor(path, state, context);
    return `<div class="driver-document-card">${preview ? `<img src="${escape(preview)}" alt="${label}" loading="lazy" decoding="async">` : `<div class="driver-document-placeholder">${get(state, path) ? 'Photo saved' : 'Photo not provided'}</div>`}<div><h3>${label}</h3>${context.noEdit ? '' : action('edit-step', 'Edit photo', 'outline', `data-step="${step}"`)}</div></div>`;
  }).join('')}</div></section>`;
}

function reviewBody(state, context, final = false) {
  const account = state.account || {};
  const jurisdiction = state.jurisdiction || {};
  const identity = state.identity || {};
  const license = state.license || {};
  const business = state.business || {};
  const result = [
    summary('Account', [['Email address', account.email], ['Email preview verified', account.emailVerified ? 'Yes' : 'No'], ['Password', account.password ? 'Configured' : 'Not configured'], ...(final ? [['Account preview created', account.createdAt ? new Date(account.createdAt).toLocaleDateString('en-US') : '']] : [])], 'account', context),
    summary('Operating location', [['Country', jurisdiction.countryName || COUNTRIES.find(item => item.code === jurisdiction.country)?.name], ['State', jurisdiction.stateName || STATES.find(item => item.code === jurisdiction.state)?.name], ['City / county', jurisdiction.city], ['ZIP code', jurisdiction.zip]], 'jurisdiction', context),
    summary('Personal identity', [['First name', identity.firstName], ['Middle initial', identity.middleInitial], ['Last name', identity.lastName], ['Date of birth', identity.dob], ['Sex', identity.sex], ['Phone number', identity.phone ? `+1 ${identity.phone}` : ''], ...(final ? [['Phone verification', 'Agent callback during inspection']] : [])], 'identity', context),
    summary('Driver license', [['License number', license.number], ['State of issue', license.stateOfIssueName || STATES.find(item => item.code === license.stateOfIssue)?.name], ['Issue date', license.issueDate], ['Expiration date', license.expirationDate], ['License front', license.frontImage ? 'Photo saved' : ''], ['License back', license.backImage ? 'Photo saved' : '']], 'license-details', context),
    summaryDocuments(state, context),
    summary('Application roles', [['Selected roles', (state.roles || []).map(id => ROLES.find(role => role.id === id)?.title || id).join(', ')], ...(final ? [['Primary role', ROLES.find(role => role.id === state.roles?.[0])?.title || '']] : [])], 'roles', context),
  ];
  if (hasRole(state, 'id') || hasRole(state, 'lb')) {
    if (!(state.vehicles || []).length) result.push(summary('Vehicles', [['Vehicles', 'None added']], 'vehicles', context));
    else state.vehicles.forEach((vehicle, index) => result.push(summary([vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || `Vehicle ${index + 1}`, [['Ownership', vehicle.ownership], ['Plate type', vehicle.plateType], ['Make', vehicle.make], ['Model', vehicle.model], ['Year', vehicle.year], ['VIN', vehicle.vin], ['License plate state', vehicle.plateStateName || STATES.find(item => item.code === vehicle.plateState)?.name], ['License plate number', vehicle.plateNumber], ...(vehicle.ownership === 'Lease' ? [['Lessor name', vehicle.lessorName], ['Lease start date', vehicle.leaseStart], ['Lease end date', vehicle.leaseEnd]] : [])], 'vehicles', context)));
  }
  if (hasRole(state, 'lb')) result.push(summary('Business information', [['Company structure', business.structure], ['Legal business name', business.legalName], ['DBA / trade name', business.dba], ['Year established', business.yearEstablished], ['EIN / registration number', business.ein], ['Primary contact name', business.contactName], ['Title / position', business.title], ['Authorized to apply', business.authorized]], 'business', context));
  if (hasRole(state, 'cl') || hasRole(state, 'w2')) {
    if (!(state.fleets || []).length) result.push(summary('Fleet associations', [['Fleet associations', 'None added']], 'fleets', context));
    else state.fleets.forEach((fleet, index) => result.push(summary(fleet.name || `Fleet association ${index + 1}`, [['Fleet name', fleet.name], ['Fleet code / invite ID', fleet.code], ['Relationship type', fleet.relationship], ...(fleet.relationship === 'Other' ? [['Relationship description', fleet.other]] : [])], 'fleets', context)));
  }
  if (final) result.push(summary('Declarations', [['Certification accepted', state.certification?.accepted ? 'Yes' : 'No'], ['Vehicle documents at this stage', 'Not required'], ['Proof of address at this stage', 'Not required'], ['SSN / TIN at this stage', 'Not collected']], 'review', context));
  return `<div class="driver-summary-list">${result.join('')}</div>`;
}

function certification(state, context) {
  return `<section class="driver-certification"><label class="driver-choice${state.certification?.accepted ? ' is-selected' : ''}"><input type="checkbox" name="certification.accepted" data-field="certification.accepted"${checked(state.certification?.accepted)} required aria-describedby="${idFor('certification.accepted')}-error"><span><strong>Certification</strong><span>By continuing, I certify the information is accurate, that I am authorized to submit this application, and that RYDEPRO may request additional information before activation.</span></span></label>${error('certification.accepted', context)}</section>`;
}

export function renderWelcome(state = {}, context = {}) {
  const draft = context.hasDraft ?? Boolean(state.account?.email || state.identity?.firstName || (state.roles || []).length);
  const progress = Math.max(0, Math.min(100, Number(context.progressPercent ?? context.progress ?? 0)));
  return `<div class="driver-welcome"><div class="driver-welcome-story"><span class="eyebrow gold">DRIVE WITH A HIGHER STANDARD</span><h1>Your next chapter.<br><span>Every journey, elevated.</span></h1><p>Bring your professionalism to a network built around reliability, care, and a better experience on every ride.</p><div class="driver-welcome-principles"><div><strong>Your application, your pace.</strong><span>Complete the details and pick up where you left off.</span></div><div><strong>Built around your role.</strong><span>Independent drivers, chauffeurs, and livery businesses.</span></div><div><strong>A clear path forward.</strong><span>Account, identity, license, and your operating details.</span></div></div></div><div class="driver-welcome-panel"><span class="eyebrow gold">BECOME A RYDEPRO PARTNER</span><h2>A good journey<br>starts here.</h2><p>Tell us about yourself and how you operate. We’ll guide you through each part.</p>${draft ? `<div class="driver-resume-card"><h3>Welcome back${state.identity?.firstName ? `, ${escape(state.identity.firstName)}` : ''}.</h3><p>Your saved application preview is ready to continue.</p><div class="driver-resume-track"><span style="width:${progress}%"></span></div><p class="driver-helper">${Math.round(progress)}% complete</p>${action('resume', 'Continue application', 'dark')}${action('reset', 'Start fresh', 'outline')}</div>` : action('start', 'Start your application', 'dark')}<p class="driver-welcome-legal">By continuing, you agree to the <a href="#footer-info" data-footer-page>Terms of Service</a> and <a href="#footer-info" data-footer-page>Privacy Policy</a>.</p><p class="driver-preview-note">Draft details stay in this browser tab. Passwords and photos are kept only while this page is open; re-enter or recapture them after reloading.</p></div></div>`;
}

export function renderScreen(stepId, state, context = {}) {
  const account = state.account || {};
  switch (stepId) {
    case 'account':
      return `${heading('Account setup', 'Create your account', 'Enter your email and create a password to begin your application.')}<div class="driver-fields">${field('account.email', 'Email address', state, context, { type: 'email', placeholder: 'you@example.com', maxLength: 254, autocomplete: 'email', help: 'This address will be used for your application updates.' })}<div class="driver-grid">${field('account.password', 'Password', state, context, { password: true, placeholder: 'Create a password', maxLength: 64, autocomplete: 'new-password' })}${field('account.confirmPassword', 'Confirm password', state, context, { password: true, placeholder: 'Confirm your password', maxLength: 64, autocomplete: 'new-password', help: 'Must match your password.' })}</div>${passwordRequirements(state)}</div>`;
    case 'email': {
      const remaining = Math.max(0, Number(context.otpRemaining) || 0);
      return `${heading('Account setup', 'Verify your email', `Confirm the address you’ll use for RYDEPRO: ${account.email || 'your email address'}.`)}<div class="driver-email-card">${field('otp', 'Verification code', state, context, { value: context.otp ?? state.otp ?? '', placeholder: '6-digit code', maxLength: 6, inputMode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}' })}<div class="driver-inline-actions">${action('resend-code', 'Resend code', 'outline', `id="driver-resend-code"${remaining ? ' disabled' : ''}`)}<span id="driver-resend-status" class="driver-helper" role="status">${remaining ? `Available in ${remaining}s` : ''}</span>${action('edit-step', 'Edit email', 'outline', 'data-step="account"')}</div>${account.emailVerified ? '<p class="driver-capture-saved">Email confirmed for this application preview.</p>' : ''}</div>${note('No email is sent in this preview. Enter any six digits.')}`;
    }
    case 'jurisdiction': {
      const cities = CITIES[state.jurisdiction?.state] || DEFAULT_CITIES;
      return `${heading('Operating location', 'Where will you operate?', 'Your location determines the local operating rules that apply to you.')}<div class="driver-fields"><div class="driver-grid">${selectField('jurisdiction.country', 'Country', COUNTRIES, state, context, { help: 'Only the United States is currently supported.' })}${selectField('jurisdiction.state', 'State', STATES, state, context)}${field('jurisdiction.city', 'City / county', state, context, { placeholder: 'Your city or county', list: 'driver-city-options', autocomplete: 'address-level2' })}${field('jurisdiction.zip', 'ZIP code', state, context, { placeholder: '5-digit ZIP', inputMode: 'numeric', maxLength: 5, autocomplete: 'postal-code', pattern: '[0-9]{5}' })}</div><datalist id="driver-city-options">${cities.map(city => `<option value="${escape(city)}"></option>`).join('')}</datalist></div>`;
    }
    case 'identity':
      return `${heading('Personal identity', 'Let’s get to know you.', 'Enter your name exactly as it appears on your government ID.')}<div class="driver-fields"><div class="driver-grid">${field('identity.firstName', 'First name', state, context, { placeholder: 'First name', maxLength: 50, autocomplete: 'given-name' })}${field('identity.lastName', 'Last name', state, context, { placeholder: 'Last name', maxLength: 50, autocomplete: 'family-name' })}${field('identity.middleInitial', 'Middle initial', state, context, { placeholder: 'M', maxLength: 1, required: false, autocomplete: 'additional-name' })}${field('identity.dob', 'Date of birth', state, context, { type: 'date', autocomplete: 'bday', help: 'You must be at least 18 years old.' })}</div>${radioGroup('identity.sex', 'Sex', SEX_OPTIONS, state, context, { columns: 3 })}${field('identity.phone', 'Phone number', state, context, { type: 'tel', placeholder: '(555) 123-4567', prefix: '+1', inputMode: 'tel', maxLength: 14, autocomplete: 'tel-national', help: 'An inspection agent will call this number during your inspection stage.' })}</div>`;
    case 'license-front':
    case 'license-back':
    case 'portrait':
      return captureScreen(stepId, state, context);
    case 'license-details':
      return `${heading('Driver license', 'Confirm your license details.', 'Check the details against your license and enter them exactly as shown.')}<div class="driver-fields"><div class="driver-grid">${field('license.number', 'License number', state, context, { placeholder: 'License number', maxLength: 15 })}${selectField('license.stateOfIssue', 'State of issue', STATES, state, context)}${field('license.issueDate', 'Issue date', state, context, { type: 'date' })}${field('license.expirationDate', 'Expiration date', state, context, { type: 'date' })}</div></div>${note('Make sure the number, issuing state, and dates match your captured license. You can edit these details before completing the application.')}`;
    case 'roles':
      return `${heading('Your role', 'How would you like to partner?', 'Select all that apply. Your selections determine the information we ask for next.')}<fieldset class="driver-role-fieldset"><legend class="sr-only">Application roles</legend><div class="driver-role-grid">${ROLES.map(role => `<label class="driver-role-card${hasRole(state, role.id) ? ' is-selected' : ''}"><input type="checkbox" name="roles" data-role value="${escape(role.id)}"${checked(hasRole(state, role.id))} aria-describedby="driver-roles-error"><span><strong>${escape(role.title)}</strong><span>${escape(role.desc)}</span></span></label>`).join('')}</div>${error('roles', context)}</fieldset>${note('Apply for more than one role if your operating arrangements overlap.')}`;
    case 'vehicles':
      return `${heading('Your vehicles', 'A fleet that reflects your standard.', 'List every vehicle you will use for RYDEPRO. No vehicle documents are required at this stage.')}<div class="driver-repeat-list">${(state.vehicles || []).length ? state.vehicles.map((vehicle, index) => vehicleCard(vehicle, index, state, context)).join('') : '<div class="driver-empty-state"><h2>Your first vehicle starts here.</h2><p>Add a vehicle to enter its ownership, registration, and operating details.</p></div>'}</div>${error('vehicles', context)}<div class="driver-add-action">${action('add-vehicle', (state.vehicles || []).length ? 'Add another vehicle' : 'Add your first vehicle', 'outline')}</div>${note('You can add as many vehicles as you need. Choose the plate type for each one; vehicle documents come at a later stage.')}`;
    case 'business':
      return `${heading('Your business', 'Built for the way you operate.', 'Tell us about your livery business. No business license upload is required at this stage.')}<div class="driver-fields">${radioGroup('business.structure', 'Company structure', BUSINESS_STRUCTURES, state, context)}${field('business.legalName', 'Legal business name', state, context, { placeholder: 'Legal business name', maxLength: 150 })}${field('business.dba', 'DBA / trade name', state, context, { placeholder: 'DBA or trade name', maxLength: 150, required: false })}<div class="driver-grid">${field('business.yearEstablished', 'Year established', state, context, { placeholder: 'YYYY', inputMode: 'numeric', maxLength: 4 })}${field('business.ein', 'EIN / business registration number', state, context, { placeholder: 'EIN or registration number', maxLength: 30 })}</div><section class="driver-subsection"><h2>Primary contact</h2><div class="driver-grid">${field('business.contactName', 'Primary contact name', state, context, { placeholder: 'Full name', maxLength: 100, autocomplete: 'name' })}${field('business.title', 'Title / position', state, context, { placeholder: 'Title or position', maxLength: 100, autocomplete: 'organization-title' })}</div>${radioGroup('business.authorized', 'Are you authorized to complete this application on behalf of the company?', AUTHORIZATION_OPTIONS, state, context)}</section></div>`;
    case 'fleets':
      return `${heading('Fleet association', 'Tell us about your fleet partner.', 'Add the fleet you are associated with and the relationship under which you operate.')}<div class="driver-repeat-list">${(state.fleets || []).length ? state.fleets.map((fleet, index) => fleetCard(fleet, index, state, context)).join('') : '<div class="driver-empty-state"><h2>Your operating network.</h2><p>Add your fleet association to continue.</p></div>'}</div>${error('fleets', context)}<div class="driver-add-action">${action('add-fleet', (state.fleets || []).length ? 'Add another association' : 'Add fleet association', 'outline')}</div>`;
    case 'review':
      return `${heading('Application review', 'Every detail, in one place.', 'Review your information before continuing. You can edit any section below.')}${reviewBody(state, context)}${certification(state, context)}`;
    case 'final': {
      const missing = context.missing || [];
      return `${heading('Final review', 'Ready for the next chapter?', 'This is your complete application preview. Check your information and declarations one final time.')}${missing.length ? note('Some required information still needs attention. Use Edit to complete the relevant sections.', 'A little more to complete.') : note('Your information is ready for your final review. Completing this preview saves your progress on this device; it does not send an application.', 'Take one final look.')}${reviewBody(state, context, true)}`;
    }
    case 'received':
      return `${heading('Application preview', 'Your application preview is complete.', 'Download a summary for your records while this page is open. Your draft details are saved in this browser tab; passwords and photos are excluded. No application has been sent to RYDEPRO.')}<div class="driver-received-status"><span>PREVIEW COMPLETE</span><p>Ready for a connected application service.</p></div><section class="driver-next-stages"><h2>What happens after a live application</h2><ol>${[['Application review', 'RYDEPRO reviews the information you provide.'], ['Requirements determination', 'Documentation requirements are determined for your operating locations.'], ['Documentation request', 'Any additional required documents are requested through your account.'], ['Vehicle & chauffeur review', 'Where applicable, vehicles and chauffeurs proceed through verification and inspection.'], ['Activation', 'Activation follows once the applicable requirements have been satisfied.']].map(([title, description]) => `<li><strong>${title}</strong><p>${description}</p></li>`).join('')}</ol></section><div class="driver-received-actions">${action('view-status', 'View status', 'dark')}<a class="button button-outline" href="mailto:support@rydepro.com">Contact support</a>${action('download-summary', 'Download summary', 'outline')}${action('print-summary', 'Print summary', 'outline')}</div>`;
    default:
      return renderWelcome(state, context);
  }
}

export { escape as escapeHTML };
