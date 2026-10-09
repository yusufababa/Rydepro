/** Approved vehicle options within each fleet class. */
export const fleetClasses = Object.freeze({
  premium: {
    subtitle: 'THE EVERYDAY, UPGRADED',
    vehicles: [
      { title: 'Premium Sedan', option: 'Sedan', passengers: '3', luggage: 'Varies', description: 'A refined ride for airport transfers, everyday travel, and everything in between.' },
      { title: 'Premium E-Sedan', option: 'E-Sedan', passengers: '3', luggage: 'Varies', description: 'Quiet electric comfort with the same professional standard for your everyday journeys.' },
      { title: 'Premium Minivan', option: 'Minivan', passengers: '5', luggage: 'Varies', description: 'More room for family, friends, and luggage, with comfort at every stage of your journey.' },
    ],
  },
  executive: {
    subtitle: 'BUSINESS, BEAUTIFULLY HANDLED',
    vehicles: [
      { title: 'Executive Sedan', option: 'Sedan', passengers: '3', luggage: 'Varies', description: 'Considered comfort, quiet space, and a professional standard for your business journeys.' },
      { title: 'Executive E-Sedan', option: 'E-Sedan', passengers: '3', luggage: 'Varies', description: 'A quiet electric journey with the comfort and consistency your business travel deserves.' },
      { title: 'Executive SUV', option: 'SUV', passengers: '6', luggage: 'Varies', description: 'Generous space for colleagues and companions, with a professional standard for every journey.' },
    ],
  },
  luxury: {
    subtitle: 'FOR THE EXCEPTIONAL',
    vehicles: [
      { title: 'Luxury Sedan', option: 'Sedan', passengers: '3', luggage: 'Varies', description: 'An elevated sedan experience for special occasions and journeys that call for something more.' },
      { title: 'Luxury E-Sedan', option: 'E-Sedan', passengers: '3', luggage: 'Varies', description: 'Quiet electric comfort and a refined arrival for journeys that deserve something exceptional.' },
      { title: 'Luxury SUV', option: 'SUV', passengers: '6', luggage: 'Varies', description: 'Generous space, refined comfort, and a distinctive arrival for up to six passengers.' },
    ],
  },
  commercial: {
    subtitle: 'EVERYONE, TOGETHER',
    vehicles: [
      { title: 'Commercial Bus', option: 'Bus', passengers: '14', luggage: 'Varies', description: 'Travel together with coordinated group transportation for events, conferences, and roadshows.' },
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
  const options = section.querySelector('#fleet-options');
  const tabs = [...section.querySelectorAll('[data-fleet]')].filter(tab => fleetClasses[tab.dataset.fleet]);
  const keys = tabs.map(tab => tab.dataset.fleet);
  const fields = Object.fromEntries(['title', 'subtitle', 'description', 'passengers', 'luggage']
    .map(name => [name, section.querySelector(`#fleet-${name}`)]));
  const announcement = section.querySelector('#fleet-announcement');
  if (!panel || !options || !tabs.length || Object.values(fields).some(field => !field)) return null;

  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const removers = [];
  const cycleDuration = 5000;
  let activeKey = keys[0];
  let activeVehicleIndex = 0;
  let displayedOptionsKey;
  let visible = false;
  let keyboardInteraction = false;
  let timer;
  let destroyed = false;

  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    removers.push(() => target.removeEventListener(type, handler));
  }

  function canRotate() {
    return !destroyed && visible && !doc.hidden && !motion.matches
      && !root.querySelector('#landing')?.hidden
      && !(keyboardInteraction && section.contains(doc.activeElement));
  }

  function syncTimer() {
    view.clearTimeout(timer);
    if (!canRotate()) return;
    timer = view.setTimeout(() => {
      if (!canRotate()) return;
      const nextIndex = activeVehicleIndex + 1;
      if (nextIndex < fleetClasses[activeKey].vehicles.length) selectVehicle(activeKey, nextIndex, false);
      else selectVehicle(keys[(keys.indexOf(activeKey) + 1) % keys.length], 0, false);
    }, cycleDuration);
  }

  function renderOptions(key, vehicleIndex) {
    if (displayedOptionsKey !== key) {
      options.setAttribute('role', 'group');
      options.setAttribute('aria-label', 'Vehicle type');
      options.replaceChildren(...fleetClasses[key].vehicles.map((vehicle, index) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'fleet-option';
        button.dataset.vehicleIndex = String(index);
        button.textContent = vehicle.option;
        return button;
      }));
      displayedOptionsKey = key;
    }
    [...options.children].forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === vehicleIndex));
    });
  }

  function renderVehicle(key, vehicleIndex, animate) {
    const vehicle = fleetClasses[key].vehicles[vehicleIndex];
    activeKey = key;
    activeVehicleIndex = vehicleIndex;
    for (const [name, element] of Object.entries(fields)) {
      element.textContent = name === 'subtitle' ? fleetClasses[key].subtitle : vehicle[name];
    }
    renderOptions(key, vehicleIndex);
    tabs.forEach(tab => {
      const selected = tab.dataset.fleet === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) panel.setAttribute('aria-labelledby', tab.id);
    });

    if (animate && !motion.matches) {
      for (const element of [section.querySelector('.fleet-copy'), section.querySelector('.fleet-specs')]) {
        element?.getAnimations?.().forEach(animation => animation.cancel());
        element?.animate?.([
          { opacity: .12, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)' });
      }
    }
  }

  function selectVehicle(key, vehicleIndex = 0, manual = true) {
    const vehicle = fleetClasses[key]?.vehicles[vehicleIndex];
    if (!vehicle || !keys.includes(key) || destroyed) return;
    view.clearTimeout(timer);
    const changed = key !== activeKey || vehicleIndex !== activeVehicleIndex;
    renderVehicle(key, vehicleIndex, changed);
    if (manual && announcement) announcement.textContent = vehicle.title;
    syncTimer();
  }

  function selectClass(key, manual = true) { return selectVehicle(key, 0, manual); }

  listen(options, 'click', event => {
    const button = event.target.closest('button[data-vehicle-index]');
    if (button && options.contains(button)) {
      selectVehicle(activeKey, Number(button.dataset.vehicleIndex));
    }
  });

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

  renderVehicle(activeKey, activeVehicleIndex, false);

  let observer;
  if (view.IntersectionObserver) {
    observer = new view.IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      syncTimer();
    }, { threshold: .1 });
    observer.observe(panel);
  } else {
    visible = true;
    syncTimer();
  }

  return {
    select: selectClass,
    get activeClass() { return activeKey; },
    get activeVehicle() { return fleetClasses[activeKey].vehicles[activeVehicleIndex]; },
    destroy() {
      destroyed = true;
      view.clearTimeout(timer);
      observer?.disconnect();
      removers.forEach(remove => remove());
    },
  };
}

if (typeof document !== 'undefined') initFleet();
