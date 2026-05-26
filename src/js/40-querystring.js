// MOSP design system: Querystring.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Querystring helpers
// ---------------------------------------------------------------------------

/**
 * Read a query-string value from the current URL.
 */
export function qs(key, fallback = null) {
  const p = new URLSearchParams(location.search);
  const v = p.get(key);
  return v === null ? fallback : v;
}

/**
 * Read a query-string value as a boolean.
 */
export function qbool(key, fallback = false) {
  const v = qs(key);
  if (v === null) return fallback;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return fallback;
}

/**
 * Read a query-string value as an integer.
 */
export function qint(key, fallback = 0) {
  const v = qs(key);
  if (v === null) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Update the current URL query string without reloading the page.
 */
export function setQuery(params) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(params || {})) {
    if (v === null || v === undefined || v === '') p.delete(k);
    else p.set(k, String(v));
  }
  const next = p.toString() ? `${location.pathname}?${p.toString()}` : `${location.pathname}`;
  history.replaceState({}, '', next);
  return p;
}
