// MOSP design system: Auto Apply Controls.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Auto-apply filters (shared pattern)
// ---------------------------------------------------------------------------

/**
 * Binds inputs/selects to an "apply" handler.
 * - If `autoApplyCheckbox` is present, auto-apply is enabled when it is checked.
 * - If not present, auto-apply is always enabled.
 *
 * Options:
 * - debounceMs: default 250
 * - events: array of event names to listen to (default: ['change', 'input'])
 */
export function bindAutoApply({root = document, controls = [], apply, autoApplyCheckbox = null, debounceMs = 250, events = null}) {
  if (typeof apply !== 'function') return null;

  const evs = Array.isArray(events) && events.length ? events : ['change', 'input'];
  const debounced = debounce(() => apply(), debounceMs);

  const shouldAuto = () => {
    if (!autoApplyCheckbox) return true;
    return !!autoApplyCheckbox.checked;
  };

  const handler = () => {
    if (!shouldAuto()) return;
    debounced();
  };

  for (const el of controls) {
    if (!el) continue;
    for (const ev of evs) el.addEventListener(ev, handler);
  }

  return {trigger: handler, cancel: () => debounced.cancel?.()};
}
