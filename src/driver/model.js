import {
  COUNTRIES, STATES, ROLES, SEX_OPTIONS, OWNERSHIP_OPTIONS, PLATE_TYPES,
  BUSINESS_STRUCTURES, AUTHORIZATION_OPTIONS, FLEET_RELATIONSHIPS,
  STEPS, SOURCE_STEP_IDS, FIELD_LIMITS, CAPTURE_PATHS, stateName, countryName,
} from './data.js';

const roleIds = new Set(ROLES.map(role => role.id));
const stateIds = new Set(STATES.map(state => state.code));
const stepIds = new Set(STEPS.map(step => step.id));
const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, trim = true) => {
  const result = typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  return trim ? result.trim() : result;
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function blankState() {
  return {
    account: { email: '', password: '', confirmPassword: '', emailVerified: false, attempts: 0, createdAt: null },
    jurisdiction: { country: '', countryName: '', state: '', stateName: '', city: '', zip: '' },
    identity: { firstName: '', middleInitial: '', lastName: '', dob: '', sex: '', phone: '' },
    license: { frontImage: null, backImage: null, number: '', stateOfIssue: '', stateOfIssueName: '', issueDate: '', expirationDate: '', ocrConfidence: '', manualOverride: false },
    passport: { image: null, checks: {} },
    roles: [], vehicles: [],
    business: { structure: '', legalName: '', dba: '', yearEstablished: '', ein: '', issuingCountry: '', issuingCountryName: '', issuingAuthority: '', contactName: '', title: '', authorized: '' },
    fleets: [], certification: { accepted: false }, submitted: false,
    submittedAt: null, lastStep: 'account', sidebarCollapsed: {},
  };
}

function deepFreeze(value) {
  Object.values(value).forEach(child => { if (child && typeof child === 'object') deepFreeze(child); });
  return Object.freeze(value);
}
export const initialState = deepFreeze(blankState());

export function createVehicle(seed = {}) {
  const raw = object(seed);
  const vehicle = {
    ownership: 'Own', plateType: 'Regular', make: '', model: '', year: '', vin: '',
    plateState: '', plateStateName: '', plateNumber: '', lessorName: '', leaseStart: '', leaseEnd: '', _collapsed: false,
  };
  for (const key of Object.keys(vehicle)) if (key in raw && key !== '_collapsed') vehicle[key] = text(raw[key], false);
  vehicle.vin = vehicle.vin.toUpperCase();
  vehicle.plateNumber = vehicle.plateNumber.toUpperCase();
  vehicle.plateStateName = stateName(vehicle.plateState) || vehicle.plateStateName;
  vehicle._collapsed = raw._collapsed === true;
  return vehicle;
}

export function createFleet(seed = {}) {
  const raw = object(seed);
  return Object.fromEntries(['name', 'code', 'relationship', 'other'].map(key => [key, text(raw[key], false)]));
}

function timestamp(value) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Merge only known fields. No demo applicants or demo photos are injected on resume. */
export function normalizeState(seed = {}) {
  const raw = object(seed);
  const result = blankState();
  for (const section of ['account', 'jurisdiction', 'identity', 'license', 'business']) {
    const input = object(raw[section]);
    for (const [key, defaultValue] of Object.entries(result[section])) {
      if (typeof defaultValue === 'string') result[section][key] = text(input[key], false);
    }
  }
  if (raw.account?.confirmPassword === undefined) result.account.confirmPassword = text(raw.account?.confirm, false);
  result.account.emailVerified = raw.account?.emailVerified === true;
  result.account.attempts = Number.isInteger(raw.account?.attempts) && raw.account.attempts >= 0 ? raw.account.attempts : 0;
  result.account.createdAt = timestamp(raw.account?.createdAt);
  result.jurisdiction.countryName = countryName(result.jurisdiction.country) || result.jurisdiction.countryName;
  result.jurisdiction.stateName = stateName(result.jurisdiction.state) || result.jurisdiction.stateName;
  result.identity.phone = result.identity.phone.replace(/\D/g, '');
  result.license.stateOfIssueName = stateName(result.license.stateOfIssue) || result.license.stateOfIssueName;
  result.license.frontImage = raw.license?.frontImage || null;
  result.license.backImage = raw.license?.backImage || null;
  result.license.manualOverride = raw.license?.manualOverride === true;
  result.passport.image = raw.passport?.image || null;
  result.passport.checks = { ...object(raw.passport?.checks) };
  result.roles = [...new Set(Array.isArray(raw.roles) ? raw.roles.filter(role => roleIds.has(role)) : [])];
  result.vehicles = Array.isArray(raw.vehicles) ? raw.vehicles.map(createVehicle) : [];
  result.fleets = Array.isArray(raw.fleets) ? raw.fleets.map(createFleet) : [];
  result.certification.accepted = raw.certification?.accepted === true;
  result.submitted = raw.submitted === true;
  result.submittedAt = timestamp(raw.submittedAt);
  result.sidebarCollapsed = { ...object(raw.sidebarCollapsed) };
  const requestedStep = raw.lastStep ?? SOURCE_STEP_IDS[raw.lastScreen] ?? raw.lastScreen;
  result.lastStep = stepIds.has(requestedStep) ? requestedStep : 'account';
  if (!visibleStepIds(result).includes(result.lastStep)) result.lastStep = 'roles';
  return result;
}
export function createState(seed = {}) { return normalizeState(seed); }

export function hasRole(state, role) { return Array.isArray(state?.roles) && state.roles.includes(role); }
export function needsVehicles(state) { return hasRole(state, 'id') || hasRole(state, 'lb'); }
export function needsBusiness(state) { return hasRole(state, 'lb'); }
export function needsFleets(state) { return hasRole(state, 'cl') || hasRole(state, 'w2'); }

export function requiredStepIds(state) {
  return STEPS.filter(step => step.id !== 'received'
    && (step.id !== 'vehicles' || needsVehicles(state))
    && (step.id !== 'business' || needsBusiness(state))
    && (step.id !== 'fleets' || needsFleets(state))).map(step => step.id);
}
export function visibleStepIds(state) { return [...requiredStepIds(state), 'received']; }
export function applicationStepIds(state) { return requiredStepIds(state).filter(id => !['review', 'final'].includes(id)); }

export function passwordRequirements(password) {
  const value = text(password, false);
  return {
    length: value.length >= 8 && value.length <= 64,
    uppercase: /[A-Z]/.test(value), lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value), special: /[^A-Za-z0-9]/.test(value),
  };
}
export function isDemoEmailCode(code) { return /^\d{6}$/.test(text(code, false)); }
export function formatPhone(phone) {
  const value = text(phone).replace(/\D/g, '').slice(0, 10);
  if (value.length < 4) return value;
  if (value.length < 7) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
}

/** Entry transformations used by the original demo, without changing password whitespace. */
export function normalizeField(path, value) {
  let output = text(value, false);
  const genericPath = path.replace(/\.\d+\./g, '.');
  if (['identity.firstName', 'identity.lastName'].includes(path)) output = output.replace(/[^A-Za-z\-' ]/g, '');
  if (path === 'identity.middleInitial') output = output.replace(/[^A-Za-z]/g, '').slice(0, 1);
  if (path === 'identity.phone') output = output.replace(/\D/g, '').slice(0, 10);
  if (path === 'jurisdiction.zip') output = output.replace(/\D/g, '').slice(0, 5);
  if (genericPath === 'vehicles.vin') output = output.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
  if (genericPath === 'vehicles.plateNumber') output = output.toUpperCase();
  if (['vehicles.year', 'business.yearEstablished'].includes(genericPath)) output = output.replace(/\D/g, '');
  const limit = FIELD_LIMITS[genericPath];
  return limit ? output.slice(0, limit) : output;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function todayString(today) {
  if (typeof today === 'string' && validDate(today)) return today;
  const value = today instanceof Date ? today : new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function adultDob(value, today) {
  const current = todayString(today);
  const cutoff = `${Number(current.slice(0, 4)) - 18}${current.slice(4)}`;
  return validDate(value) && value <= cutoff;
}
function requiredText(errors, path, value, limit) {
  if (!text(value)) errors[path] = 'Complete this required field.';
  else if (limit && text(value, false).length > limit) errors[path] = `Use ${limit} characters or fewer.`;
}
function requiredOption(errors, path, value, options) {
  if (!options.includes(value)) errors[path] = 'Select an option from the list.';
}
function requiredDate(errors, path, value) {
  if (!validDate(value)) errors[path] = 'Enter a valid date.';
}
function nestedValue(value, path) { return path.split('.').reduce((current, key) => current?.[key], value); }
function capturePresent(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return typeof Blob !== 'undefined' && value instanceof Blob && value.size > 0 && value.type.startsWith('image/');
}
export function hasCapture(state, files, path) {
  if (files && Object.prototype.hasOwnProperty.call(files, path)) return capturePresent(files[path]);
  const nestedFile = nestedValue(files, path);
  return capturePresent(nestedFile === undefined ? nestedValue(state, path) : nestedFile);
}

/** Required rules are grounded in the demo's labels, input limits, and stated requirements.
 * It does not invent VIN checksum, vehicle age, EIN format, lease ordering, or license-expiry policies.
 */
export function validateStep(stepId, state, files = {}, options = {}) {
  const current = normalizeState(state);
  const errors = {};
  if (!stepIds.has(stepId)) return { valid: false, errors: { step: 'Choose an application section.' } };
  if (!visibleStepIds(current).includes(stepId)) return { valid: true, errors, skipped: true };
  const { account, jurisdiction, identity, license, business } = current;
  if (stepId === 'account') {
    if (!account.email || account.email.length > 254 || !EMAIL_PATTERN.test(account.email)) errors['account.email'] = 'Enter a valid email address, up to 254 characters.';
    if (!Object.values(passwordRequirements(account.password)).every(Boolean)) errors['account.password'] = 'Use 8–64 characters with uppercase, lowercase, a number, and a special character.';
    if (!account.confirmPassword || account.confirmPassword.length > 64 || account.confirmPassword !== account.password) errors['account.confirmPassword'] = 'Confirm the same password.';
  }
  if (stepId === 'email' && !account.emailVerified) errors['account.emailVerified'] = 'Enter the six-digit demo verification code to continue.';
  if (stepId === 'jurisdiction') {
    if (!COUNTRIES.some(country => country.code === jurisdiction.country && country.supported)) errors['jurisdiction.country'] = 'The United States is currently the only supported country.';
    if (!stateIds.has(jurisdiction.state)) errors['jurisdiction.state'] = 'Choose a state from the list.';
    requiredText(errors, 'jurisdiction.city', jurisdiction.city);
    if (!/^\d{5}$/.test(jurisdiction.zip)) errors['jurisdiction.zip'] = 'Enter a five-digit ZIP code.';
  }
  if (stepId === 'identity') {
    for (const field of ['firstName', 'lastName']) {
      requiredText(errors, `identity.${field}`, identity[field], 50);
      if (identity[field] && !/^[A-Za-z\-' ]+$/.test(identity[field])) errors[`identity.${field}`] = 'Use letters, spaces, apostrophes, or hyphens.';
    }
    if (identity.middleInitial && !/^[A-Za-z]$/.test(identity.middleInitial)) errors['identity.middleInitial'] = 'Enter one letter or leave this field empty.';
    if (!validDate(identity.dob)) errors['identity.dob'] = 'Enter a valid date of birth.';
    else if (!adultDob(identity.dob, options.today)) errors['identity.dob'] = 'You must be at least 18 years old.';
    requiredOption(errors, 'identity.sex', identity.sex, SEX_OPTIONS);
    if (!/^\d{10}$/.test(identity.phone)) errors['identity.phone'] = 'Enter a ten-digit phone number.';
  }
  const capturePath = { 'license-front': 'license.frontImage', 'license-back': 'license.backImage', portrait: 'passport.image' }[stepId];
  if (capturePath && !hasCapture(current, files, capturePath)) errors[capturePath] = 'Capture and accept this photo to continue.';
  if (stepId === 'license-details') {
    requiredText(errors, 'license.number', license.number, 15);
    if (!stateIds.has(license.stateOfIssue)) errors['license.stateOfIssue'] = 'Choose the issuing state from the list.';
    requiredDate(errors, 'license.issueDate', license.issueDate);
    requiredDate(errors, 'license.expirationDate', license.expirationDate);
  }
  if (stepId === 'roles' && !current.roles.length) errors.roles = 'Select at least one role.';
  if (stepId === 'vehicles') {
    if (!current.vehicles.length) errors.vehicles = 'Add at least one vehicle.';
    current.vehicles.forEach((vehicle, index) => {
      const prefix = `vehicles.${index}`;
      requiredOption(errors, `${prefix}.ownership`, vehicle.ownership, OWNERSHIP_OPTIONS);
      requiredOption(errors, `${prefix}.plateType`, vehicle.plateType, PLATE_TYPES);
      for (const field of ['make', 'model', 'plateNumber']) requiredText(errors, `${prefix}.${field}`, vehicle[field], FIELD_LIMITS[`vehicles.${field}`]);
      if (!/^\d{4}$/.test(vehicle.year)) errors[`${prefix}.year`] = 'Enter a four-digit year.';
      if (!VIN_PATTERN.test(vehicle.vin)) errors[`${prefix}.vin`] = 'Enter a 17-character VIN without I, O, or Q.';
      if (!stateIds.has(vehicle.plateState)) errors[`${prefix}.plateState`] = 'Choose the plate state from the list.';
      if (vehicle.ownership === 'Lease') {
        requiredText(errors, `${prefix}.lessorName`, vehicle.lessorName, 100);
        requiredDate(errors, `${prefix}.leaseStart`, vehicle.leaseStart);
        requiredDate(errors, `${prefix}.leaseEnd`, vehicle.leaseEnd);
      }
    });
  }
  if (stepId === 'business') {
    requiredOption(errors, 'business.structure', business.structure, BUSINESS_STRUCTURES);
    for (const field of ['legalName', 'ein', 'contactName', 'title']) requiredText(errors, `business.${field}`, business[field], FIELD_LIMITS[`business.${field}`]);
    if (business.dba.length > 150) errors['business.dba'] = 'Use 150 characters or fewer.';
    if (!/^\d{4}$/.test(business.yearEstablished)) errors['business.yearEstablished'] = 'Enter a four-digit year.';
    requiredOption(errors, 'business.authorized', business.authorized, AUTHORIZATION_OPTIONS);
    // Issuing country / authority are retained source data, not required UI fields.
  }
  if (stepId === 'fleets') {
    if (!current.fleets.length) errors.fleets = 'Add at least one fleet association.';
    current.fleets.forEach((fleet, index) => {
      const prefix = `fleets.${index}`;
      requiredText(errors, `${prefix}.name`, fleet.name, 150);
      requiredText(errors, `${prefix}.code`, fleet.code, 30);
      requiredOption(errors, `${prefix}.relationship`, fleet.relationship, FLEET_RELATIONSHIPS);
      if (fleet.relationship === 'Other') requiredText(errors, `${prefix}.other`, fleet.other, 100);
    });
  }
  if (['review', 'final', 'received'].includes(stepId)) {
    for (const id of applicationStepIds(current)) Object.assign(errors, validateStep(id, current, files, options).errors);
    if (!current.account.createdAt) errors['account.createdAt'] = 'Complete account setup before reviewing your application.';
    if (!current.certification.accepted) errors['certification.accepted'] = 'Accept the certification to continue.';
    if (stepId === 'received' && !current.submitted) errors.submitted = 'Submit the final application first.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function isStepComplete(stepId, state, files = {}, options = {}) {
  if (!stepIds.has(stepId)) return false;
  const current = normalizeState(state);
  if (!visibleStepIds(current).includes(stepId)) return true;
  if (stepId === 'account' && !current.account.createdAt) return false;
  if (['final', 'received'].includes(stepId) && current.submitted !== true) return false;
  return validateStep(stepId, current, files, options).valid;
}
export function completedStepIds(state, files = {}, options = {}) {
  return requiredStepIds(state).filter(id => isStepComplete(id, state, files, options));
}
export function progress(state, files = {}, options = {}) {
  const required = requiredStepIds(state);
  const completed = completedStepIds(state, files, options);
  return {
    complete: completed.length, total: required.length,
    percent: Math.round(completed.length / required.length * 100),
    completed, required, next: required.find(id => !completed.includes(id)) || 'received',
  };
}
export function progressPercent(state, files = {}, options = {}) { return progress(state, files, options).percent; }
export function checkPrerequisites(stepId, state, files = {}, options = {}) {
  const route = visibleStepIds(state);
  const index = route.indexOf(stepId);
  if (index < 0) return { allowed: false, missing: [], reason: 'not-applicable' };
  const missing = route.slice(0, index).filter(id => !isStepComplete(id, state, files, options));
  return { allowed: missing.length === 0, missing };
}

/** Return a new state with stale verification / certification milestones invalidated. */
export function invalidateAfterChange(previous, next, changedPaths = []) {
  const before = normalizeState(previous);
  const after = normalizeState(next);
  if (before.account.email !== after.account.email) {
    after.account.emailVerified = false;
    after.account.attempts = 0;
  }
  if (['email', 'password', 'confirmPassword'].some(field => before.account[field] !== after.account[field])) after.account.createdAt = null;
  if (before.jurisdiction.country !== after.jurisdiction.country) {
    after.jurisdiction.state = ''; after.jurisdiction.stateName = ''; after.jurisdiction.city = ''; after.jurisdiction.zip = '';
  } else if (before.jurisdiction.state !== after.jurisdiction.state) {
    after.jurisdiction.city = ''; after.jurisdiction.zip = '';
  }
  if (before.passport.image !== after.passport.image) after.passport.checks = {};
  const collectedSections = ['account', 'jurisdiction', 'identity', 'license', 'passport', 'roles', 'vehicles', 'business', 'fleets'];
  const collectedValue = (state, section) => section === 'vehicles'
    ? state.vehicles.map(({ _collapsed, ...vehicle }) => vehicle) : state[section];
  const changed = collectedSections.some(section => !same(collectedValue(before, section), collectedValue(after, section)))
    || changedPaths.some(path => CAPTURE_PATHS.includes(path));
  if (changed) {
    after.certification.accepted = false;
    after.submitted = false;
    after.submittedAt = null;
  }
  return after;
}

/** Optional browser-draft boundary. Secrets and capture contents remain in memory only. */
export function serializeDraft(state) {
  const draft = normalizeState(state);
  draft.account.password = '';
  draft.account.confirmPassword = '';
  draft.license.frontImage = null;
  draft.license.backImage = null;
  draft.passport.image = null;
  draft.passport.checks = {};
  draft.certification.accepted = false;
  draft.submitted = false;
  draft.submittedAt = null;
  return draft;
}
