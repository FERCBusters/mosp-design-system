// MOSP design system: Framework.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Framework helpers (optional; enabled via cfg.framework.enabled)
// ---------------------------------------------------------------------------

let _frameworkCache = null;
let _frameworkPromise = null;

/**
 * Normalise a framework slug or identifier into a stable string.
 */
function _normFramework(v) {
  const s = String(v ?? '').trim();
  return s || '';
}

/**
 * Read the selected framework value from the current URL.
 */
function _frameworkFromUrl(cfg) {
  const raw = qs(cfg.framework.queryParam || 'framework');
  return _normFramework(raw);
}

/**
 * Read the selected framework value from localStorage.
 */
function _frameworkFromStorage(cfg) {
  try {
    return _normFramework(localStorage.getItem(cfg.storage.frameworkKey));
  } catch {
    return '';
  }
}

/**
 * Persist the selected framework value to localStorage.
 */
function _storeFramework(slug, cfg) {
  const s = _normFramework(slug);
  if (!s) return;
  try { localStorage.setItem(cfg.storage.frameworkKey, s); } catch {}
}

/**
 * Resolve the active framework from the URL, storage, or configured default.
 */
export function getCurrentFramework(fallback = '', cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  if (!cfg.framework.enabled) return '';

  const fromUrl = _frameworkFromUrl(cfg);
  if (fromUrl) return fromUrl;

  const globalFw = _normFramework(window.mospFramework);
  if (globalFw) return globalFw;

  const preferred = _normFramework(window.mospPreferredFramework);
  if (preferred) return preferred;

  const stored = _frameworkFromStorage(cfg);
  if (stored) return stored;

  const dflt = _normFramework(window.mospFrameworkDefault) || _normFramework(cfg.framework.default);
  if (dflt) return dflt;

  return _normFramework(fallback) || '';
}

/**
 * Add the active framework query parameter to an application URL when framework support is enabled.
 */
export function withFramework(url, framework = null, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  if (!cfg.framework.enabled) return String(url || '');

  const fw = _normFramework(framework || getCurrentFramework('', cfg));
  if (!fw) return String(url || '');

  try {
    const u = new URL(String(url || ''), window.location.origin);
    u.searchParams.set(cfg.framework.queryParam || 'framework', fw);
    if (u.origin === window.location.origin) return `${u.pathname}${u.search}${u.hash || ''}`;
    return u.toString();
  } catch {
    const raw = String(url || '');
    if (!raw) return '';
    const key = cfg.framework.queryParam || 'framework';
    const hasQ = raw.includes('?');
    const sep = hasQ ? '&' : '?';
    if (new RegExp(`([?&])${key}=`).test(raw)) {
      return raw.replace(new RegExp(`([?&])${key}=[^&#]*`, 'g'), `$1${key}=${encodeURIComponent(fw)}`);
    }
    return `${raw}${sep}${key}=${encodeURIComponent(fw)}`;
  }
}

/**
 * Update framework-aware navbar links to include the current framework selection.
 */
function _applyFrameworkToNavLinks(framework, cfg) {
  const fw = _normFramework(framework || getCurrentFramework('', cfg));
  const links = document.querySelectorAll('a[data-nav-fw="1"]');
  for (const a of links) {
    const base = a.dataset.baseHref || a.getAttribute('href') || '/';
    if (!a.dataset.baseHref) a.dataset.baseHref = base;
    a.setAttribute('href', withFramework(base, fw, cfg));
  }
}

/**
 * Load available frameworks from the configured API endpoint and cache the result.
 */
async function _fetchFrameworks(cfg) {
  if (_frameworkCache) return _frameworkCache;
  if (_frameworkPromise) return _frameworkPromise;

  _frameworkPromise = (async () => {
    try {
      const data = await apiGet(cfg.framework.endpoint, cfg);
      const rawItems = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      const items = rawItems
        .map((it) => ({
          // Accept several common shapes across apps:
          // - KEEN: {slug, name, is_default}
          // - OSPMAE: {machine_name, display_name, is_default}
          // - (fallback) {key, label}
          slug: _normFramework(it?.slug || it?.machine_name || it?.key || it?.id),
          name: String(it?.name || it?.display_name || it?.label || it?.slug || it?.machine_name || '').trim(),
          is_default: !!it?.is_default,
        }))
        .filter((it) => it.slug);

      const seen = new Set();
      const uniq = [];
      for (const it of items) {
        if (seen.has(it.slug)) continue;
        seen.add(it.slug);
        uniq.push(it);
      }

      const dflt = _normFramework(data?.default) || (uniq.find((x) => x.is_default)?.slug || '') || _normFramework(cfg.framework.default);
      _frameworkCache = {items: uniq, default: dflt};
      return _frameworkCache;
    } catch {
      const fallback = {items: [], default: _normFramework(cfg.framework.default)};
      _frameworkCache = fallback;
      return fallback;
    } finally {
      _frameworkPromise = null;
    }
  })();

  return _frameworkPromise;
}

/**
 * Resize the framework selector based on available option text.
 */
function _sizeFrameworkSelector(sel, items, cfg) {
  if (!sel) return;

  const labels = ['Select…', 'None'];
  for (const it of (Array.isArray(items) ? items : [])) {
    labels.push(String(it?.name || it?.slug || '').trim());
  }

  const maxLabelLen = labels.reduce((max, label) => Math.max(max, [...String(label || '')].length), 0);
  const minChars = Math.max(8, Number(cfg.framework.selectMinChars || 12));
  const maxChars = Math.max(minChars, Number(cfg.framework.selectMaxChars || 26));
  const extraChars = Math.max(2, Number(cfg.framework.selectExtraChars || 4));
  const widthChars = Math.min(maxChars, Math.max(minChars, maxLabelLen + extraChars));

  sel.style.setProperty('--mosp-fw-select-ch', `${widthChars}ch`);

  const fixedMinPx = Number(cfg.framework.selectMinWidthPx || 0);
  if (fixedMinPx > 0) {
    sel.style.minWidth = `${fixedMinPx}px`;
  } else {
    sel.style.minWidth = '0';
  }
}

/**
 * Render and wire the optional navbar framework selector.
 */
async function _initFrameworkSelector(cfg) {
  const sel = document.getElementById('navFrameworkSelect');
  if (!sel) return;

  const fwData = await _fetchFrameworks(cfg);
  const items = Array.isArray(fwData?.items) ? fwData.items.slice() : [];
  const defaultSlug = _normFramework(fwData?.default) || _normFramework(cfg.framework.default) || '';

  sel.innerHTML = '';
  const optBlank = document.createElement('option');
  optBlank.value = '';
  optBlank.textContent = items.length ? 'Select…' : 'None';
  sel.appendChild(optBlank);

  for (const it of items) {
    const opt = document.createElement('option');
    opt.value = it.slug;
    opt.textContent = it.name || it.slug;
    sel.appendChild(opt);
  }

  _sizeFrameworkSelector(sel, items, cfg);

  const current = getCurrentFramework(defaultSlug, cfg);
  if (current) sel.value = current;
  sel.disabled = false;

  _applyFrameworkToNavLinks(current || defaultSlug, cfg);

  sel.addEventListener('change', () => {
    const next = _normFramework(sel.value);
    if (next) _storeFramework(next, cfg);
    // Update URL param and refresh.
    const key = cfg.framework.queryParam || 'framework';
    const p = new URLSearchParams(location.search);
    if (next) p.set(key, next);
    else p.delete(key);
    const nextUrl = p.toString() ? `${location.pathname}?${p.toString()}` : location.pathname;
    location.href = nextUrl;
  });
}
