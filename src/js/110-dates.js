// MOSP design system: Dates.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Timestamp formatting (shared UX across apps)
// ---------------------------------------------------------------------------

/**
 * Normalise timestamp strings so timezone-less values are treated as UTC.
 */
function _normalizeIsoAssumingUtc(iso) {
  const s = String(iso || '').trim();
  if (!s) return '';
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s + 'Z';
  return s;
}

/**
 * Parse an ISO-like timestamp into a Date object.
 */
function _dateFromIso(iso) {
  const norm = _normalizeIsoAssumingUtc(iso);
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve the browser timezone used for timestamp formatting.
 */
function _effectiveTimezone() {
  const prefs = window.mospPreferences || {};
  const useLocal = !!prefs.use_local_timezone;
  if (useLocal) {
    return (prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim();
  }
  return (window.mospDefaultTimezone || '').trim();
}

/**
 * Format a timestamp for display using the user’s locale and timezone.
 */
export function fmtTs(iso) {
  if (!iso) return '';
  const d = _dateFromIso(iso);
  if (!d) return String(iso);

  const tz = _effectiveTimezone();
  try {
    const fmt = new Intl.DateTimeFormat(undefined, {
      timeZone: tz || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t)?.value || '');
    const y = get('year');
    const m = get('month');
    const da = get('day');
    const h = get('hour');
    const mi = get('minute');
    const s = get('second');
    if (y && m && da && h && mi && s) return `${y}-${m}-${da} ${h}:${mi}:${s}`;
  } catch {}

  const pad2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * Format a timestamp into a filename-safe UTC string.
 */
export function fmtTsFilename(iso) {
  if (!iso) return '';
  const d = _dateFromIso(iso);
  if (!d) return String(iso);
  const tz = _effectiveTimezone();

  try {
    const fmt = new Intl.DateTimeFormat(undefined, {
      timeZone: tz || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t)?.value || '');
    const y = get('year'); const m = get('month'); const da = get('day');
    const h = get('hour'); const mi = get('minute'); const s = get('second');
    if (y && m && da && h && mi && s) return `${y}${m}${da}_${h}${mi}${s}`;
  } catch {}

  const pad2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

// A stable numeric-ish sort key for ISO timestamps.
// Intended for use in `data-sort` attributes.
/**
 * Create a stable numeric sort key for timestamp table cells.
 */
export function tsSortKey(iso) {
  const d = _dateFromIso(iso);
  return d ? String(d.getTime()) : '';
}

// --- Date inputs (configurable visible format, ISO on the wire) ---
export const DATE_FORMATS = Object.freeze({
  ymd: 'YYYY-MM-DD',
  dmy: 'DD/MM/YYYY',
});

/**
 * Normalise configured date format aliases to a supported date format.
 */
export function normalizeDateFormat(raw, fallback = 'ymd') {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'dd/mm/yyyy' || v === 'dd-mm-yyyy' || v === 'dmy') return 'dmy';
  if (v === 'yyyy-mm-dd' || v === 'yyyy/mm/dd' || v === 'iso' || v === 'ymd') return 'ymd';
  if (fallback === '') return '';
  return fallback === 'dmy' ? 'dmy' : 'ymd';
}

/**
 * Resolve the preferred visible date format from options and MOSP config.
 */
export function preferredDateFormat(opts = {}) {
  if (opts && opts.format) return normalizeDateFormat(opts.format);
  const prefs = (typeof window !== 'undefined' && window.mospPreferences) ? window.mospPreferences : {};
  const prefRaw = String(prefs.date_format || prefs.dateFormat || '').trim().toLowerCase();
  const pref = prefRaw === 'default' ? '' : normalizeDateFormat(prefRaw, '');
  if (pref) return pref;
  const globalDefault = (typeof window !== 'undefined' && window.mospDefaultDateFormat) ? window.mospDefaultDateFormat : '';
  if (globalDefault) return normalizeDateFormat(globalDefault);
  try {
    const cfg = getUiConfig();
    return normalizeDateFormat(cfg?.dateFormat || cfg?.locale?.dateFormat || 'ymd');
  } catch {
    return 'ymd';
  }
}

/**
 * Extract year, month, and day parts from an ISO date string.
 */
function _isoDateParts(iso) {
  const s = String(iso || '').trim();
  const m = s.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
  if (!m) return null;
  return {yyyy: m[1], mm: m[2], dd: m[3]};
}

/**
 * Convert an ISO yyyy-mm-dd date into the configured visible date format.
 */
export function isoDateToDisplay(iso, format = null) {
  const p = _isoDateParts(iso);
  if (!p) return '';
  const fmt = preferredDateFormat({format});
  if (fmt === 'dmy') return `${p.dd}/${p.mm}/${p.yyyy}`;
  return `${p.yyyy}-${p.mm}-${p.dd}`;
}

/**
 * Backward-compatible helper that formats an ISO date as dd/mm/yyyy.
 */
export function isoDateToDmy(iso) {
  return isoDateToDisplay(iso, 'dmy');
}

/**
 * Validate that year, month, and day parts form a real calendar date.
 */
function _validIsoDate(yyyy, mm, dd) {
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  if (y < 1900 || y > 3000) return '';
  if (m < 1 || m > 12) return '';
  if (d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== (m - 1) || dt.getUTCDate() !== d) return '';
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Parse a visible date value into ISO yyyy-mm-dd form.
 */
export function displayDateToIso(value, format = null) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Always accept canonical ISO input, even when the preferred visible format is DD/MM/YYYY.
  let m = raw.match(/^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/);
  if (m) return _validIsoDate(m[1], m[2], m[3]);

  const fmt = preferredDateFormat({format});
  if (fmt === 'dmy') {
    m = raw.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
    if (m) return _validIsoDate(m[3], m[2], m[1]);
  }

  return '';
}

/**
 * Backward-compatible helper that parses dd/mm/yyyy into ISO form.
 */
export function dmyToIsoDate(dmy) {
  return displayDateToIso(dmy, 'dmy');
}

/**
 * Return the placeholder text for a supported visible date format.
 */
export function dateFormatPlaceholder(format = null) {
  const fmt = preferredDateFormat({format});
  return fmt === 'dmy' ? 'DD/MM/YYYY' : 'YYYY-MM-DD';
}

/**
 * Wire a text date field to a hidden ISO date input and optional native date picker.
 */
export function wireIsoDateTextField(hidden, text, pickBtn, opts = {}) {
  if (!hidden || !text) return null;

  const format = preferredDateFormat(opts);
  const listenInput = (opts && Object.prototype.hasOwnProperty.call(opts, 'listenInput')) ? !!opts.listenInput : true;
  const dispatchChangeOnText = (opts && Object.prototype.hasOwnProperty.call(opts, 'dispatchChangeOnText')) ? !!opts.dispatchChangeOnText : false;
  const bubbles = (opts && Object.prototype.hasOwnProperty.call(opts, 'bubbles')) ? !!opts.bubbles : true;
  const invalidClass = opts.invalidClass || 'is-invalid';

  if (!text.getAttribute('placeholder')) text.setAttribute('placeholder', dateFormatPlaceholder(format));
  if (!text.getAttribute('inputmode')) text.setAttribute('inputmode', 'numeric');
  if (!text.getAttribute('autocomplete')) text.setAttribute('autocomplete', 'off');

  const syncTextFromHidden = () => {
    text.value = isoDateToDisplay(hidden.value || '', format);
    text.classList.remove(invalidClass);
  };

  const syncHiddenFromText = () => {
    const raw = String(text.value || '').trim();
    if (!raw) {
      hidden.value = '';
      text.classList.remove(invalidClass);
      return true;
    }
    const iso = displayDateToIso(raw, format);
    if (iso) {
      hidden.value = iso;
      text.value = isoDateToDisplay(iso, format);
      text.classList.remove(invalidClass);
      return true;
    }
    text.classList.add(invalidClass);
    return false;
  };

  const maybeDispatchHiddenChange = () => {
    if (!dispatchChangeOnText) return;
    try { hidden.dispatchEvent(new Event('change', {bubbles})); } catch {}
  };

  if (listenInput) hidden.addEventListener('input', syncTextFromHidden);
  hidden.addEventListener('change', syncTextFromHidden);

  text.addEventListener('change', () => { if (syncHiddenFromText()) maybeDispatchHiddenChange(); });
  text.addEventListener('blur', () => { if (syncHiddenFromText()) maybeDispatchHiddenChange(); });

  if (pickBtn) {
    pickBtn.addEventListener('click', () => {
      try {
        if (typeof hidden.showPicker === 'function') hidden.showPicker();
        else { hidden.focus(); hidden.click(); }
      } catch {}
    });
  }

  syncTextFromHidden();
  return {syncTextFromHidden, syncHiddenFromText, format};
}

/**
 * Backward-compatible helper for wiring dd/mm/yyyy text date fields.
 */
export function wireIsoDmyDateField(hidden, text, pickBtn, opts = {}) {
  return wireIsoDateTextField(hidden, text, pickBtn, {...opts, format: 'dmy'});
}
