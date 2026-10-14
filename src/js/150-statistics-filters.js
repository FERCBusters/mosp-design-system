// MOSP design system: Statistics Filters.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Statistics-style filter helpers
// ---------------------------------------------------------------------------

/**
 * Return today’s date as an ISO yyyy-mm-dd string.
 */
export function isoToday() {
  const dt = new Date();
  dt.setUTCHours(0, 0, 0, 0);
  return isoYmd(dt);
}

/**
 * Return the ISO yyyy-mm-dd date for a number of days before today.
 */
export function isoDaysAgo(days) {
  const dt = new Date();
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() - Number(days || 0));
  return isoYmd(dt);
}

/**
 * Format numeric values with a fixed maximum number of fraction digits.
 */
export function fmtMaybeNumber(v, fractionDigits = 0) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  } catch {
    return String(n);
  }
}

/**
 * Format a timestamp for Statistics-style date/time displays.
 */
export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return fmtTs(iso);
  }
}

/**
 * Replace the options inside a datalist element.
 */
export function setDatalistOptions(datalistEl, options) {
  if (!(datalistEl instanceof HTMLElement)) return;
  const opts = Array.isArray(options) ? options : [];
  datalistEl.innerHTML = opts.map((v) => `<option value="${esc(String(v ?? ''))}"></option>`).join('');
}

/**
 * Fetch distinct values for a table column for autocomplete use.
 */
export async function fetchDistinct(table, column, q = '', opts = {}) {
  const limit = Number(opts?.limit || 20);
  const mode = String(opts?.mode || 'contains');
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('limit', String(limit));
  params.set('mode', mode);
  return await apiGet(`/api/v1/meta/distinct/${encodeURIComponent(table)}/${encodeURIComponent(column)}?${params.toString()}`);
}

/**
 * Attach debounced distinct-value autocomplete to an input.
 */
export function attachDistinctAutocomplete(inputEl, datalistEl, opts = {}) {
  if (!(inputEl instanceof HTMLElement) || !(datalistEl instanceof HTMLElement)) return;
  const table = String(opts?.table || '');
  const column = String(opts?.column || '');
  if (!table || !column) return;

  const limit = Number(opts?.limit || 20);
  const mode = String(opts?.mode || 'contains');

  const load = debounce(async () => {
    try {
      const q = (inputEl.value || '').trim();
      const data = await fetchDistinct(table, column, q, {limit, mode});
      const items = (data && Array.isArray(data.items)) ? data.items : [];
      setDatalistOptions(datalistEl, items);
    } catch {
      // ignore
    }
  }, 250);

  inputEl.addEventListener('input', load);
  inputEl.addEventListener('focus', load);
}

/**
 * Attach MydexID autocomplete using the shared distinct-value helper.
 */
export function attachMydexidAutocomplete(inputEl, datalistEl) {
  return attachDistinctAutocomplete(inputEl, datalistEl, {table: 'pds', column: 'mydex_id', limit: 30, mode: 'contains'});
}

// ---------------------------------------------------------------------------
// Auto-apply filters
// ---------------------------------------------------------------------------

/**
 * Capture the current values of a filter form for change detection.
 */
function _autoApplySnapshot(form) {
  if (!(form instanceof HTMLFormElement)) return '';

  // IMPORTANT:
  // Many of our pages historically used `id` attributes without `name`.
  // FormData ignores fields without `name`, which would make the snapshot
  // appear unchanged and prevent auto-apply from triggering.
  //
  // So: include every enabled input/select/textarea using (name || id) as key.
  const items = [];

  const els = Array.from(form.elements || []);
  for (const el of els) {
    if (!(el instanceof HTMLElement)) continue;

    // Skip buttons and disabled controls
    if ('disabled' in el && el.disabled) continue;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'button') continue;

    const key = (el.getAttribute('name') || el.getAttribute('id') || '').trim();
    if (!key) continue;

    if (el instanceof HTMLInputElement) {
      const type = (el.type || '').toLowerCase();
      if (type in {'submit':1, 'reset':1, 'button':1, 'image':1, 'file':1, 'password':1}) {
        // password/file shouldn't influence auto-apply; buttons aren't fields.
        continue;
      }
      if (type === 'checkbox') {
        items.push([key, el.checked ? '1' : '0']);
        continue;
      }
      if (type === 'radio') {
        // Only include the checked radio in a group
        if (el.checked) items.push([key, String(el.value ?? '1')]);
        continue;
      }
      items.push([key, String(el.value ?? '')]);
      continue;
    }

    if (el instanceof HTMLSelectElement) {
      if (el.multiple) {
        const vals = Array.from(el.selectedOptions || []).map((o) => String(o.value ?? '')).sort();
        items.push([key, vals.join('\u0001')]);
      } else {
        items.push([key, String(el.value ?? '')]);
      }
      continue;
    }

    if (el instanceof HTMLTextAreaElement) {
      items.push([key, String(el.value ?? '')]);
      continue;
    }
  }

  items.sort((a, b) => (a[0] + '\u0000' + a[1]).localeCompare(b[0] + '\u0000' + b[1]));
  return JSON.stringify(items);
}

// Attach to a filter <form>. Auto-submit on changes, but only when the snapshot changes.
/**
 * Attach Statistics-style auto-submit behaviour to a filter form.
 */
export function attachAutoApply(form, opts = {}) {
  if (!(form instanceof HTMLFormElement)) return () => {};

  const delayMs = Number(opts?.delayMs ?? 350);
  const instantTypes = new Set(['checkbox', 'radio', 'date', 'datetime-local']);

  const isEnabled = () => {
    if (typeof opts?.enabled === 'boolean') return !!opts.enabled;
    if (typeof opts?.enabledFn === 'function') return !!opts.enabledFn();

    const cb = opts?.autoApplyCheckbox;
    if (cb) {
      const el = (typeof cb === 'string') ? document.querySelector(cb) : cb;
      if (el && typeof el === 'object' && 'checked' in el) return !!el.checked;
    }

    const fallback = (typeof opts?.defaultEnabled === 'boolean') ? !!opts.defaultEnabled : true;
    return getAutoApplyEnabled(opts?.cfgOverrides || null, fallback);
  };

  // ignore if data-no-auto-apply on element or in a button row
  const shouldIgnore = (el) => {
    if (!(el instanceof HTMLElement)) return true;
    if (el.closest('[data-no-auto-apply]')) return true;
    if (el.closest('.no-auto-apply')) return true;
    return false;
  };

  let timer = null;
  let lastSubmitted = _autoApplySnapshot(form);

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const submitIfChanged = () => {
    clearTimer();
    const snap = _autoApplySnapshot(form);
    if (snap === lastSubmitted) return;
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
  };

  const scheduleSubmit = (ms) => {
    clearTimer();
    if (!isEnabled()) return;
    timer = setTimeout(() => {
      timer = null;
      submitIfChanged();
    }, Math.max(0, Number(ms) || 0));
  };

  const onInput = (ev) => {
    const el = ev?.target;
    if (shouldIgnore(el)) return;
    const type = String(el.type || '').toLowerCase();
    if (instantTypes.has(type)) {
      // Tiny delay coalesces input+change from date pickers into one submit.
      scheduleSubmit(40);
      return;
    }
    scheduleSubmit(delayMs);
  };

  const onChange = (ev) => {
    const el = ev?.target;
    if (shouldIgnore(el)) return;
    const type = String(el.type || '').toLowerCase();
    if (instantTypes.has(type)) {
      scheduleSubmit(40);
      return;
    }
    scheduleSubmit(delayMs);
  };

  const onSubmit = () => {
    clearTimer();
    lastSubmitted = _autoApplySnapshot(form);
  };

  const onReset = () => {
    clearTimer();
    setTimeout(() => {
      lastSubmitted = _autoApplySnapshot(form);
    }, 0);
  };

  form.addEventListener('input', onInput);
  form.addEventListener('change', onChange);
  form.addEventListener('submit', onSubmit, {capture: true});
  form.addEventListener('reset', onReset);

  // If a preference toggle disables auto-apply while a timer is pending, cancel it.
  const onPrefChanged = () => {
    if (!isEnabled()) clearTimer();
  };
  try {
    window.addEventListener('mosp:auto-apply-changed', onPrefChanged);
  } catch {
    // ignore
  }

  return () => {
    clearTimer();
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onChange);
    form.removeEventListener('submit', onSubmit, {capture: true});
    form.removeEventListener('reset', onReset);
    try {
      window.removeEventListener('mosp:auto-apply-changed', onPrefChanged);
    } catch {
      // ignore
    }
  };
}

/**
 * Add an invert selection checkbox control for multi-select filter forms.
 */
export function ensureInvertSelectionControl(form, opts = {}) {
  if (!(form instanceof HTMLElement)) return null;

  const queryKey = String(opts?.queryKey || 'invert');
  const id = String(opts?.id || 'invertSelection');
  const label = String(opts?.label || 'Invert selection');
  const containerClass = String(opts?.containerClass || 'col-12');
  const insertBeforeSelector = String(opts?.insertBeforeSelector || '.col-12.d-flex.gap-2');

  let input = form.querySelector(`#${id}`);
  if (!input) {
    const container = document.createElement('div');
    container.className = containerClass;
    container.innerHTML = `
      <div class="form-check mt-1">
        <input class="form-check-input" type="checkbox" id="${id}" />
        <label class="form-check-label small-muted" for="${id}">${label}</label>
      </div>
    `;

    const target = form.querySelector(insertBeforeSelector);
    if (target && target.parentElement === form) form.insertBefore(container, target);
    else form.appendChild(container);

    input = container.querySelector(`#${id}`);
  }

  if (input) {
    input.checked = qbool(queryKey, false);
    input.setAttribute('data-query-key', queryKey);
  }
  return input;
}
