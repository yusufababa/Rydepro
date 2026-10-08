import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, STATES, CITIES, DEFAULT_CITIES, STEPS } from '../src/driver/data.js';
import {
  initialState, createState, createVehicle, createFleet, normalizeState,
  requiredStepIds, visibleStepIds, validateStep, isStepComplete, progress,
  checkPrerequisites, invalidateAfterChange, serializeDraft, isDemoEmailCode, normalizeField,
} from '../src/driver/model.js';

const options = { today: '2026-10-08' };
const photos = {
  'license.frontImage': new Blob(['front photo'], { type: 'image/jpeg' }),
  'license.backImage': new Blob(['back photo'], { type: 'image/jpeg' }),
  'passport.image': new Blob(['portrait photo'], { type: 'image/jpeg' }),
};
function validApplication(roles = ['id']) {
  return createState({
    account: { email: 'driver@example.com', password: 'Example1!', confirmPassword: 'Example1!', emailVerified: true, createdAt: 1791403200000 },
    jurisdiction: { country: 'US', state: 'CA', city: 'Los Angeles', zip: '90001' },
    identity: { firstName: 'John', middleInitial: 'A', lastName: 'Doe', dob: '1990-01-15', sex: 'Male', phone: '5551234567' },
    license: { number: 'D1234567', stateOfIssue: 'CA', issueDate: '2020-01-01', expirationDate: '2030-01-01' },
    roles,
    vehicles: [createVehicle({ make: 'Toyota', model: 'Camry', year: '2022', vin: '1HGBH41JXMN109186', plateState: 'CA', plateNumber: 'ABC1234' })],
    business: { structure: 'LLC', legalName: 'Example Livery LLC', yearEstablished: '2018', ein: '12-3456789', contactName: 'John Doe', title: 'Owner', authorized: 'Yes' },
    fleets: [createFleet({ name: 'Example Fleet', code: 'FLT-88291', relationship: 'Lease vehicle from fleet' })],
    certification: { accepted: true },
  });
}
const validate = (id, state, files = photos, config = options) => validateStep(id, state, files, config);

test('jurisdiction option lists preserve every supplied country, all states, and city suggestions', () => {
  assert.deepEqual(COUNTRIES.map(country => country.code), ['US', 'CA', 'GB', 'AU', 'MX']);
  assert.deepEqual(COUNTRIES.filter(country => country.supported).map(country => country.code), ['US']);
  assert.equal(STATES.length, 51);
  assert.equal(new Set(STATES.map(state => state.code)).size, 51);
  assert.ok(STATES.some(state => state.code === 'DC' && state.name === 'District of Columbia'));
  assert.ok(CITIES.CA.includes('Los Angeles County'));
  assert.ok(DEFAULT_CITIES.includes('Arlington'));
  assert.equal(STEPS.length, 15);
});

test('blank and resumed state never inherit the example applicant or example captures', () => {
  const first = createState();
  const second = createState();
  first.roles.push('id');
  first.identity.firstName = 'Jane';
  assert.deepEqual(second.roles, []);
  assert.equal(second.identity.firstName, '');
  assert.equal(second.license.frontImage, null);
  assert.equal(initialState.account.email, '');
  const resumed = normalizeState({ account: { email: 'driver@example.com', confirm: 'Example1!' }, lastScreen: '1.7', roles: ['id', 'id', 'invalid'] });
  assert.equal(resumed.account.confirmPassword, 'Example1!');
  assert.equal(resumed.lastStep, 'license-details');
  assert.deepEqual(resumed.roles, ['id']);
  assert.equal(resumed.passport.image, null);
});

test('all fifteen nonempty role combinations follow the same conditional routes as the demo', () => {
  const cases = [
    [['id'], ['vehicles']], [['cl'], ['fleets']], [['lb'], ['vehicles', 'business']], [['w2'], ['fleets']],
    [['id', 'cl'], ['vehicles', 'fleets']], [['id', 'lb'], ['vehicles', 'business']], [['id', 'w2'], ['vehicles', 'fleets']],
    [['cl', 'lb'], ['vehicles', 'business', 'fleets']], [['cl', 'w2'], ['fleets']], [['lb', 'w2'], ['vehicles', 'business', 'fleets']],
    [['id', 'cl', 'lb'], ['vehicles', 'business', 'fleets']], [['id', 'cl', 'w2'], ['vehicles', 'fleets']],
    [['id', 'lb', 'w2'], ['vehicles', 'business', 'fleets']], [['cl', 'lb', 'w2'], ['vehicles', 'business', 'fleets']],
    [['id', 'cl', 'lb', 'w2'], ['vehicles', 'business', 'fleets']],
  ];
  for (const [roles, conditional] of cases) {
    const state = createState({ roles });
    assert.deepEqual(requiredStepIds(state).filter(id => ['vehicles', 'business', 'fleets'].includes(id)), conditional, roles.join(','));
    assert.deepEqual(requiredStepIds(state).slice(-2), ['review', 'final']);
    assert.equal(visibleStepIds(state).at(-1), 'received');
    assert.ok(!requiredStepIds(state).includes('received'));
  }
  assert.equal(validate('roles', createState()).valid, false);
});

test('account password limits and each complexity requirement are enforced without changing whitespace', () => {
  const state = validApplication();
  assert.equal(validate('account', state).valid, true);
  for (const password of ['Example!', 'example1!', 'EXAMPLE1!', 'Example11', 'Examp1!', 'A1!' + 'x'.repeat(62)]) {
    state.account.password = password; state.account.confirmPassword = password;
    assert.ok(validate('account', state).errors['account.password'], password);
  }
  state.account.password = 'Aa1!' + 'x'.repeat(60); state.account.confirmPassword = state.account.password;
  assert.equal(validate('account', state).valid, true);
  state.account.password = 'Aa1 abcd'; state.account.confirmPassword = state.account.password;
  assert.equal(validate('account', state).valid, true, 'source treats a space as a special character');
  state.account.confirmPassword = 'different';
  assert.ok(validate('account', state).errors['account.confirmPassword']);
  state.account.email = 'invalid@@example.com';
  assert.ok(validate('account', state).errors['account.email']);
  assert.equal(createState({ account: { password: ' Aa1!abcd ', confirmPassword: ' Aa1!abcd ' } }).account.password, ' Aa1!abcd ');
});

test('email verification is explicitly a demo: any six digits, and incomplete codes never verify', () => {
  for (const code of ['000000', '123456', '987654']) assert.equal(isDemoEmailCode(code), true);
  for (const code of ['', '12345', '1234567', 'abcdef', ' 123456']) assert.equal(isDemoEmailCode(code), false);
  const state = validApplication(); state.account.emailVerified = false;
  assert.equal(validate('email', state).valid, false);
  state.account.emailVerified = true;
  assert.equal(validate('email', state).valid, true);
});

test('jurisdiction enforces supported country, selected state, and five-digit ZIP without restricting city suggestions', () => {
  const state = validApplication();
  state.jurisdiction.city = 'A different real city';
  assert.equal(validate('jurisdiction', state).valid, true);
  state.jurisdiction.country = 'CA';
  assert.ok(validate('jurisdiction', state).errors['jurisdiction.country']);
  state.jurisdiction.country = 'US'; state.jurisdiction.state = 'XX'; state.jurisdiction.zip = '9000';
  const errors = validate('jurisdiction', state).errors;
  assert.ok(errors['jurisdiction.state']); assert.ok(errors['jurisdiction.zip']);
});

test('adult DOB validation handles exact birthdays, leap days, and impossible dates', () => {
  const state = validApplication();
  state.identity.dob = '2008-10-08'; assert.equal(validate('identity', state).valid, true);
  state.identity.dob = '2008-10-09'; assert.ok(validate('identity', state).errors['identity.dob']);
  state.identity.dob = '2008-02-29';
  assert.equal(validate('identity', state, photos, { today: '2026-02-28' }).valid, false);
  assert.equal(validate('identity', state, photos, { today: '2026-03-01' }).valid, true);
  state.identity.dob = '2008-02-30'; assert.ok(validate('identity', state).errors['identity.dob']);
  state.identity.dob = '1990-01-15'; state.identity.phone = '555123456'; state.identity.middleInitial = 'AB';
  const errors = validate('identity', state).errors;
  assert.ok(errors['identity.phone']); assert.ok(errors['identity.middleInitial']);
});

test('license details require real dates but do not invent unstated expiry or date-order policies', () => {
  const state = validApplication();
  state.license.issueDate = '2027-01-01'; state.license.expirationDate = '2020-01-01';
  assert.equal(validate('license-details', state).valid, true);
  state.license.expirationDate = '2030-02-30'; state.license.stateOfIssue = 'XX';
  const errors = validate('license-details', state).errors;
  assert.ok(errors['license.expirationDate']); assert.ok(errors['license.stateOfIssue']);
});

test('all leased vehicles require lessor and both lease dates; owned vehicles do not', () => {
  const state = validApplication();
  state.vehicles.push(createVehicle({ ...state.vehicles[0], ownership: 'Lease' }));
  const errors = validate('vehicles', state).errors;
  assert.ok(errors['vehicles.1.lessorName']); assert.ok(errors['vehicles.1.leaseStart']); assert.ok(errors['vehicles.1.leaseEnd']);
  Object.assign(state.vehicles[1], { lessorName: 'Example Leasing', leaseStart: '2024-01-01', leaseEnd: '2027-01-01' });
  assert.equal(validate('vehicles', state).valid, true);
  state.vehicles[1].ownership = 'Own'; state.vehicles[1].leaseStart = '';
  assert.equal(validate('vehicles', state).valid, true);
});

test('VIN rules reject I/O/Q and wrong lengths without adding checksum or vehicle-age restrictions', () => {
  const state = validApplication();
  for (const vin of ['1HGBH41JXMN10918', '1HGBH41JXMN1091867', 'IHGBH41JXMN109186', 'OHGBH41JXMN109186', 'QHGBH41JXMN109186']) {
    state.vehicles[0].vin = vin;
    assert.ok(validate('vehicles', state).errors['vehicles.0.vin']);
  }
  state.vehicles[0].vin = '1HGBH41JXMN109186'; state.vehicles[0].year = '9999';
  assert.equal(validate('vehicles', state).valid, true);
  assert.equal(normalizeField('vehicles.0.vin', 'i-o-q-1hgbh41jxmn109186'), '1HGBH41JXMN109186');
});

test('business preserves optional source data and accepts either authorization answer and registration formats', () => {
  const state = validApplication(['lb']);
  state.business.authorized = 'No'; state.business.ein = 'REG-EXAMPLE-9';
  assert.equal(validate('business', state).valid, true);
  assert.equal(state.business.issuingCountry, '');
  state.business.ein = 'x'.repeat(31);
  assert.ok(validate('business', state).errors['business.ein']);
});

test('Other fleet relationship needs a description, and every fleet entry is checked', () => {
  const state = validApplication(['cl']);
  state.fleets.push(createFleet({ name: 'Another Fleet', code: 'INV-9', relationship: 'Other' }));
  assert.ok(validate('fleets', state).errors['fleets.1.other']);
  state.fleets[1].other = 'Relief chauffeur';
  assert.equal(validate('fleets', state).valid, true);
});

test('capture references and in-memory image files are accepted, while absent or removed captures are not', () => {
  const state = validApplication();
  assert.equal(validate('license-front', state).valid, true);
  assert.equal(validate('license-front', state, {}).valid, false);
  state.license.frontImage = 'blob:example-front';
  assert.equal(validate('license-front', state, {}).valid, true);
  assert.equal(validate('license-front', state, { 'license.frontImage': null }).valid, false);
  assert.equal(validate('license-front', state, { 'license.frontImage': new Blob(['not an image'], { type: 'text/plain' }) }).valid, false);
});

test('review/final revalidate applicable data, certification, and captures instead of trusting completion flags', () => {
  const state = validApplication(['id', 'lb', 'cl']);
  assert.equal(validate('review', state).valid, true);
  assert.equal(checkPrerequisites('final', state, photos, options).allowed, true);
  state.vehicles[0].vin = 'invalid'; state.completed = { vehicles: true, review: true, final: true }; state.submitted = true;
  assert.ok(validate('final', state).errors['vehicles.0.vin']);
  assert.equal(checkPrerequisites('final', state, photos, options).allowed, false);
  assert.equal(isStepComplete('received', state, photos, options), false);
  assert.ok(progress(state, photos, options).percent < 100);
  const fleetOnly = validApplication(['w2']); fleetOnly.vehicles = []; fleetOnly.business.legalName = '';
  assert.equal(validate('review', fleetOnly).valid, true, 'hidden branches do not block fleet-only drivers');
});

test('progress counts final submission only after submission and gates the received screen', () => {
  const state = validApplication(['id']);
  const before = progress(state, photos, options);
  assert.equal(before.total, 12); assert.equal(before.complete, 11); assert.equal(before.next, 'final');
  assert.equal(checkPrerequisites('received', state, photos, options).allowed, false);
  state.submitted = true;
  assert.equal(progress(state, photos, options).percent, 100);
  assert.equal(checkPrerequisites('received', state, photos, options).allowed, true);
  assert.equal(validate('received', state).valid, true);
  state.account.createdAt = 'invalid';
  assert.equal(isStepComplete('account', state, photos, options), false);
});

test('editing dependencies invalidates verification/certification without deleting conditional branch data', () => {
  const original = validApplication(['id', 'lb']); original.submitted = true;
  const edited = createState(original); edited.account.email = 'different@example.com';
  const afterEmail = invalidateAfterChange(original, edited);
  assert.equal(afterEmail.account.emailVerified, false); assert.equal(afterEmail.account.createdAt, null);
  assert.equal(afterEmail.certification.accepted, false); assert.equal(afterEmail.submitted, false);
  assert.equal(original.account.emailVerified, true, 'helper is immutable');
  const stateEdit = createState(original); stateEdit.jurisdiction.state = 'NY';
  const afterState = invalidateAfterChange(original, stateEdit);
  assert.equal(afterState.jurisdiction.city, ''); assert.equal(afterState.jurisdiction.zip, '');
  const roleEdit = createState(original); roleEdit.roles = ['cl'];
  const afterRoles = invalidateAfterChange(original, roleEdit);
  assert.equal(afterRoles.vehicles.length, 1); assert.equal(afterRoles.business.legalName, original.business.legalName);
  assert.ok(!requiredStepIds(afterRoles).includes('business'));
  assert.equal(afterRoles.certification.accepted, false);
  assert.equal(invalidateAfterChange(original, original, ['passport.image']).certification.accepted, false);
  const nameEdit = createState(original); nameEdit.identity.firstName = 'Mary ';
  assert.equal(normalizeField('identity.firstName', 'Mary '), 'Mary ', 'typing a multiword name keeps the space');
  assert.equal(invalidateAfterChange(original, nameEdit).identity.firstName, 'Mary ');
  const collapseEdit = createState(original); collapseEdit.vehicles[0]._collapsed = true;
  assert.equal(invalidateAfterChange(original, collapseEdit).certification.accepted, true, 'collapsing a card does not edit collected data');
});

test('browser drafts exclude passwords, volatile photos, and stale certification/submission milestones', () => {
  const state = validApplication();
  state.license.frontImage = 'data:image/jpeg;base64,private-front';
  state.license.backImage = photos['license.backImage']; state.passport.image = 'blob:private-face'; state.submitted = true;
  const draft = serializeDraft(state);
  const serialized = JSON.stringify(draft);
  assert.ok(!serialized.includes('Example1!')); assert.ok(!serialized.includes('private-front')); assert.ok(!serialized.includes('private-face'));
  assert.equal(draft.license.frontImage, null); assert.equal(draft.license.backImage, null); assert.equal(draft.passport.image, null);
  assert.equal(draft.account.password, ''); assert.equal(draft.account.confirmPassword, '');
  assert.equal(draft.certification.accepted, false); assert.equal(draft.submitted, false);
  assert.equal(state.account.password, 'Example1!', 'serialization does not mutate live state');
  assert.equal(validate('final', createState(draft), {}).valid, false);
});
