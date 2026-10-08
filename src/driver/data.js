// Options and fields from the supplied Stage 1 driver application demo.
export const COUNTRIES = Object.freeze([
  { code: 'US', name: 'United States', supported: true },
  { code: 'CA', name: 'Canada', supported: false },
  { code: 'GB', name: 'United Kingdom', supported: false },
  { code: 'AU', name: 'Australia', supported: false },
  { code: 'MX', name: 'Mexico', supported: false },
]);

export const STATES = Object.freeze([
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
]);

export const CITIES = Object.freeze({
  CA: ['Los Angeles', 'Los Angeles County', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno', 'Long Beach', 'Oakland', 'Beverly Hills'],
  NY: ['New York', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'],
  TX: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'Naples'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Springfield', 'Peoria'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Bellevue', 'Everett'],
  MA: ['Boston', 'Cambridge', 'Worcester', 'Springfield', 'Lowell'],
  GA: ['Atlanta', 'Savannah', 'Augusta', 'Athens', 'Macon'],
  NV: ['Las Vegas', 'Reno', 'Henderson', 'Paradise'],
  NJ: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison'],
});
export const DEFAULT_CITIES = Object.freeze(['Springfield', 'Riverside', 'Fairview', 'Georgetown', 'Salem', 'Madison', 'Clinton', 'Arlington']);

export const ROLES = Object.freeze([
  { id: 'id', title: 'Independent Driver', desc: '1099 contractor, owns or leases a personal or non-commercial vehicle.' },
  { id: 'cl', title: 'Chauffeur — Fleet Lease', desc: 'Leases a vehicle from a fleet and operates under that fleet.' },
  { id: 'lb', title: 'Livery Business', desc: 'Commercial licensed operator, regulated by state or city.' },
  { id: 'w2', title: 'W2 Chauffeur', desc: 'Employed by a fleet as a W2 employee with an assigned vehicle.' },
]);
export const SEX_OPTIONS = Object.freeze(['Male', 'Female', 'Other']);
export const OWNERSHIP_OPTIONS = Object.freeze(['Own', 'Lease']);
export const PLATE_TYPES = Object.freeze(['Regular', 'Commercial']);
export const BUSINESS_STRUCTURES = Object.freeze(['Corporation', 'LLC', 'Partnership', 'Sole Proprietorship', 'Other']);
export const AUTHORIZATION_OPTIONS = Object.freeze(['Yes', 'No']);
export const FLEET_RELATIONSHIPS = Object.freeze(['Lease vehicle from fleet', 'W2 employee of fleet', 'Other']);

export const STEPS = Object.freeze([
  { id: 'account', title: 'Create Your Account', group: 'Account' },
  { id: 'email', title: 'Verify Your Email', group: 'Account' },
  { id: 'jurisdiction', title: 'Jurisdiction', group: 'Jurisdiction' },
  { id: 'identity', title: 'Personal Identity', group: 'Identity' },
  { id: 'license-front', title: 'Driver License Front', group: 'License' },
  { id: 'license-back', title: 'Driver License Back', group: 'License' },
  { id: 'license-details', title: 'License Details', group: 'License' },
  { id: 'portrait', title: 'Passport-Style Photo', group: 'Identity' },
  { id: 'roles', title: 'Role Selection', group: 'Roles' },
  { id: 'vehicles', title: 'Vehicle List', group: 'Vehicles' },
  { id: 'business', title: 'Business Information', group: 'Business' },
  { id: 'fleets', title: 'Fleet Association', group: 'Fleet' },
  { id: 'review', title: 'Review & Submit', group: 'Review' },
  { id: 'final', title: 'Final Submission Checklist', group: 'Review' },
  { id: 'received', title: 'Application Received', group: 'Review' },
]);
export const GROUP_ORDER = Object.freeze(['Account', 'Jurisdiction', 'Identity', 'License', 'Roles', 'Vehicles', 'Business', 'Fleet', 'Review']);
export const SOURCE_STEP_IDS = Object.freeze(Object.fromEntries(STEPS.map((step, index) => [`1.${index + 1}`, step.id])));
export const CAPTURE_PATHS = Object.freeze(['license.frontImage', 'license.backImage', 'passport.image']);
export const DEMO_EMAIL_CODE_LENGTH = 6;
export const DEMO_EMAIL_RESEND_SECONDS = 30;
export const DEMO_EMAIL_CODE_MINUTES = 10;

export const FIELD_LIMITS = Object.freeze({
  'account.email': 254, 'account.password': 64, 'account.confirmPassword': 64,
  'identity.firstName': 50, 'identity.middleInitial': 1, 'identity.lastName': 50,
  'license.number': 15,
  'vehicles.make': 50, 'vehicles.model': 50, 'vehicles.year': 4, 'vehicles.vin': 17,
  'vehicles.plateNumber': 10, 'vehicles.lessorName': 100,
  'business.legalName': 150, 'business.dba': 150, 'business.yearEstablished': 4,
  'business.ein': 30, 'business.contactName': 100, 'business.title': 100,
  'fleets.name': 150, 'fleets.code': 30, 'fleets.other': 100,
});

export function citiesForState(code) { return CITIES[code] || DEFAULT_CITIES; }
export function stateName(code) { return STATES.find(state => state.code === code)?.name || ''; }
export function countryName(code) { return COUNTRIES.find(country => country.code === code)?.name || ''; }
