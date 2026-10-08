import { visibleStepIds, checkPrerequisites, progress, isStepComplete } from './model.js';

const milestones = Object.freeze([
  { id: 'account', label: 'Account', steps: ['account', 'email'] },
  { id: 'profile', label: 'Profile', steps: ['jurisdiction', 'identity'] },
  { id: 'documents', label: 'Documents', steps: ['license-front', 'license-back', 'license-details', 'portrait'] },
  { id: 'operations', label: 'Operations', steps: ['roles', 'vehicles', 'business', 'fleets'] },
  { id: 'review', label: 'Review', steps: ['review', 'final'] },
]);

/** Resolve external / saved navigation against the currently applicable prerequisites. */
export function resolveStep(requested, state, files = {}) {
  const route = visibleStepIds(state);
  if (route.includes(requested) && checkPrerequisites(requested, state, files).allowed) return requested;
  return progress(state, files).next;
}

/** Navigation order only. The controller validates the current step before advancing. */
export function nextStep(current, state) {
  const route = visibleStepIds(state);
  const index = route.indexOf(current);
  return index >= 0 ? route[index + 1] || null : null;
}

export function previousStep(current, state) {
  const route = visibleStepIds(state);
  const index = route.indexOf(current);
  return index > 0 ? route[index - 1] : null;
}

/** Five compact progress groups without adding or hiding any collected application fields. */
export function milestoneProgress(state, files = {}) {
  const route = visibleStepIds(state);
  return milestones.map(milestone => {
    const steps = milestone.steps.filter(step => route.includes(step));
    const pending = steps.filter(step => !isStepComplete(step, state, files));
    return {
      id: milestone.id,
      label: milestone.label,
      steps,
      complete: pending.length === 0,
      target: pending[0] || steps[0],
    };
  });
}
