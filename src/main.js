import './fleet.js';

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
