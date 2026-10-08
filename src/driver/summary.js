import { ROLES } from './data.js';
import { normalizeState, needsVehicles, needsBusiness, needsFleets } from './model.js';

const pick = (value, fields) => Object.fromEntries(fields.map(field => [field, value[field]]));
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const dimension = value => Number.isSafeInteger(value) && value > 0 ? value : null;
const mimeType = value => typeof value === 'string' && /^image\/[a-z0-9.+-]+$/i.test(value)
  ? value.toLowerCase() : null;

function captureSummary(value, metadata) {
  const details = record(metadata);
  return {
    provided: typeof value === 'string' ? value.trim().length > 0 : Boolean(value),
    demo: details.demo === true,
    width: dimension(details.width),
    height: dimension(details.height),
    mimeType: mimeType(details.mimeType),
  };
}

/**
 * Downloadable preview data, with explicit field allowlists at every boundary.
 * Passwords, verification codes, raw captures, view state, and hidden role data
 * are intentionally absent. Completion here never represents remote delivery.
 */
export function createApplicationSummary(state, metadata = {}) {
  const current = normalizeState(state);
  const captureMetadata = record(metadata);
  const selected = current.roles.map(id => ({ id, title: ROLES.find(role => role.id === id).title }));
  const result = {
    preview: {
      status: current.submitted ? 'complete' : 'in-progress',
      delivery: 'not-sent',
    },
    account: {
      email: current.account.email,
      previewVerified: current.account.emailVerified,
      createdAt: current.account.createdAt,
    },
    jurisdiction: pick(current.jurisdiction, ['country', 'countryName', 'state', 'stateName', 'city', 'zip']),
    identity: pick(current.identity, ['firstName', 'middleInitial', 'lastName', 'dob', 'sex', 'phone']),
    license: pick(current.license, ['number', 'stateOfIssue', 'stateOfIssueName', 'issueDate', 'expirationDate']),
    captures: {
      'license.frontImage': captureSummary(current.license.frontImage, captureMetadata['license.frontImage']),
      'license.backImage': captureSummary(current.license.backImage, captureMetadata['license.backImage']),
      'passport.image': captureSummary(current.passport.image, captureMetadata['passport.image']),
    },
    roles: {
      selected,
      primary: selected.length ? { ...selected[0] } : null,
    },
    certification: { accepted: current.certification.accepted },
    submittedAt: current.submittedAt,
  };
  if (needsVehicles(current)) result.vehicles = current.vehicles.map(vehicle => ({
    ...pick(vehicle, ['ownership', 'plateType', 'make', 'model', 'year', 'vin', 'plateState', 'plateStateName', 'plateNumber']),
    ...(vehicle.ownership === 'Lease' ? pick(vehicle, ['lessorName', 'leaseStart', 'leaseEnd']) : {}),
  }));
  if (needsBusiness(current)) result.business = pick(current.business,
    ['structure', 'legalName', 'dba', 'yearEstablished', 'ein', 'contactName', 'title', 'authorized']);
  if (needsFleets(current)) result.fleets = current.fleets.map(fleet => ({
    ...pick(fleet, ['name', 'code', 'relationship']),
    ...(fleet.relationship === 'Other' ? { other: fleet.other } : {}),
  }));
  return result;
}
