/** Approved vehicle options within each fleet class. */
export const fleetClasses = Object.freeze({
  premium: {
    subtitle: 'THE EVERYDAY, UPGRADED',
    vehicles: [
      { title: 'Premium Sedan', option: 'Sedan', passengers: '3', luggage: 'Varies', image: '/assets/fleet/premium.webp', alt: 'Illustration of a black premium sedan', description: 'A refined ride for airport transfers, everyday travel, and everything in between.' },
      { title: 'Premium E-Sedan', option: 'E-Sedan', passengers: '3', luggage: 'Varies', image: '/assets/fleet/electric.webp', alt: 'Illustration of a black premium electric sedan', description: 'Quiet electric comfort with the same professional standard for your everyday journeys.' },
      { title: 'Premium Minivan', option: 'Minivan', passengers: '5', luggage: 'Varies', image: '/assets/fleet/minivan.webp', alt: 'Illustration of a black premium minivan', description: 'More room for family, friends, and luggage, with comfort at every stage of your journey.' },
    ],
  },
  executive: {
    subtitle: 'BUSINESS, BEAUTIFULLY HANDLED',
    vehicles: [
      { title: 'Executive Sedan', option: 'Sedan', passengers: '3', luggage: 'Varies', image: '/assets/fleet/executive.webp', alt: 'Illustration of a black executive sedan', description: 'Considered comfort, quiet space, and a professional standard for your business journeys.' },
      { title: 'Executive E-Sedan', option: 'E-Sedan', passengers: '3', luggage: 'Varies', image: '/assets/fleet/electric.webp', alt: 'Illustration of a black executive electric sedan', description: 'A quiet electric journey with the comfort and consistency your business travel deserves.' },
      { title: 'Executive SUV', option: 'SUV', passengers: '6', luggage: 'Varies', image: '/assets/fleet/luxury.webp', alt: 'Illustration of a black executive SUV', description: 'Generous space for colleagues and companions, with a professional standard for every journey.' },
    ],
  },
  luxury: {
    subtitle: 'FOR THE EXCEPTIONAL',
    vehicles: [
      { title: 'Luxury Sedan', option: 'Sedan', passengers: '3', luggage: 'Varies', image: '/assets/fleet/executive.webp', alt: 'Illustration of a black luxury sedan', description: 'An elevated sedan experience for special occasions and journeys that call for something more.' },
      { title: 'Luxury E-Sedan', option: 'E-Sedan', passengers: '3', luggage: 'Varies', image: '/assets/fleet/electric.webp', alt: 'Illustration of a black luxury electric sedan', description: 'Quiet electric comfort and a refined arrival for journeys that deserve something exceptional.' },
      { title: 'Luxury SUV', option: 'SUV', passengers: '6', luggage: 'Varies', image: '/assets/fleet/luxury.webp', alt: 'Illustration of a black luxury SUV', description: 'Generous space, refined comfort, and a distinctive arrival for up to six passengers.' },
    ],
  },
  commercial: {
    subtitle: 'EVERYONE, TOGETHER',
    vehicles: [
      { title: 'Commercial Bus', option: 'Bus', passengers: '14', luggage: 'Varies', image: '/assets/fleet/commercial.webp', alt: 'Illustration of a black commercial bus', description: 'Travel together with coordinated group transportation for events, conferences, and roadshows.' },
    ],
  },
});

/** Initialize the accessible, automatic fleet showcase. Returns a cleanup handle. */
export function initFleet(root = document) {
  const section = root.querySelector('#fleet');
  if (!section) return null;

  const doc = section.ownerDocument;
  const view = doc.defaultView;
  const panel = section.querySelector('#fleet-panel');
  const image = section.querySelector('#fleet-image');
  const visual = section.querySelector('.fleet-visual');
  const options = section.querySelector('#fleet-options');
  const tabs = [...section.querySelectorAll('[data-fleet]')];
  const keys = tabs.map(tab => tab.dataset.fleet);
  const fields = Object.fromEntries(['title', 'subtitle', 'description', 'passengers', 'luggage']
    .map(name => [name, section.querySelector(`#fleet-${name}`)]));
  const announcement = section.querySelector('#fleet-announcement');
  if (!panel || !image || !visual || !tabs.length || Object.values(fields).some(field => !field)) return null;

  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const removers = [];
  const imageLoads = new Map();
  const cycleDuration = 5000;
  let activeKey = keys.find(key => fleetClasses[key]) || 'premium';
  let activeVehicleIndex = 0;
  let displayedOptionsKey;
  let visible = false;
  let keyboardInteraction = false;
  let timer;
  let requestId = 0;
  let destroyed = false;

  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    removers.push(() => target.removeEventListener(type, handler));
  }

  function keyboardFocusInside() {
    return keyboardInteraction && section.contains(doc.activeElement);
  }

  function canRotate() {
    return !destroyed && visible && !doc.hidden && !motion.matches
      && !root.querySelector('#landing')?.hidden && !keyboardFocusInside();
  }

  function syncTimer() {
    view.clearTimeout(timer);
    if (!canRotate()) return;
    timer = view.setTimeout(async () => {
      if (!canRotate()) return;
      const nextIndex = activeVehicleIndex + 1;
      if (nextIndex < fleetClasses[activeKey].vehicles.length) await selectVehicle(activeKey, nextIndex, false);
      else await selectVehicle(keys[(keys.indexOf(activeKey) + 1) % keys.length], 0, false);
      syncTimer();
    }, cycleDuration);
  }

  // Images are fetched only once, as the showcase enters view or a class is selected.
  // Decode the next image before swapping so the outgoing vehicle never flashes away.
  function preloadImage(src) {
    if (imageLoads.has(src)) return imageLoads.get(src);
    const loading = new Promise(resolve => {
      const nextImage = new view.Image();
      nextImage.decoding = 'async';
      nextImage.fetchPriority = 'low';
      let settled = false;
      const timeout = view.setTimeout(() => finish(false), 8000);
      function finish(ok) {
        if (settled) return;
        settled = true;
        view.clearTimeout(timeout);
        resolve(ok);
      }
      nextImage.onload = async () => {
        try { await nextImage.decode?.(); } catch { /* A loaded image can still be displayed. */ }
        finish(true);
      };
      nextImage.onerror = () => finish(false);
      nextImage.src = src;
    });
    imageLoads.set(src, loading);
    return loading;
  }

  function renderOptions(key, vehicleIndex) {
    if (!options) return;
    if (displayedOptionsKey !== key) {
      options.setAttribute('role', 'list');
      options.replaceChildren(...fleetClasses[key].vehicles.map((vehicle, index) => {
        const tile = doc.createElement('div');
        tile.className = 'fleet-option';
        tile.dataset.vehicleIndex = String(index);
        tile.setAttribute('role', 'listitem');
        const name = doc.createElement('strong');
        name.textContent = vehicle.option;
        const capacity = doc.createElement('span');
        capacity.textContent = `Up to ${vehicle.passengers} passengers`;
        const status = doc.createElement('small');
        status.className = 'fleet-option-status';
        status.textContent = 'Showing now';
        tile.append(name, capacity, status);
        return tile;
      }));
      displayedOptionsKey = key;
    }
    [...options.children].forEach((tile, index) => {
      const active = index === vehicleIndex;
      tile.dataset.active = String(active);
      if (active) tile.setAttribute('aria-current', 'true');
      else tile.removeAttribute('aria-current');
    });
  }

  function renderVehicle(key, vehicleIndex, loaded, animate) {
    const vehicle = fleetClasses[key].vehicles[vehicleIndex];
    visual.querySelectorAll('.fleet-image-outgoing').forEach(element => element.remove());
    const crossfade = loaded && animate && !motion.matches && visual.classList.contains('has-vehicle-image')
      && image.getAttribute('src') !== vehicle.image;
    const outgoingImage = crossfade ? image.cloneNode(false) : null;
    if (outgoingImage) {
      outgoingImage.removeAttribute('id');
      outgoingImage.alt = '';
      outgoingImage.setAttribute('aria-hidden', 'true');
      outgoingImage.className = 'fleet-image-outgoing';
      visual.append(outgoingImage);
    }
    activeKey = key;
    activeVehicleIndex = vehicleIndex;
    for (const [name, element] of Object.entries(fields)) element.textContent = name === 'subtitle' ? fleetClasses[key].subtitle : vehicle[name];
    renderOptions(key, vehicleIndex);
    tabs.forEach(tab => {
      const selected = tab.dataset.fleet === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) panel.setAttribute('aria-labelledby', tab.id);
    });

    image.alt = vehicle.alt;
    if (loaded !== null) {
      visual.classList.toggle('has-vehicle-image', loaded);
      if (loaded) image.src = vehicle.image;
    }
    if (animate && !motion.matches) {
      for (const element of [section.querySelector('.fleet-copy'), section.querySelector('.fleet-specs')]) {
        element?.getAnimations?.().forEach(animation => animation.cancel());
        element?.animate?.([
          { opacity: .12, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)' });
      }
      image.getAnimations?.().forEach(animation => animation.cancel());
      if (loaded) image.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
      if (outgoingImage) {
        const animation = outgoingImage.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
        if (animation?.finished) animation.finished.then(() => outgoingImage.remove(), () => outgoingImage.remove());
        else outgoingImage.remove();
      }
    }
  }

  async function selectVehicle(key, vehicleIndex = 0, manual = true) {
    const vehicle = fleetClasses[key]?.vehicles[vehicleIndex];
    if (!vehicle || destroyed) return;
    view.clearTimeout(timer);
    const currentRequest = ++requestId;
    const changed = key !== activeKey || vehicleIndex !== activeVehicleIndex;
    panel.setAttribute('aria-busy', 'true');
    const loaded = await preloadImage(vehicle.image);
    if (currentRequest !== requestId || destroyed) return;
    renderVehicle(key, vehicleIndex, loaded, changed);
    panel.removeAttribute('aria-busy');
    if (manual && announcement) announcement.textContent = vehicle.title;
    syncTimer();
  }

  function selectClass(key, manual = true) { return selectVehicle(key, 0, manual); }

  tabs.forEach((tab, index) => {
    listen(tab, 'click', () => selectClass(tab.dataset.fleet));
    listen(tab, 'keydown', event => {
      let nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === undefined) return;
      event.preventDefault();
      keyboardInteraction = true;
      tabs[nextIndex].focus();
      selectClass(tabs[nextIndex].dataset.fleet);
    });
  });

  listen(doc, 'keydown', () => { keyboardInteraction = true; syncTimer(); });
  listen(doc, 'pointerdown', () => { keyboardInteraction = false; syncTimer(); });
  listen(section, 'focusin', syncTimer);
  listen(section, 'focusout', () => view.setTimeout(syncTimer, 0));
  listen(doc, 'visibilitychange', syncTimer);
  listen(view, 'hashchange', syncTimer);
  listen(motion, 'change', syncTimer);
  listen(image, 'load', () => {
    if (image.getAttribute('src') === fleetClasses[activeKey].vehicles[activeVehicleIndex].image) visual.classList.add('has-vehicle-image');
  });
  listen(image, 'error', () => visual.classList.remove('has-vehicle-image'));

  renderVehicle(activeKey, activeVehicleIndex, null, false);
  visual.classList.toggle('has-vehicle-image', image.complete && image.naturalWidth > 0);

  let observer;
  if (view.IntersectionObserver) {
    observer = new view.IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) selectVehicle(activeKey, activeVehicleIndex, false);
      else syncTimer();
    }, { threshold: .1 });
    observer.observe(panel);
  } else {
    visible = true;
    selectClass(activeKey, false);
  }

  return {
    select: selectClass,
    get activeClass() { return activeKey; },
    get activeVehicle() { return fleetClasses[activeKey].vehicles[activeVehicleIndex]; },
    destroy() {
      destroyed = true;
      requestId += 1;
      view.clearTimeout(timer);
      observer?.disconnect();
      removers.forEach(remove => remove());
    },
  };
}

if (typeof document !== 'undefined') initFleet();
