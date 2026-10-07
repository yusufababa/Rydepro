const landing = document.querySelector('#landing');
const waitlist = document.querySelector('#waitlist');
const dialog = document.querySelector('#confirmation');
const form = document.querySelector('#waitlist-form');
let previousFocus;

function showPage() {
  const isWaitlist = location.hash === '#waitlist';
  landing.hidden = isWaitlist;
  waitlist.hidden = !isWaitlist;
  document.body.classList.toggle('waitlist-page', isWaitlist);
  document.title = isWaitlist ? 'Join the waitlist — RYDEPRO' : 'RYDEPRO — Every ride. Elevated.';
  if (isWaitlist) {
    window.scrollTo(0, 0);
    document.querySelector('#back-home').focus({ preventScroll: true });
  }
}
document.querySelectorAll('[data-waitlist]').forEach(button => button.addEventListener('click', () => { location.hash = 'waitlist'; }));
document.querySelector('#back-home').addEventListener('click', () => { location.hash = ''; window.scrollTo(0, 0); });
window.addEventListener('hashchange', showPage);
showPage();
document.querySelector('#year').textContent = new Date().getFullYear();

const vehicleClasses = {
  premium: { title: 'Premium Sedan', subtitle: 'THE EVERYDAY, UPGRADED', description: 'A refined ride for airport transfers, everyday travel, and everything in between.', passengers: '3', luggage: 'Varies' },
  executive: { title: 'Executive Class', subtitle: 'BUSINESS, BEAUTIFULLY HANDLED', description: 'Professional transportation with discretion, comfort, and consistency for business travel.', passengers: 'Varies', luggage: 'Varies' },
  luxury: { title: 'Luxury Class', subtitle: 'FOR THE EXCEPTIONAL', description: 'An elevated travel experience for special occasions and journeys that call for something more.', passengers: 'Varies', luggage: 'Varies' },
  commercial: { title: 'Commercial Buses', subtitle: 'EVERYONE, TOGETHER', description: 'Coordinated group transportation for events, conferences, and corporate roadshows.', passengers: 'Varies', luggage: 'Varies' },
};
const fleetTabs = [...document.querySelectorAll('[data-fleet]')];
const fleetTypeButtons = document.querySelector('#fleet-types');
const typesByClass = {
  premium: ['sedan', 'e-sedan', 'minivan'],
  executive: ['sedan', 'e-sedan', 'suv'],
  luxury: ['sedan', 'e-sedan', 'suv'],
  commercial: ['bus'],
};
const typeLabels = { sedan: 'Sedan', 'e-sedan': 'E-Sedan', minivan: 'Minivan', suv: 'SUV', bus: 'Bus' };
let activeFleetClass = 'premium';
const selectedTypes = { premium: 'sedan', executive: 'sedan', luxury: 'sedan', commercial: 'bus' };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const fleetSection = document.querySelector('#fleet');
const fleetPlay = document.querySelector('#fleet-play');
const showcase = Object.entries(typesByClass).flatMap(([category, types]) => types.map(type => ({ category, type })));
const cycleDuration = 5000;
let autoplay = !reducedMotion.matches;
let fleetVisible = false;
let cycleTimer;
let progressAnimation;
function syncPlayback() {
  clearInterval(cycleTimer);
  progressAnimation?.cancel();
  fleetPlay.textContent = autoplay ? 'Pause' : 'Play';
  fleetPlay.setAttribute('aria-label', `${autoplay ? 'Pause' : 'Play'} automatic fleet showcase`);
  const running = autoplay && fleetVisible && !document.hidden && !landing.hidden;
  if (!running) return;
  const fill = document.querySelector('#fleet-progress-fill');
  if (!reducedMotion.matches) progressAnimation = fill.animate?.([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: cycleDuration, iterations: Infinity });
  cycleTimer = setInterval(() => advanceFleet(1, false), cycleDuration);
}
function restartPlaybackCycle() {
  syncPlayback();
}
function renderVehicle() {
  const vehicle = vehicleClasses[activeFleetClass];
  const selectedType = selectedTypes[activeFleetClass];
  const classLabel = { premium: 'Premium', executive: 'Executive', luxury: 'Luxury', commercial: 'Commercial' }[activeFleetClass];
  document.querySelector('#fleet-title').textContent = `${classLabel} ${typeLabels[selectedType]}`;
  document.querySelector('#fleet-subtitle').textContent = vehicle.subtitle;
  document.querySelector('#fleet-description').textContent = vehicle.description;
  document.querySelector('#fleet-passengers').textContent = activeFleetClass === 'premium' && selectedType === 'sedan' ? '3' : 'Varies';
  document.querySelector('#fleet-luggage').textContent = vehicle.luggage;
  const position = showcase.findIndex(item => item.category === activeFleetClass && item.type === selectedType);
  document.querySelector('#fleet-position').textContent = `${position + 1} of ${showcase.length}`;
  if (!reducedMotion.matches) {
    for (const selector of ['.fleet-copy', '.fleet-specs']) {
      const element = document.querySelector(selector);
      element.getAnimations?.().forEach(animation => animation.cancel());
      element.animate?.([{ opacity: .2, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 380, easing: 'ease-out' });
    }
  }
}
function selectFleet(tab, manual = true) {
  if (manual) restartPlaybackCycle();
  fleetTabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  activeFleetClass = tab.dataset.fleet;
  fleetTypeButtons.replaceChildren(...typesByClass[activeFleetClass].map(type => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.type = type;
    button.textContent = typeLabels[type];
    button.setAttribute('aria-pressed', String(type === selectedTypes[activeFleetClass]));
    button.addEventListener('click', () => {
      restartPlaybackCycle();
      selectedTypes[activeFleetClass] = type;
      fleetTypeButtons.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.type === type)));
      renderVehicle();
      document.querySelector('#fleet-announcement').textContent = document.querySelector('#fleet-title').textContent;
    });
    return button;
  }));
  renderVehicle();
  document.querySelector('#fleet-panel').setAttribute('aria-labelledby', tab.id);
  if (manual) document.querySelector('#fleet-announcement').textContent = document.querySelector('#fleet-title').textContent;
}
function advanceFleet(direction, manual = true) {
  if (manual) restartPlaybackCycle();
  const position = showcase.findIndex(item => item.category === activeFleetClass && item.type === selectedTypes[activeFleetClass]);
  const next = showcase[(position + direction + showcase.length) % showcase.length];
  selectedTypes[next.category] = next.type;
  selectFleet(fleetTabs.find(tab => tab.dataset.fleet === next.category), false);
  if (manual) document.querySelector('#fleet-announcement').textContent = document.querySelector('#fleet-title').textContent;
}
fleetTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectFleet(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % fleetTabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + fleetTabs.length) % fleetTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = fleetTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectFleet(fleetTabs[next]);
    fleetTabs[next].focus();
  });
});
document.querySelector('#fleet-previous').addEventListener('click', () => advanceFleet(-1));
document.querySelector('#fleet-next').addEventListener('click', () => advanceFleet(1));
fleetPlay.addEventListener('click', () => { autoplay = !autoplay; syncPlayback(); });
document.addEventListener('visibilitychange', syncPlayback);
window.addEventListener('hashchange', syncPlayback);
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) autoplay = false; syncPlayback(); });
new IntersectionObserver(entries => {
  fleetVisible = entries[0].isIntersecting;
  syncPlayback();
}, { threshold: 0 }).observe(document.querySelector('#fleet-panel'));
selectFleet(fleetTabs[0], false);
syncPlayback();

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(data)) data[key] = data[key].trim();
  if (!data.name || !data.city || !data.state || !data.postal) {
    const field = ['name', 'city', 'state', 'postal'].find(key => !data[key]);
    form.elements[field].setCustomValidity('Please enter a value.');
    form.elements[field].reportValidity();
    return;
  }
  // Prototype storage only. Replace with a server-side subscription endpoint for launch.
  try { localStorage.setItem('rydepro.waitlist', JSON.stringify({ ...data, joinedAt: new Date().toISOString() })); } catch { /* The preview also works with storage disabled. */ }
  document.querySelector('#confirmed-name').textContent = data.name.split(' ')[0];
  document.querySelector('#confirmed-city').textContent = data.city;
  document.querySelector('#confirmed-email').textContent = data.email;
  previousFocus = document.activeElement;
  dialog.showModal();
  document.body.classList.add('modal-open');
});
form.addEventListener('input', event => { event.target.setCustomValidity?.(''); });
document.querySelector('#close-confirmation').addEventListener('click', () => { dialog.close(); form.reset(); location.hash = ''; window.scrollTo(0, 0); });
dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); previousFocus?.focus({ preventScroll: true }); });
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

const footerInfo = document.querySelector('#footer-info');
document.querySelectorAll('[data-footer-page]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('#footer-info-title').textContent = button.textContent;
  footerInfo.showModal();
}));
document.querySelector('#close-footer-info').addEventListener('click', () => footerInfo.close());
footerInfo.addEventListener('click', event => { if (event.target === footerInfo) footerInfo.close(); });
