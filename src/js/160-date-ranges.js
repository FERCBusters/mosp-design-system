// MOSP design system: Date Ranges.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Date range guardrails
// ---------------------------------------------------------------------------

/**
 * Format a Date object as ISO yyyy-mm-dd.
 */
export function isoYmd(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${dateObj.getUTCFullYear()}-${pad2(dateObj.getUTCMonth() + 1)}-${pad2(dateObj.getUTCDate())}`;
}

/**
 * Parse an ISO yyyy-mm-dd string into a UTC Date object.
 */
export function parseYmd(s) {
  const t = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Enforce an inclusive maximum span (in days). Returns possibly adjusted strings.
/**
 * Format an ISO date for date-range validation messages.
 */
function formatDisplayDateYmd(ymd) {
  const raw = String(ymd || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Validate that a date range does not exceed the configured maximum span.
 */
export function enforceMaxDateRange(fromStr, toStr, maxDays = 365) {
  const from = parseYmd(fromStr);
  const to = parseYmd(toStr);
  if (!from || !to) return {from: fromStr || '', to: toStr || '', adjusted: false, exceeded: false, message: ''};
  const msPerDay = 86400000;
  const spanDays = Math.floor((to.getTime() - from.getTime()) / msPerDay);
  if (!Number.isFinite(spanDays) || spanDays <= maxDays) {
    return {from: fromStr || '', to: toStr || '', adjusted: false, exceeded: false, message: ''};
  }
  const latestAllowedFrom = new Date(to.getTime() - (maxDays * msPerDay));
  return {
    from: fromStr || '',
    to: toStr || '',
    adjusted: false,
    exceeded: true,
    latestAllowedFrom: isoYmd(latestAllowedFrom),
    message: `Date range cannot exceed ${maxDays} days. Choose a From date on or after ${formatDisplayDateYmd(isoYmd(latestAllowedFrom))}.`,
  };
}

/**
 * Constrain date input min/max values based on a maximum allowed range.
 */
export function attachDateRangeBounds(fromInput, toInput, maxDays = 365) {
  const syncBounds = () => {
    const from = parseYmd(fromInput?.value || '');
    const to = parseYmd(toInput?.value || '');
    const msPerDay = 86400000;
    if (fromInput && to) {
      const maxTo = new Date(from.getTime() + (maxDays * msPerDay));
      fromInput.max = toInput.value || fromInput.max || '';
      toInput.min = fromInput.value || toInput.min || '';
      toInput.max = isoYmd(maxTo);
    } else if (toInput) {
      toInput.removeAttribute('min');
      toInput.removeAttribute('max');
    }
    if (toInput && from) {
      const minFrom = new Date(from.getTime() - (maxDays * msPerDay));
      toInput.min = fromInput?.value || toInput.min || '';
      fromInput.min = isoYmd(minFrom);
      fromInput.max = toInput.value || fromInput.max || '';
    } else if (fromInput) {
      fromInput.removeAttribute('max');
    }
  };
  [fromInput, toInput].forEach((input) => {
    if (!input || input.__keenDateBoundsAttached) return;
    input.__keenDateBoundsAttached = true;
    input.addEventListener('change', syncBounds);
    input.addEventListener('blur', syncBounds);
  });
  syncBounds();
}
