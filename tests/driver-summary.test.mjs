import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationSummary } from '../src/driver/summary.js';
import { createState, createVehicle, createFleet } from '../src/driver/model.js';

function application(roles = ['w2', 'lb', 'id', 'cl']) {
  return createState({
    account: { email: 'applicant@example.com', password: 'NeverDownloadThis1!', confirmPassword: 'NeverDownloadThis1!', emailVerified: true, createdAt: 1791403200000 },
    jurisdiction: { country: 'US', state: 'CA', city: 'Los Angeles County', zip: '90001' },
    identity: { firstName: 'Jane', middleInitial: 'A', lastName: 'Doe', dob: '1990-01-15', sex: 'Female', phone: '5551234567' },
    license: { frontImage: 'data:image/jpeg;base64,privatefront', backImage: 'blob:private-back', number: 'D1234567', stateOfIssue: 'CA', issueDate: '2020-01-01', expirationDate: '2030-01-01', ocrConfidence: 'Do not export synthetic analysis' },
    passport: { image: 'data:image/png;base64,privateportrait', checks: { unusedSecret: 'private-biometric-data' } },
    roles,
    vehicles: [
      createVehicle({ ownership: 'Lease', plateType: 'Commercial', make: 'Lincoln', model: 'Navigator', year: '2023', vin: '1HGBH41JXMN109186', plateState: 'CA', plateNumber: 'LEASE123', lessorName: 'Westside Leasing Partners', leaseStart: '2024-02-01', leaseEnd: '2027-02-01', _collapsed: true }),
      createVehicle({ ownership: 'Own', plateType: 'Regular', make: 'Toyota', model: 'Camry', year: '2022', vin: '2LNHM82W83Y612345', plateState: 'NY', plateNumber: 'OWN123', lessorName: 'stale owned lessor', leaseStart: '2001-01-01', leaseEnd: '2002-01-01' }),
    ],
    business: { structure: 'LLC', legalName: 'Professional Livery LLC', dba: 'City Journeys', yearEstablished: '2018', ein: '12-3456789', contactName: 'Jane A Doe', title: 'Managing Member', authorized: 'Yes', issuingCountry: 'unused-country-secret', issuingAuthority: 'unused-authority-secret' },
    fleets: [
      createFleet({ name: 'Metropolitan Fleet', code: 'FLT-88291', relationship: 'Other', other: 'Temporary partner operating agreement' }),
      createFleet({ name: 'Employer Fleet', code: 'W2-SECOND', relationship: 'W2 employee of fleet', other: 'stale relationship description' }),
    ],
    certification: { accepted: true }, submitted: true, submittedAt: 1791496800000,
  });
}

test('download summary preserves every applicable collected field and ordered primary role', () => {
  const state = application();
  const result = createApplicationSummary(state);
  assert.deepEqual(result.account, { email: 'applicant@example.com', previewVerified: true, createdAt: 1791403200000 });
  assert.deepEqual(result.jurisdiction, { country: 'US', countryName: 'United States', state: 'CA', stateName: 'California', city: 'Los Angeles County', zip: '90001' });
  assert.deepEqual(result.identity, { firstName: 'Jane', middleInitial: 'A', lastName: 'Doe', dob: '1990-01-15', sex: 'Female', phone: '5551234567' });
  assert.deepEqual(result.license, { number: 'D1234567', stateOfIssue: 'CA', stateOfIssueName: 'California', issueDate: '2020-01-01', expirationDate: '2030-01-01' });
  assert.deepEqual(result.roles.selected.map(role => role.id), ['w2', 'lb', 'id', 'cl']);
  assert.deepEqual(result.roles.primary, { id: 'w2', title: 'W2 Chauffeur' });
  assert.deepEqual(result.vehicles[0], {
    ownership: 'Lease', plateType: 'Commercial', make: 'Lincoln', model: 'Navigator', year: '2023', vin: '1HGBH41JXMN109186',
    plateState: 'CA', plateStateName: 'California', plateNumber: 'LEASE123', lessorName: 'Westside Leasing Partners', leaseStart: '2024-02-01', leaseEnd: '2027-02-01',
  });
  assert.deepEqual(result.business, { structure: 'LLC', legalName: 'Professional Livery LLC', dba: 'City Journeys', yearEstablished: '2018', ein: '12-3456789', contactName: 'Jane A Doe', title: 'Managing Member', authorized: 'Yes' });
  assert.deepEqual(result.fleets[0], { name: 'Metropolitan Fleet', code: 'FLT-88291', relationship: 'Other', other: 'Temporary partner operating agreement' });
  assert.equal(result.certification.accepted, true);
  assert.equal(result.submittedAt, 1791496800000);
  assert.deepEqual(result.preview, { status: 'complete', delivery: 'not-sent' });
});

test('role and ownership branches omit stale data from the exported record', () => {
  const employee = createApplicationSummary(application(['w2']));
  assert.ok(!Object.hasOwn(employee, 'vehicles'));
  assert.ok(!Object.hasOwn(employee, 'business'));
  assert.equal(employee.fleets.length, 2);
  const independent = createApplicationSummary(application(['id']));
  assert.equal(independent.vehicles.length, 2);
  assert.ok(!Object.hasOwn(independent, 'business'));
  assert.ok(!Object.hasOwn(independent, 'fleets'));
  const complete = createApplicationSummary(application());
  for (const key of ['lessorName', 'leaseStart', 'leaseEnd', '_collapsed']) assert.ok(!Object.hasOwn(complete.vehicles[1], key));
  assert.ok(!Object.hasOwn(complete.fleets[1], 'other'));
  assert.ok(!Object.hasOwn(complete.business, 'issuingCountry'));
  assert.ok(!Object.hasOwn(complete.business, 'issuingAuthority'));
  const blank = createApplicationSummary(createState());
  assert.deepEqual(blank.roles, { selected: [], primary: null });
  assert.deepEqual(blank.preview, { status: 'in-progress', delivery: 'not-sent' });
  assert.ok(!Object.hasOwn(blank, 'vehicles'));
  assert.ok(!Object.hasOwn(blank, 'business'));
  assert.ok(!Object.hasOwn(blank, 'fleets'));
});

test('capture metadata is useful without exporting images, passwords or unknown secrets', () => {
  const state = application();
  state.account.token = 'private-auth-token';
  state.vehicles[0].privateAttachment = 'blob:private-attachment';
  const metadata = {
    'license.frontImage': { demo: true, width: 1280, height: 800, mimeType: 'image/JPEG', url: 'blob:private-preview', base64: 'privateencodedimage' },
    'license.backImage': { demo: false, width: 1920, height: 1080, mimeType: 'image/jpeg', password: 'metadata-secret' },
    'passport.image': { demo: true, width: 800, height: 1000, mimeType: 'image/png' },
    unknown: { apiKey: 'private-api-key' },
  };
  const result = createApplicationSummary(state, metadata);
  assert.deepEqual(result.captures['license.frontImage'], { provided: true, demo: true, width: 1280, height: 800, mimeType: 'image/jpeg' });
  assert.deepEqual(result.captures['license.backImage'], { provided: true, demo: false, width: 1920, height: 1080, mimeType: 'image/jpeg' });
  assert.deepEqual(result.captures['passport.image'], { provided: true, demo: true, width: 800, height: 1000, mimeType: 'image/png' });
  const json = JSON.stringify(result);
  for (const forbidden of ['NeverDownloadThis1!', 'password', 'confirmPassword', 'private-auth-token', 'data:image/', 'blob:', 'privateencodedimage', 'private-biometric-data', 'private-api-key', 'metadata-secret', 'unused-country-secret', 'unused-authority-secret', '_collapsed', 'ocrConfidence']) assert.ok(!json.includes(forbidden), `Export leaked ${forbidden}`);
  assert.deepEqual(JSON.parse(json), result);
});

test('summary safely normalizes incomplete state and malformed metadata without mutating input', () => {
  const state = createState();
  const result = createApplicationSummary(state, {
    'license.frontImage': { demo: 'yes', width: Infinity, height: -1, mimeType: 'text/html' },
    'passport.image': { width: 5.5, height: '800', mimeType: 'image/jpeg;url=blob:private' },
  });
  assert.deepEqual(result.captures['license.frontImage'], { provided: false, demo: false, width: null, height: null, mimeType: null });
  assert.deepEqual(result.captures['passport.image'], { provided: false, demo: false, width: null, height: null, mimeType: null });
  assert.doesNotThrow(() => JSON.stringify(createApplicationSummary(null, null)));
  const populated = application();
  const original = JSON.stringify(populated);
  const exported = createApplicationSummary(populated);
  exported.roles.selected[0].title = 'Edited downloaded object';
  exported.vehicles[0].make = 'Edited downloaded vehicle';
  assert.equal(JSON.stringify(populated), original);
  assert.equal(exported.roles.primary.title, 'W2 Chauffeur');
});
