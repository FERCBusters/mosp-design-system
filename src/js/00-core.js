// MOSP design system: Core Utilities.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// MOSP UI Kit
// - Bootstrap 5 + bootstrap-icons expected on pages
// - ESM module (load via <script type="module">)
//
// Configure via `window.mospUiConfig` (set *before* importing this module) or
// pass overrides to initNavbar().

/**
 * Escape a value for safe insertion into HTML text or attributes.
 */
export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Validate a URL before placing it into an href.
// Defense-in-depth against click-based XSS via `javascript:` URLs.


export const UI_LABELS = Object.freeze({
  expand: 'Expand',
  collapse: 'Collapse',
});

export const EXPAND_LABEL = UI_LABELS.expand;
export const COLLAPSE_LABEL = UI_LABELS.collapse;

/**
 * Render the shared Expand/Collapse label spans used by collapse buttons.
 */
export function expandCollapseLabelHtml() {
  return `<span class="when-expanded">${esc(COLLAPSE_LABEL)}</span><span class="when-collapsed">${esc(EXPAND_LABEL)}</span>`;
}

/**
 * Build a Bootstrap collapse toggle button with shared MOSP wording and accessibility attributes.
 */
export function collapseToggleButtonHtml({
  targetId = '',
  expanded = true,
  className = 'btn btn-sm btn-outline-secondary',
  controlsLabel = '',
} = {}) {
  const safeId = String(targetId || '').replace(/[^A-Za-z0-9_-]/g, '-');
  if (!safeId) return '';
  const isExpanded = expanded !== false;
  const labelTarget = controlsLabel ? ` ${String(controlsLabel)}` : '';
  const collapsedClass = isExpanded ? '' : ' collapsed';
  const ariaLabel = `${isExpanded ? COLLAPSE_LABEL : EXPAND_LABEL}${labelTarget}`.trim();
  return `<button class="${esc(className)}${collapsedClass}" type="button" data-bs-toggle="collapse" data-bs-target="#${esc(safeId)}" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-controls="${esc(safeId)}" aria-label="${esc(ariaLabel)}">${expandCollapseLabelHtml()}</button>`;
}

/**
 * Validate a user- or API-provided URL before placing it in an href attribute.
 */
export function safeExternalHref(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  if (raw.length > 2048) return '';
  if (/^(?:javascript|data|vbscript):/i.test(raw)) return '';
  // Disallow protocol-relative URLs like //evil.com.
  if (/^\/\//.test(raw)) return '';
  // Allow same-origin relative paths.
  if (raw.startsWith('/')) return raw;

  try {
    const u = new URL(raw);
    const p = String(u.protocol || '').toLowerCase();
    if (p === 'http:' || p === 'https:') return u.href;
  } catch {
    // ignore
  }
  return '';
}

/**
 * Collapse whitespace and truncate text to a readable preview length.
 */
export function shorten(s, limit = 160) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= limit) return t;
  const n = Math.max(0, limit - 1);
  return t.slice(0, n) + '…';
}

/**
 * Return a debounced wrapper that delays invoking a function until input settles.
 */
export function debounce(fn, wait = 300) {
  let t = null;
  const wrapped = (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, wait);
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return wrapped;
}
