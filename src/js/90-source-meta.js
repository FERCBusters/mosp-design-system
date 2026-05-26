// MOSP design system: Source Meta.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// KEEN-style source metadata helpers (used by KEEN; harmless elsewhere)
// ---------------------------------------------------------------------------

let _sourceMetaPromise = null;

/**
 * Convert a hex colour to an RGB triplet string for CSS variables.
 */
function _hexToRgbTriplet(hex) {
  const h = String(hex || '').trim();
  const m = h.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  return `${r},${g},${b}`;
}

/**
 * Convert an sRGB channel to linear luminance space.
 */
function _srgbToLinear(c) {
  const x = c / 255;
  return (x <= 0.04045) ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance for a hex colour.
 */
function _relativeLuminance(hex) {
  const trip = _hexToRgbTriplet(hex);
  if (!trip) return null;
  const [r, g, b] = trip.split(',').map((x) => parseInt(x.trim(), 10));
  const R = _srgbToLinear(r);
  const G = _srgbToLinear(g);
  const B = _srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Returns a metaMap keyed by source id.
/**
 * Load and cache KEEN-style source metadata used by badges and labels.
 */
export async function getSourceMeta(cfgOverrides = null) {
  if (_sourceMetaPromise) return _sourceMetaPromise;

  _sourceMetaPromise = (async () => {
    try {
      const cfg = getUiConfig(cfgOverrides);
      const metaMap = await apiGet('/api/v1/sources/meta', cfg);
      return metaMap || {};
    }
    finally {
      // Always clear promise to allow retry.
      _sourceMetaPromise = null;
    }
  })();

  return _sourceMetaPromise;
}

/**
 * Resolve the best display label for a source identifier.
 */
export function sourceLabel(source, metaMap) {
  const s = String(source || '');
  const m = metaMap ? metaMap[s] : null;
  return (m && m.label) ? m.label : s;
}

/**
 * Render a tinted source badge, optionally as a safe hyperlink.
 */
export function sourceBadgeHtml(source, metaMap, href = null) {
  const s = String(source || '').trim();
  if (!s) return '';
  const m = metaMap ? metaMap[s] : null;
  const label = esc(m?.label || s);
  const rgb = (m && m.rgb) ? m.rgb : _hexToRgbTriplet(m?.color);
  const bg = (m && m.color) ? String(m.color).trim() : '';
  const lum = bg ? _relativeLuminance(bg) : null;
  let style = '';
  if (rgb) style += `--src-rgb: ${esc(rgb)};`;
  if (lum !== null && lum > 0.70) style += `color: #111827; border-color: rgba(0,0,0,0.14);`;
  style = style ? ` style="${style}"` : '';
  const url = withFramework(href || `/events.html?source=${encodeURIComponent(s)}`);
  const title = (m && m.label && m.label !== s) ? ` title="${esc(s)}"` : '';
  return `<a class="badge badge-source"${style}${title} href="${esc(url)}">${label}</a>`;
}
