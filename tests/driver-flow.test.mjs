import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, createVehicle, createFleet, invalidateAfterChange } from '../src/driver/model.js';
import { resolveStep, nextStep, previousStep, milestoneProgress } from '../src/driver/flow.js';

const files = {
  'license.frontImage': 'blob:front-photo',
  'license.backImage': 'blob:back-photo',
  'passport.image': 'blob:portrait-photo',
};
function readyApplication(roles = ['id']) {
  return createState({
    account: { email: 'driver@example.com', password: 'Example1!', confirmPassword: 'Example1!', emailVerified: true, createdAt: 1791403200000 },
    jurisdiction: { country: 'US', state: 'CA', city: 'Los Angeles', zip: '90001' },
    identity: { firstName: 'John', lastName: 'Doe', dob: '1990-01-15', sex: 'Male', phone: '5551234567' },
    license: { number: 'D1234567', stateOfIssue: 'CA', issueDate: '2020-01-01', expirationDate: '2030-01-01' },
    roles,
    vehicles: [createVehicle({ make: 'Toyota', model: 'Camry', year: '2022', vin: '1HGBH41JXMN109186', plateState: 'CA', plateNumber: 'ABC1234' })],
    business: { structure: 'LLC', legalName: 'Example Livery LLC', yearEstablished: '2018', ein: '12-3456789', contactName: 'John Doe', title: 'Owner', authorized: 'Yes' },
    fleets: [createFleet({ name: 'Example Fleet', code: 'FLT-88291', relationship: 'Lease vehicle from fleet' })],
    certification: { accepted: true },
  });
}
const baseRoute = ['account', 'email', 'jurisdiction', 'identity', 'license-front', 'license-back', 'license-details', 'portrait', 'roles'];

test('all role combinations keep safe forward/back order and group exactly the active operations', () => {
  const cases = [
    [['id'], ['vehicles']], [['cl'], ['fleets']], [['lb'], ['vehicles', 'business']], [['w2'], ['fleets']],
    [['id', 'cl'], ['vehicles', 'fleets']], [['id', 'lb'], ['vehicles', 'business']], [['id', 'w2'], ['vehicles', 'fleets']],
    [['cl', 'lb'], ['vehicles', 'business', 'fleets']], [['cl', 'w2'], ['fleets']], [['lb', 'w2'], ['vehicles', 'business', 'fleets']],
    [['id', 'cl', 'lb'], ['vehicles', 'business', 'fleets']], [['id', 'cl', 'w2'], ['vehicles', 'fleets']],
    [['id', 'lb', 'w2'], ['vehicles', 'business', 'fleets']], [['cl', 'lb', 'w2'], ['vehicles', 'business', 'fleets']],
    [['id', 'cl', 'lb', 'w2'], ['vehicles', 'business', 'fleets']],
  ];
  for (const [roles, operations] of cases) {
    const state = readyApplication(roles);
    const expected = [...baseRoute, ...operations, 'review', 'final', 'received'];
    expected.forEach((id, index) => {
      assert.equal(nextStep(id, state), expected[index + 1] || null, `${roles}: next ${id}`);
      assert.equal(previousStep(id, state), expected[index - 1] || null, `${roles}: previous ${id}`);
    });
    assert.deepEqual(milestoneProgress(state, files).find(group => group.id === 'operations').steps, ['roles', ...operations]);
  }
});

test('unknown and inactive steps have no inferred next/previous route', () => {
  const state = readyApplication(['cl']);
  for (const id of ['unknown', 'vehicles', 'business', '1.13']) {
    assert.equal(nextStep(id, state), null);
    assert.equal(previousStep(id, state), null);
  }
  assert.equal(previousStep('account', state), null);
  assert.equal(nextStep('received', state), null);
});

test('direct future-step links cannot bypass incomplete account or identity data', () => {
  const blank = createState();
  for (const requested of ['email', 'identity', 'license-front', 'roles', 'review', 'final', 'received', 'unknown']) assert.equal(resolveStep(requested, blank), 'account');
  const ready = readyApplication(); ready.identity.phone = '';
  for (const requested of ['license-front', 'roles', 'vehicles', 'review', 'final', 'received']) assert.equal(resolveStep(requested, ready, files), 'identity');
  assert.equal(resolveStep('identity', ready, files), 'identity', 'a pending section itself remains reachable');
  assert.equal(resolveStep('account', ready, files), 'account', 'earlier completed sections remain reachable');
});

test('missing captures block later navigation even when all text fields and certification are filled', () => {
  const state = readyApplication();
  assert.equal(resolveStep('review', state, {}), 'license-front');
  assert.equal(resolveStep('review', state, { ...files, 'license.backImage': null }), 'license-back');
  assert.equal(resolveStep('review', state, files), 'review');
});

test('certification and final submission are distinct gates, followed by received', () => {
  const state = readyApplication(); state.certification.accepted = false;
  assert.equal(resolveStep('final', state, files), 'review');
  state.certification.accepted = true;
  assert.equal(resolveStep('final', state, files), 'final');
  assert.equal(resolveStep('received', state, files), 'final');
  state.submitted = true;
  assert.equal(resolveStep('received', state, files), 'received');
  assert.equal(resolveStep('unknown', state, files), 'received');
  assert.equal(resolveStep('account', state, files), 'account', 'controller decides read-only rendering after submission');
});

test('five milestone groups report actual completion and target their first pending section', () => {
  const blankGroups = milestoneProgress(createState());
  assert.deepEqual(blankGroups.map(group => [group.id, group.label, group.complete, group.target]), [
    ['account', 'Account', false, 'account'], ['profile', 'Profile', false, 'jurisdiction'],
    ['documents', 'Documents', false, 'license-front'], ['operations', 'Operations', false, 'roles'],
    ['review', 'Review', false, 'review'],
  ]);
  const state = readyApplication(['lb', 'w2']);
  const groups = milestoneProgress(state, files);
  assert.equal(groups.length, 5);
  assert.ok(groups.slice(0, 4).every(group => group.complete));
  assert.deepEqual(groups[4], { id: 'review', label: 'Review', steps: ['review', 'final'], complete: false, target: 'final' });
  state.submitted = true;
  assert.ok(milestoneProgress(state, files).every(group => group.complete));
  assert.equal(milestoneProgress(state, files)[4].target, 'review');
});

test('changed submitted data invalidates receipt navigation and targets the affected section', () => {
  const original = readyApplication(); original.submitted = true;
  const edited = createState(original); edited.vehicles[0].vin = 'invalid';
  const state = invalidateAfterChange(original, edited);
  assert.equal(resolveStep('received', state, files), 'vehicles');
  const operations = milestoneProgress(state, files).find(group => group.id === 'operations');
  assert.equal(operations.complete, false); assert.equal(operations.target, 'vehicles');
  assert.equal(milestoneProgress(state, files).find(group => group.id === 'review').complete, false);
});

test('adding a role introduces its required branch without treating prior submission as complete', () => {
  const original = readyApplication(['w2']); original.vehicles = []; original.submitted = true;
  const edited = createState(original); edited.roles.push('id');
  const state = invalidateAfterChange(original, edited);
  assert.equal(resolveStep('received', state, files), 'vehicles');
  assert.equal(nextStep('roles', state), 'vehicles');
  assert.deepEqual(milestoneProgress(state, files).find(group => group.id === 'operations').steps, ['roles', 'vehicles', 'fleets']);
});

test('flow helpers are pure and return fresh milestone arrays', () => {
  const state = readyApplication(['id', 'cl']);
  const snapshot = JSON.stringify(state);
  resolveStep('review', state, files); nextStep('roles', state); previousStep('review', state);
  const groups = milestoneProgress(state, files);
  groups[0].steps.push('extra');
  assert.deepEqual(milestoneProgress(state, files)[0].steps, ['account', 'email']);
  assert.equal(JSON.stringify(state), snapshot);
});
