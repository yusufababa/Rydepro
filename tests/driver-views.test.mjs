import test from 'node:test';
import assert from 'node:assert/strict';
import { renderScreen, renderWelcome } from '../src/driver/views.js';
import { createState, createVehicle, createFleet } from '../src/driver/model.js';

// Independent source contract: these names and choices come from the supplied demo,
// not from the renderer's option arrays. Credential/draft validation is tested separately.
function application(roles = ['w2', 'id', 'cl', 'lb']) {
  return createState({
    account: { email: 'review@example.com', password: 'PrivateExample1!', confirmPassword: 'PrivateExample1!', emailVerified: true, createdAt: 1791403200000 },
    jurisdiction: { country: 'US', state: 'CA', city: 'Los Angeles County', zip: '90001' },
    identity: { firstName: 'Jane', middleInitial: 'A', lastName: 'Doe', dob: '1990-01-15', sex: 'Female', phone: '5551234567' },
    license: { frontImage: '/assets/driver/example-front.png', backImage: '/assets/driver/example-back.png', number: 'D1234567', stateOfIssue: 'CA', issueDate: '2020-01-01', expirationDate: '2030-01-01' },
    passport: { image: '/assets/driver/example-portrait.png' },
    roles,
    vehicles: [
      createVehicle({ ownership: 'Lease', plateType: 'Commercial', make: 'Lincoln', model: 'Navigator', year: '2023', vin: '1HGBH41JXMN109186', plateState: 'CA', plateNumber: 'LEASE123', lessorName: 'Westside Leasing Partners', leaseStart: '2024-02-01', leaseEnd: '2027-02-01' }),
      createVehicle({ ownership: 'Own', plateType: 'Regular', make: 'Toyota', model: 'Camry', year: '2022', vin: '2LNHM82W83Y612345', plateState: 'NY', plateNumber: 'OWN123' }),
    ],
    business: { structure: 'LLC', legalName: 'Professional Livery LLC', dba: 'City Journeys', yearEstablished: '2018', ein: '12-3456789', contactName: 'Jane A Doe', title: 'Managing Member', authorized: 'Yes' },
    fleets: [
      createFleet({ name: 'Metropolitan Fleet', code: 'FLT-88291', relationship: 'Other', other: 'Temporary partner operating agreement' }),
      createFleet({ name: 'Employer Fleet', code: 'W2-SECOND', relationship: 'W2 employee of fleet' }),
    ],
    certification: { accepted: true },
  });
}

function controls(html) {
  return [...html.matchAll(/<(input|select)\b[^>]*>/g)].map(([tag, kind]) => ({
    tag, kind, name: tag.match(/\bname="([^"]+)"/)?.[1], value: tag.match(/\bvalue="([^"]*)"/)?.[1],
  }));
}
function fieldNames(html) {
  return [...new Set(controls(html).filter(control => /\bdata-field=/.test(control.tag)).map(control => control.name))];
}
function control(html, name) {
  const found = controls(html).find(item => item.name === name);
  assert.ok(found, `Missing reference field: ${name}`);
  return found.tag;
}
function choices(html, name) {
  return controls(html).filter(item => item.name === name).map(item => item.value);
}
function hasAction(html, action) { assert.match(html, new RegExp(`data-action="${action}"`)); }

test('account and identity screens expose the reference questions with their optional boundaries', () => {
  const state = application();
  const account = renderScreen('account', state);
  assert.deepEqual(fieldNames(account), ['account.email', 'account.password', 'account.confirmPassword']);
  assert.match(control(account, 'account.email'), /type="email"/);
  assert.match(control(account, 'account.email'), /maxlength="254"/);
  for (const name of ['account.password', 'account.confirmPassword']) {
    assert.match(control(account, name), /type="password"/);
    assert.match(control(account, name), /maxlength="64"/);
  }
  assert.equal((account.match(/data-password-rule=/g) || []).length, 5);
  const revealed = renderScreen('account', state, { passwordVisible: new Set(['account.password']) });
  assert.match(control(revealed, 'account.password'), /type="text"/);
  assert.match(control(revealed, 'account.confirmPassword'), /type="password"/);

  const identity = renderScreen('identity', state);
  assert.deepEqual(new Set(fieldNames(identity)), new Set(['identity.firstName', 'identity.middleInitial', 'identity.lastName', 'identity.dob', 'identity.sex', 'identity.phone']));
  assert.deepEqual(choices(identity, 'identity.sex'), ['Male', 'Female', 'Other']);
  assert.doesNotMatch(control(identity, 'identity.middleInitial'), /\brequired\b/);
  assert.match(control(identity, 'identity.middleInitial'), /maxlength="1"/);
  assert.match(control(identity, 'identity.phone'), /maxlength="14"/);
  assert.match(identity, /at least 18 years old/);
  assert.match(identity, /inspection agent will call/i);
});

test('jurisdiction and role controls retain supplied choices while blocking unsupported countries', () => {
  const state = application();
  const html = renderScreen('jurisdiction', state);
  assert.deepEqual(fieldNames(html), ['jurisdiction.country', 'jurisdiction.state', 'jurisdiction.city', 'jurisdiction.zip']);
  const country = html.match(/<select[^>]*name="jurisdiction\.country"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(country);
  assert.match(country, /<option value="US"[^>]*>United States<\/option>/);
  for (const code of ['CA', 'GB', 'AU', 'MX']) assert.match(country, new RegExp(`<option value="${code}"[^>]*\\bdisabled\\b`));
  const states = html.match(/<select[^>]*name="jurisdiction\.state"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.equal((states.match(/<option value="[A-Z]{2}"/g) || []).length, 51);
  assert.match(states, /District of Columbia/);
  assert.match(html, /<option value="Los Angeles County">/);
  assert.match(control(html, 'jurisdiction.zip'), /pattern="\[0-9\]\{5\}"/);
  const roles = renderScreen('roles', state);
  assert.deepEqual(choices(roles, 'roles'), ['id', 'cl', 'lb', 'w2']);
  assert.equal((roles.match(/type="checkbox"/g) || []).length, 4);
  for (const title of ['Independent Driver', 'Chauffeur — Fleet Lease', 'Livery Business', 'W2 Chauffeur']) assert.ok(roles.includes(title));
  assert.doesNotMatch(roles, /type="radio"/);
});

test('license details and business retain every source field without inventing issuing-business controls', () => {
  const state = application();
  const license = renderScreen('license-details', state);
  assert.deepEqual(fieldNames(license), ['license.number', 'license.stateOfIssue', 'license.issueDate', 'license.expirationDate']);
  assert.match(control(license, 'license.number'), /maxlength="15"/);
  const business = renderScreen('business', state);
  assert.deepEqual(new Set(fieldNames(business)), new Set(['business.structure', 'business.legalName', 'business.dba', 'business.yearEstablished', 'business.ein', 'business.contactName', 'business.title', 'business.authorized']));
  assert.deepEqual(choices(business, 'business.structure'), ['Corporation', 'LLC', 'Partnership', 'Sole Proprietorship', 'Other']);
  assert.deepEqual(choices(business, 'business.authorized'), ['Yes', 'No']);
  assert.doesNotMatch(control(business, 'business.dba'), /\brequired\b/);
  assert.doesNotMatch(business, /data-field="business\.(?:issuingCountry|issuingCountryName|issuingAuthority)"/);
  assert.doesNotMatch(business, /type="file"/);
});

test('repeated vehicle and fleet questions include conditional lease and Other details', () => {
  const state = application();
  const vehicles = renderScreen('vehicles', state);
  const core = ['ownership', 'plateType', 'make', 'model', 'year', 'vin', 'plateState', 'plateNumber'];
  for (const index of [0, 1]) for (const field of core) control(vehicles, `vehicles.${index}.${field}`);
  for (const field of ['lessorName', 'leaseStart', 'leaseEnd']) {
    assert.match(control(vehicles, `vehicles.0.${field}`), /\brequired\b/);
    assert.ok(!fieldNames(vehicles).includes(`vehicles.1.${field}`));
  }
  assert.deepEqual(choices(vehicles, 'vehicles.0.ownership'), ['Own', 'Lease']);
  assert.deepEqual(choices(vehicles, 'vehicles.0.plateType'), ['Regular', 'Commercial']);
  assert.match(control(vehicles, 'vehicles.0.vin'), /maxlength="17"/);
  hasAction(vehicles, 'add-vehicle');
  hasAction(vehicles, 'toggle-vehicle');
  hasAction(vehicles, 'remove-vehicle');
  assert.match(vehicles, /as many vehicles as you need/);
  assert.doesNotMatch(vehicles, /type="file"/);

  const fleets = renderScreen('fleets', state);
  for (const index of [0, 1]) for (const field of ['name', 'code', 'relationship']) control(fleets, `fleets.${index}.${field}`);
  assert.deepEqual(choices(fleets, 'fleets.0.relationship'), ['Lease vehicle from fleet', 'W2 employee of fleet', 'Other']);
  assert.match(control(fleets, 'fleets.0.other'), /\brequired\b/);
  assert.ok(!fieldNames(fleets).includes('fleets.1.other'));
  hasAction(fleets, 'add-fleet');
  hasAction(fleets, 'remove-fleet');
});

test('review and final preserve collected conditional details and role order without exposing passwords', () => {
  const state = application();
  const sourceValues = ['Westside Leasing Partners', '2024-02-01', '2027-02-01', 'Temporary partner operating agreement', 'Professional Livery LLC', 'City Journeys', 'Managing Member', 'FLT-88291', 'W2-SECOND'];
  for (const step of ['review', 'final']) {
    const html = renderScreen(step, state);
    for (const value of sourceValues) assert.ok(html.includes(value), `${step} loses collected value: ${value}`);
    assert.ok(html.indexOf('W2 Chauffeur, Independent Driver, Chauffeur — Fleet Lease, Livery Business') > -1);
    assert.doesNotMatch(html, /PrivateExample1!/);
    for (const edit of ['account', 'jurisdiction', 'identity', 'license-front', 'license-back', 'license-details', 'portrait', 'roles', 'vehicles', 'business', 'fleets']) assert.ok(html.includes(`data-step="${edit}"`), `Missing review edit target ${edit}`);
  }
  const final = renderScreen('final', state);
  assert.match(final, /<dt>Primary role<\/dt><dd>W2 Chauffeur<\/dd>/);
  assert.match(final, /Agent callback during inspection/);
  assert.match(final, /SSN \/ TIN at this stage/);
  assert.match(final, /does not send an application/);
  const review = renderScreen('review', state);
  assert.match(control(review, 'certification.accepted'), /\brequired\b/);
  assert.match(review, /I certify the information is accurate, that I am authorized to submit this application/);

  const employeeOnly = renderScreen('final', application(['w2']));
  assert.ok(!employeeOnly.includes('Westside Leasing Partners'));
  assert.ok(!employeeOnly.includes('Professional Livery LLC'));
  assert.ok(employeeOnly.includes('Temporary partner operating agreement'));
  const independentOnly = renderScreen('review', application(['id']));
  assert.ok(independentOnly.includes('Westside Leasing Partners'));
  assert.ok(!independentOnly.includes('Temporary partner operating agreement'));
  assert.ok(!independentOnly.includes('Professional Livery LLC'));
});

test('camera and email screens describe prototype verification honestly and offer no gallery upload', () => {
  const state = createState();
  for (const [step, slot] of [['license-front', 'license.frontImage'], ['license-back', 'license.backImage'], ['portrait', 'passport.image']]) {
    const inactive = renderScreen(step, state);
    hasAction(inactive, 'camera-start');
    hasAction(inactive, 'camera-demo');
    assert.doesNotMatch(inactive, /type="file"|OCR successful|Blur check passed|Face detected/);
    assert.match(inactive, /reviewed before activation/);
    const live = renderScreen(step, state, { cameraState: 'live' });
    hasAction(live, 'camera-capture');
    const denied = renderScreen(step, state, { cameraState: 'denied' });
    assert.match(denied, /Camera access is unavailable/);
    const preview = renderScreen(step, state, { captureSlot: slot, capturePreview: 'blob:captured-preview' });
    hasAction(preview, 'camera-retake');
    hasAction(preview, 'camera-accept');
    assert.match(preview, /src="blob:captured-preview"/);
    const unsafe = renderScreen(step, state, { captureSlot: slot, capturePreview: 'javascript:alert(1)' });
    assert.doesNotMatch(unsafe, /src="javascript:/);
  }
  const email = renderScreen('email', application(), { otpRemaining: 21 });
  assert.match(control(email, 'otp'), /maxlength="6"/);
  assert.match(email, /No email is sent in this preview\. Enter any six digits/);
  assert.match(email, /data-action="resend-code"[^>]*\bdisabled\b/);
  assert.match(email, /Available in 21s/);
});

test('untrusted applicant values and errors are escaped in inputs, welcome, and all summaries', () => {
  const state = application();
  const attack = '\"><img src=x onerror=alert(1)><script>alert(2)</script>&';
  state.identity.firstName = attack;
  state.account.email = attack;
  state.vehicles[0].make = attack;
  state.vehicles[0].lessorName = attack;
  state.business.legalName = attack;
  state.fleets[0].name = attack;
  state.fleets[0].other = attack;
  state.license.frontImage = 'data:image/svg+xml,<svg onload=alert(3)></svg>';
  const screens = ['account', 'email', 'identity', 'vehicles', 'business', 'fleets', 'review', 'final'];
  for (const html of [renderWelcome(state, { hasDraft: true }), ...screens.map(step => renderScreen(step, state, { errors: { 'account.email': attack } }))]) {
    assert.ok(!html.includes(attack));
    assert.doesNotMatch(html, /<script\b|<img src=x|\bsrc="data:image\/svg\+xml/);
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  }
});

test('received and resume presentation provide real next actions without claiming remote submission', () => {
  const state = application();
  const welcome = renderWelcome(state, { hasDraft: true, progressPercent: 63 });
  hasAction(welcome, 'resume');
  hasAction(welcome, 'reset');
  assert.match(welcome, /63% complete/);
  const received = renderScreen('received', state);
  assert.match(received, /no application has been sent to RYDEPRO/i);
  assert.equal((received.match(/<li><strong>/g) || []).length, 5);
  for (const action of ['view-status', 'download-summary', 'print-summary']) hasAction(received, action);
  assert.match(received, /href="mailto:support@rydepro.com"/);
  assert.doesNotMatch(received, /successfully submitted|specialist will reach out|PDF.*prepared/);
});
