// MOSP UI Kit
// - Bootstrap 5 + bootstrap-icons expected on pages
// - ESM module (load via <script type="module">)
//
// Configure via `window.mospUiConfig` (set *before* importing this module) or
// pass overrides to initNavbar().

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

export function shorten(s, limit = 160) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= limit) return t;
  const n = Math.max(0, limit - 1);
  return t.slice(0, n) + '…';
}

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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// NOTE: KEEN is treated as the baseline shell; other apps override via
// `window.mospUiConfig`.
const DEFAULT_CONFIG = {
  appId: 'keen',
  appName: 'Keen',
  brandIcon: '/keen.svg',
  brandHref: '/',
  // Navigation links. Each entry:
  // { label, href, key, requireAny?: ['is_admin', 'can_audit_trail'], requireAll?: [] }
  // label/href MAY be functions (me, cfg) => string for role-aware nav.
  links: [
    {key: 'controls', label: 'Controls', href: '/?stay=1'},
    {key: 'events', label: 'Events', href: '/events.html'},
    {key: 'sources', label: 'Sources', href: '/sources.html'},
    {key: 'viz', label: 'Visualisations', href: '/visualisation.html'},
    {key: 'my_questions', label: 'My Questions', href: '/my-questions.html', requireAny: ['is_admin', 'can_question_events']},
    {key: 'diary', label: 'Diary', href: '/admin.html#diary', requireAny: ['is_admin']},
    {key: 'admin', label: (me) => (me?.is_admin ? 'Admin' : 'Audit'), href: (me) => (me?.is_admin ? '/admin.html' : '/admin.html#audit'), requireAny: ['is_admin', 'can_audit_trail']},
  ],
  // If true, nav links will automatically be augmented with ?framework=<slug>
  framework: {
    enabled: true,
    label: 'Framework',
    queryParam: 'framework',
    endpoint: '/api/v1/frameworks',
    default: '',
    selectMinWidthPx: 220,
  },
  // Global search box in navbar
  search: {
    enabled: true,
    placeholder: 'Search events',
    targetPath: '/events.html',
    queryParam: 'q',
    // Optional datalist auto-complete (saved searches/shortcuts)
    datalistId: 'keenSavedSearches',
    datalistEndpoint: '/api/v1/me/saved-searches',
    datalistNameKey: 'name',
    datalistUrlKey: 'url',
    // If true, submitting a search that matches a datalist "name" jumps to its URL
    resolveNamesToUrls: true,
  },
  // Saved shortcuts dropdown in navbar ("Save this view")
  shortcuts: {
    enabled: true,
    // KEEN uses saved-searches as shortcuts.
    endpoint: '/api/v1/me/saved-searches',
    label: 'Shortcuts',
  },
  // Notification bell with badge (optional)
  bell: {
    enabled: true,
    href: '/questions.html',
    title: 'Questions',
    // If provided, initNavbar will poll this endpoint for a count.
    // May be string | function(me,cfg) | {admin, user}.
    summaryEndpoint: {admin: '/api/v1/admin/questions/summary', user: '/api/v1/me/questions/summary'},
    // May be string | function(me,cfg) | {admin, user}.
    countKey: {admin: 'open_count', user: 'unread_count'},
    // WebSocket url (same-origin) for realtime, optional:
    wsUrl: '',
    // message handler: expects JSON messages with {type, count}
    wsType: 'count',
  },
  // Navbar extension points (rarely needed; use sparingly)
  nav: {
    // Optional HTML (string or function(me,cfg)=>string) injected into the right
    // side of the navbar, before shortcuts/bell/account/logout.
    extraHtml: '',
  },
  // Auth / API
  apiBase: '', // optional prefix applied to *relative* API paths
  auth: {
    meEndpoint: '/api/v1/me',
    loginUrl: '/login.html',
    logoutEndpoint: '/api/v1/auth/logout',
    logoutRedirect: '/login.html',
    logoutEnabled: true,
    accountHref: '/account.html',
    accountEnabled: true,
  },
  csrf: {
    cookieName: 'keen_csrf',
    headerName: 'X-CSRF-Token',
  },
  storage: {
    themeKey: 'keen_theme',
    frameworkKey: 'keen_framework',
  },
  uiPreferences: {
    endpoint: '',
    method: 'PATCH',
    stickyField: 'sticky_enabled',
  },
  // Optional hook to adjust the returned `me` object (e.g. map shape across apps)
  mapMe: null,
};

function deepMerge(a, b) {
  const out = {...(a || {})};
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function getUiConfig(overrides = null) {
  const w = (typeof window !== 'undefined' && window.mospUiConfig) ? window.mospUiConfig : {};
  const cfg = deepMerge(DEFAULT_CONFIG, deepMerge(w, overrides || {}));

  // Support `brand: {name, iconSrc, href}` shorthand.
  if (cfg.brand && typeof cfg.brand === 'object') {
    if (cfg.brand.name) cfg.appName = cfg.brand.name;
    if (cfg.brand.iconSrc) cfg.brandIcon = cfg.brand.iconSrc;
    if (cfg.brand.href) cfg.brandHref = cfg.brand.href;
  }

  // Derive storage keys if not explicitly set
  if (!cfg.storage?.themeKey) cfg.storage.themeKey = `${cfg.appId}_theme`;
  if (!cfg.storage?.frameworkKey) cfg.storage.frameworkKey = `${cfg.appId}_framework`;

  // Derive CSRF cookie name if not explicitly set
  if (!cfg.csrf?.cookieName) cfg.csrf.cookieName = `${cfg.appId}_csrf`;

  return cfg;
}

// ---------------------------------------------------------------------------
// Theme (Bootstrap-variable friendly)
// ---------------------------------------------------------------------------

// Keep in sync with backend ALLOWED_THEMES if you use server-controlled themes.
export const THEMES = [
  {id: 'purple', name: 'Purple'},
  {id: 'ocean', name: 'Ocean'},
  {id: 'forest', name: 'Forest'},
  {id: 'sunset', name: 'Sunset'},
  {id: 'rose', name: 'Rose'},
  {id: 'slate', name: 'Slate'},
  {id: 'teal', name: 'Teal'},
];

export function applyTheme(themeId, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const id = (themeId || '').trim() || 'purple';
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(cfg.storage.themeKey, id);
  } catch {}
}

// Apply last-used theme early (before any API calls) to reduce flash.
try {
  const cfg = getUiConfig();
  const saved = localStorage.getItem(cfg.storage.themeKey);
  if (saved) applyTheme(saved, cfg);
} catch {}


// ---------------------------------------------------------------------------
// UI behaviour preferences (sticky, auto-apply) stored in localStorage
// ---------------------------------------------------------------------------

function _parseBool(v, fallback) {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === '') return fallback;
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return fallback;
}

function _stickyKey(cfg) {
  return (cfg && cfg.storage && cfg.storage.stickyKey) ? String(cfg.storage.stickyKey) : `${cfg.appId}_sticky`;
}

function _autoApplyKey(cfg) {
  return (cfg && cfg.storage && cfg.storage.autoApplyKey) ? String(cfg.storage.autoApplyKey) : `${cfg.appId}_auto_apply`;
}

/**
 * Returns whether sticky filter/chart containers should be enabled.
 * Stored as a local-only preference (not sent to the backend).
 */
export function getStickyEnabled(cfgOverrides = null, fallback = true) {
  const cfg = getUiConfig(cfgOverrides);
  try {
    return _parseBool(localStorage.getItem(_stickyKey(cfg)), !!fallback);
  } catch {
    return !!fallback;
  }
}

/**
 * Persist sticky preference and apply it immediately.
 */
export function setStickyEnabled(enabled, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  try {
    localStorage.setItem(_stickyKey(cfg), enabled ? '1' : '0');
  } catch {
    // ignore
  }
  applyStickyPreference(cfg, false);

  try { window.dispatchEvent(new CustomEvent('mosp:sticky-changed', {detail: {enabled: !!enabled}})); } catch {}
}

/**
 * Applies the sticky preference by toggling a class on <body>.
 * Pages can style sticky behaviour under `body.keen-sticky-disabled`.
 *
 * If called before <body> exists, it will apply on DOMContentLoaded.
 */
export function applyStickyPreference(cfgOverrides = null, early = false) {
  const cfg = getUiConfig(cfgOverrides);
  const enabled = getStickyEnabled(cfg, true);
  const cls = 'keen-sticky-disabled';

  const apply = () => {
    if (!document.body) return false;
    if (enabled) document.body.classList.remove(cls);
    else document.body.classList.add(cls);
    return true;
  };

  if (!apply() && (early || !document.body)) {
    document.addEventListener('DOMContentLoaded', () => { apply(); }, {once: true});
  }

  return enabled;
}

/**
 * Returns whether auto-apply for filter forms should be enabled.
 * Stored as a local-only preference (not sent to the backend).
 */
export function getAutoApplyEnabled(cfgOverrides = null, fallback = true) {
  const cfg = getUiConfig(cfgOverrides);
  try {
    return _parseBool(localStorage.getItem(_autoApplyKey(cfg)), !!fallback);
  } catch {
    return !!fallback;
  }
}

/**
 * Persist auto-apply preference.
 */
export function setAutoApplyEnabled(enabled, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  try {
    localStorage.setItem(_autoApplyKey(cfg), enabled ? '1' : '0');
  } catch {
    // ignore
  }

  try { window.dispatchEvent(new CustomEvent('mosp:auto-apply-changed', {detail: {enabled: !!enabled}})); } catch {}
}

// Apply last-used sticky preference early (before page logic binds any listeners).
try {
  const cfg = getUiConfig();
  applyStickyPreference(cfg, true);
} catch {}

// If the backend provides these preferences, keep localStorage in sync so
// pages can rely on getStickyEnabled()/getAutoApplyEnabled() consistently across apps.
function _syncUiPrefsFromMe(me, cfg) {
  const prefs = me?.preferences || {};
  const hasSticky = typeof prefs.sticky_enabled === 'boolean';
  const hasAuto = typeof prefs.auto_apply_enabled === 'boolean';

  if (hasSticky) setStickyEnabled(!!prefs.sticky_enabled, cfg);
  if (hasAuto) setAutoApplyEnabled(!!prefs.auto_apply_enabled, cfg);
}

function _collapseStorageKey(cfg, section) {
  const raw = String(section?.dataset?.mospFilterSection || '').trim() || location.pathname;
  return `${cfg.appId}:filters-collapsed:${raw}`;
}

function _setStickyCheckbox(enabled) {
  const box = document.getElementById('prefSticky');
  if (box instanceof HTMLInputElement) box.checked = !!enabled;
}

export async function persistStickyEnabled(enabled, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const pref = cfg.uiPreferences || {};
  const endpoint = String(pref.endpoint || '').trim();
  const stickyField = String(pref.stickyField || 'sticky_enabled').trim() || 'sticky_enabled';
  const method = String(pref.method || 'PATCH').trim().toUpperCase();

  setStickyEnabled(!!enabled, cfg);
  _setStickyCheckbox(!!enabled);
  try {
    if (window.mospPreferences && typeof window.mospPreferences === 'object') {
      window.mospPreferences.sticky_enabled = !!enabled;
    }
  } catch {}

  if (!endpoint) return null;

  const payload = {[stickyField]: !!enabled};
  if (method === 'PUT') return apiPut(endpoint, payload, {}, cfg);
  return apiPatch(endpoint, payload, {}, cfg);
}

function _setFilterCollapsed(section, body, toggle, collapsed) {
  if (!section || !body) return;
  section.classList.toggle('mosp-filter-collapsed', !!collapsed);
  body.hidden = !!collapsed;
  body.style.display = collapsed ? 'none' : '';
  if (toggle) {
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const label = toggle.querySelector('[data-mosp-filter-toggle-label]');
    if (label) label.textContent = collapsed ? 'Show filters' : 'Hide filters';
    const icon = toggle.querySelector('i.bi');
    if (icon) {
      icon.classList.toggle('bi-chevron-down', !!collapsed);
      icon.classList.toggle('bi-chevron-up', !collapsed);
    }
  }
}

function _ensureFilterToggle(section, header) {
  if (!header) return null;
  let toggle = section.querySelector('[data-mosp-filter-toggle]');
  if (toggle) return toggle;

  toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-sm btn-outline-secondary';
  toggle.setAttribute('data-mosp-filter-toggle', '1');
  toggle.innerHTML = '<i class="bi bi-chevron-up" aria-hidden="true"></i><span data-mosp-filter-toggle-label>Hide filters</span>';

  const maybeTitle = header.querySelector('.fw-bold, .fw-semibold, h2, h3, h4, h5, h6, span');
  if (!header.classList.contains('d-flex')) {
    header.classList.add('d-flex', 'align-items-center', 'justify-content-between', 'gap-2', 'flex-wrap');
    if (maybeTitle && maybeTitle.parentElement === header) maybeTitle.classList.add('mb-0');
  }
  header.appendChild(toggle);
  return toggle;
}

function _ensureFilterHeader(section) {
  let header = section.querySelector(':scope > .card-header');
  if (header) return header;

  header = document.createElement('div');
  header.className = 'card-header';
  const title = String(section.dataset.mospFilterTitle || 'Filters').trim() || 'Filters';
  header.innerHTML = `<div class="fw-bold">${esc(title)}</div>`;
  section.insertBefore(header, section.firstChild);
  return header;
}

export function initCollapsibleFilterSections(cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const sections = Array.from(document.querySelectorAll('[data-mosp-filter-section]'));
  if (!sections.length) return;

  sections.forEach((section) => {
    const header = _ensureFilterHeader(section);
    const body = section.querySelector('[data-mosp-filter-body]') || section.querySelector(':scope > .card-body') || section.querySelector('form');
    if (!body) return;

    const toggle = _ensureFilterToggle(section, header);
    const storageKey = _collapseStorageKey(cfg, section);
    const initiallyCollapsed = (() => {
      try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
    })();
    _setFilterCollapsed(section, body, toggle, initiallyCollapsed);

    toggle?.addEventListener('click', async () => {
      const nextCollapsed = !(section.classList.contains('mosp-filter-collapsed'));
      _setFilterCollapsed(section, body, toggle, nextCollapsed);
      try { localStorage.setItem(storageKey, nextCollapsed ? '1' : '0'); } catch {}

      if (nextCollapsed && getStickyEnabled(cfg, true)) {
        try {
          await persistStickyEnabled(false, cfg);
        } catch {
          setStickyEnabled(false, cfg);
          _setStickyCheckbox(false);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Querystring helpers
// ---------------------------------------------------------------------------

export function qs(key, fallback = null) {
  const p = new URLSearchParams(location.search);
  const v = p.get(key);
  return v === null ? fallback : v;
}

export function qbool(key, fallback = false) {
  const v = qs(key);
  if (v === null) return fallback;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return fallback;
}

export function qint(key, fallback = 0) {
  const v = qs(key);
  if (v === null) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

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

// ---------------------------------------------------------------------------
// CSRF + API helpers
// ---------------------------------------------------------------------------

function readCookie(name) {
  const target = `${name}=`;
  const parts = (document.cookie || '').split(/;\s*/);
  for (const p of parts) {
    if (p.startsWith(target)) return decodeURIComponent(p.slice(target.length));
  }
  return '';
}

function csrfToken(cfg) {
  return readCookie(cfg.csrf.cookieName);
}

function csrfHeaders(cfg) {
  const t = csrfToken(cfg);
  return t ? {[cfg.csrf.headerName]: t} : {};
}

function apiUrl(path, cfg) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = String(cfg.apiBase || '').trim();
  if (!base) return raw;

  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  if (raw.startsWith('/')) return `${b}${raw}`;
  return `${b}/${raw}`;
}

function redirectToLogin(cfg) {
  const next = location.pathname + (location.search || '');
  const url = new URL(cfg.auth.loginUrl || '/login.html', location.origin);
  if (next && next !== '/login.html') url.searchParams.set('next', next);
  location.href = url.pathname + url.search;
}

async function readError(res) {
  try {
    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function apiGet(path, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const res = await fetch(apiUrl(path, cfg), {credentials: 'same-origin'});
  if (res.status === 401) {
    redirectToLogin(cfg);
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return res.json();
}

async function _jsonish(res) {
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { return text; }
}

export async function apiPost(path, body, headers = {}, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const res = await fetch(apiUrl(path, cfg), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', ...csrfHeaders(cfg), ...headers},
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 401) { redirectToLogin(cfg); throw new Error('Not authenticated'); }
  return _jsonish(res);
}

export async function apiPatch(path, body, headers = {}, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const res = await fetch(apiUrl(path, cfg), {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', ...csrfHeaders(cfg), ...headers},
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 401) { redirectToLogin(cfg); throw new Error('Not authenticated'); }
  return _jsonish(res);
}

export async function apiPut(path, body, headers = {}, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const res = await fetch(apiUrl(path, cfg), {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', ...csrfHeaders(cfg), ...headers},
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 401) { redirectToLogin(cfg); throw new Error('Not authenticated'); }
  return _jsonish(res);
}

export async function apiDelete(path, headers = {}, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const res = await fetch(apiUrl(path, cfg), {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {...csrfHeaders(cfg), ...headers},
  });
  if (res.status === 401) { redirectToLogin(cfg); throw new Error('Not authenticated'); }
  return _jsonish(res);
}

export async function apiPostForm(path, formData, headers = {}, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const res = await fetch(apiUrl(path, cfg), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {...csrfHeaders(cfg), ...headers},
    body: formData,
  });
  if (res.status === 401) { redirectToLogin(cfg); throw new Error('Not authenticated'); }
  return _jsonish(res);
}

// Generic request helper (useful for apps migrating from older wrappers).
// Supports:
// - options.method
// - options.headers
// - options.json (object -> JSON body)
// - options.body (string/Blob/etc)
// - options.formData (FormData)
// - options.responseType: 'json' | 'text' | 'blob' | 'raw'
export async function apiRequest(path, options = {}, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const method = String(options?.method || 'GET').toUpperCase();
  const headers = {...(options?.headers || {})};

  const fetchOpts = {
    method,
    credentials: 'same-origin',
    headers,
  };

  // Body handling
  if (options?.formData) {
    fetchOpts.body = options.formData;
    Object.assign(fetchOpts.headers, csrfHeaders(cfg));
  } else if (Object.prototype.hasOwnProperty.call(options || {}, 'json')) {
    fetchOpts.body = JSON.stringify(options.json ?? {});
    Object.assign(fetchOpts.headers, {'Content-Type': 'application/json', ...csrfHeaders(cfg)});
  } else if (Object.prototype.hasOwnProperty.call(options || {}, 'body')) {
    fetchOpts.body = options.body;
    // Only add CSRF for mutating methods.
    if (method !== 'GET' && method !== 'HEAD') Object.assign(fetchOpts.headers, csrfHeaders(cfg));
  } else {
    if (method !== 'GET' && method !== 'HEAD') Object.assign(fetchOpts.headers, csrfHeaders(cfg));
  }

  const res = await fetch(apiUrl(path, cfg), fetchOpts);
  if (res.status === 401) {
    redirectToLogin(cfg);
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }

  const rt = String(options?.responseType || 'json');
  if (rt === 'raw') return res;
  if (rt === 'text') return res.text();
  if (rt === 'blob') return res.blob();
  // default json
  return res.json();
}

// Back-compat alias used in older frontends.
export const api = apiRequest;

// ---------------------------------------------------------------------------
// Framework helpers (optional; enabled via cfg.framework.enabled)
// ---------------------------------------------------------------------------

let _frameworkCache = null;
let _frameworkPromise = null;

function _normFramework(v) {
  const s = String(v ?? '').trim();
  return s || '';
}

function _frameworkFromUrl(cfg) {
  const raw = qs(cfg.framework.queryParam || 'framework');
  return _normFramework(raw);
}

function _frameworkFromStorage(cfg) {
  try {
    return _normFramework(localStorage.getItem(cfg.storage.frameworkKey));
  } catch {
    return '';
  }
}

function _storeFramework(slug, cfg) {
  const s = _normFramework(slug);
  if (!s) return;
  try { localStorage.setItem(cfg.storage.frameworkKey, s); } catch {}
}

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

function _applyFrameworkToNavLinks(framework, cfg) {
  const fw = _normFramework(framework || getCurrentFramework('', cfg));
  const links = document.querySelectorAll('a[data-nav-fw="1"]');
  for (const a of links) {
    const base = a.dataset.baseHref || a.getAttribute('href') || '/';
    if (!a.dataset.baseHref) a.dataset.baseHref = base;
    a.setAttribute('href', withFramework(base, fw, cfg));
  }
}

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

// ---------------------------------------------------------------------------
// Saved datalist for search (optional)
// ---------------------------------------------------------------------------

let _savedByName = new Map();
let _savedByNameLower = new Map();

export function resolveSavedUrl(rawName) {
  const key = String(rawName || '').trim();
  if (!key) return '';
  const direct = _savedByName.get(key);
  if (direct) return direct;
  const lower = key.toLowerCase();
  return _savedByNameLower.get(lower) || '';
}

// KEEN back-compat naming.
export function resolveSavedSearchUrl(rawName) {
  return resolveSavedUrl(rawName);
}

export function attachSavedAutocomplete(inputEl, datalistId = null) {
  if (!inputEl) return;
  const cfg = getUiConfig();
  inputEl.setAttribute('list', datalistId || cfg.search.datalistId || 'mospSavedSearches');
}

// KEEN back-compat naming.
export function attachSavedSearchAutocomplete(inputEl, datalistId = null) {
  return attachSavedAutocomplete(inputEl, datalistId);
}

async function _loadDatalist(cfg) {
  const id = cfg.search.datalistId || 'mospSavedSearches';
  const listEl = document.getElementById(id);
  if (!listEl) return [];

  listEl.innerHTML = '';
  _savedByName = new Map();
  _savedByNameLower = new Map();

  const ep = String(cfg.search.datalistEndpoint || '').trim();
  if (!ep) return [];

  try {
    const items = await apiGet(ep, cfg);
    const arr = Array.isArray(items?.items) ? items.items : (Array.isArray(items) ? items : []);
    for (const s of arr) {
      const name = String(s?.[cfg.search.datalistNameKey || 'name'] || '').trim();
      const url = String(s?.[cfg.search.datalistUrlKey || 'url'] || '').trim();
      if (!name || !url) continue;

      if (!_savedByName.has(name)) _savedByName.set(name, url);
      const lower = name.toLowerCase();
      if (!_savedByNameLower.has(lower)) _savedByNameLower.set(lower, url);

      const opt = document.createElement('option');
      opt.value = name;
      opt.label = shorten(url, 120);
      listEl.appendChild(opt);
    }
    return arr;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Shortcuts dropdown (optional, standardises "save this view")
// ---------------------------------------------------------------------------

async function _loadShortcuts(cfg) {
  const menu = document.getElementById('navShortcutsMenu');
  if (!menu) return;

  const ep = String(cfg.shortcuts.endpoint || '').trim();
  if (!ep) {
    // If no endpoint configured, hide the dropdown container
    const wrap = document.getElementById('navShortcutsWrap');
    if (wrap) wrap.style.display = 'none';
    return;
  }

  const render = (items) => {
    menu.innerHTML = '';

    // Save current view
    const liSave = document.createElement('li');
    const aSave = document.createElement('a');
    aSave.href = '#';
    aSave.className = 'dropdown-item';
    aSave.textContent = 'Save this view…';
    aSave.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const name = prompt('Shortcut name:', document.title || 'View');
      if (!name) return;
      const url = location.pathname + (location.search || '') + (location.hash || '');
      try {
        await apiPost(ep, {name, url}, {}, cfg);
        await _loadShortcuts(cfg);
      } catch (e) {
        alert(`Failed to save shortcut: ${e?.message || e}`);
      }
    });
    liSave.appendChild(aSave);
    menu.appendChild(liSave);

    const liDiv = document.createElement('li');
    liDiv.innerHTML = '<hr class="dropdown-divider">';
    menu.appendChild(liDiv);

    if (!items.length) {
      const liEmpty = document.createElement('li');
      const span = document.createElement('span');
      span.className = 'dropdown-item-text text-muted';
      span.textContent = 'No shortcuts yet.';
      liEmpty.appendChild(span);
      menu.appendChild(liEmpty);
      return;
    }

    for (const it of items) {
      const name = String(it?.name || '').trim();
      const url = String(it?.url || '').trim();
      const id = it?.id ?? it?.shortcut_id ?? null;
      if (!name || !url) continue;

      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center justify-content-between gap-2 px-2';

      const a = document.createElement('a');
      a.className = 'dropdown-item flex-grow-1';
      a.style.whiteSpace = 'nowrap';
      a.style.overflow = 'hidden';
      a.style.textOverflow = 'ellipsis';
      a.href = safeExternalHref(url) || url;
      a.textContent = name;

      row.appendChild(a);

      if (id !== null && id !== undefined) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline-danger';
        btn.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        btn.title = 'Delete shortcut';
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!confirm(`Delete shortcut "${name}"?`)) return;
          try {
            await apiDelete(`${ep}/${encodeURIComponent(String(id))}`, {}, cfg);
            await _loadShortcuts(cfg);
          } catch (e) {
            alert(`Failed to delete shortcut: ${e?.message || e}`);
          }
        });
        row.appendChild(btn);
      }

      li.appendChild(row);
      menu.appendChild(li);
    }
  };

  try {
    const data = await apiGet(ep, cfg);
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    render(items);
  } catch {
    const wrap = document.getElementById('navShortcutsWrap');
    if (wrap) wrap.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// KEEN-style source metadata helpers (used by KEEN; harmless elsewhere)
// ---------------------------------------------------------------------------

let _sourceMetaPromise = null;

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

function _srgbToLinear(c) {
  const x = c / 255;
  return (x <= 0.04045) ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

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

export function sourceLabel(source, metaMap) {
  const s = String(source || '');
  const m = metaMap ? metaMap[s] : null;
  return (m && m.label) ? m.label : s;
}

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

// ---------------------------------------------------------------------------
// Navbar (standard shell)
// ---------------------------------------------------------------------------

function _hasAny(me, keys) {
  if (!Array.isArray(keys) || !keys.length) return true;
  for (const k of keys) {
    if (!!me?.[k]) return true;
  }
  return false;
}

function _hasAll(me, keys) {
  if (!Array.isArray(keys) || !keys.length) return true;
  for (const k of keys) {
    if (!me?.[k]) return false;
  }
  return true;
}

function _resolveMaybeFn(v, me, cfg) {
  if (typeof v === 'function') {
    try { return v(me, cfg); } catch { return ''; }
  }
  return v;
}

// Allow {admin, user, default} shorthands for role-sensitive config fields.
function _resolveRoleVariant(v, me) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  if (me?.is_admin && Object.prototype.hasOwnProperty.call(v, 'admin')) return v.admin;
  if (!me?.is_admin && Object.prototype.hasOwnProperty.call(v, 'user')) return v.user;
  if (Object.prototype.hasOwnProperty.call(v, 'default')) return v.default;
  return v;
}

export function renderNavbar(active = '', me = null, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);

  const links = (cfg.links || []).filter((lnk) => {
    return _hasAny(me, lnk.requireAny) && _hasAll(me, lnk.requireAll);
  });

  const linkHtml = links.map((lnk) => {
    const label = String(_resolveMaybeFn(lnk.label, me, cfg) || '').trim() || 'Link';
    const href = String(_resolveMaybeFn(lnk.href, me, cfg) || '/').trim() || '/';
    const key = String(lnk.key || label).trim();
    const cls = key === active ? 'nav-link active' : 'nav-link';
    const fwAttr = cfg.framework.enabled ? ' data-nav-fw="1" ' : '';
    return `<li class="nav-item"><a class="${cls}"${fwAttr} data-base-href="${esc(href)}" href="${esc(href)}">${esc(label)}</a></li>`;
  }).join('');

  const logoutEnabled = cfg.auth.logoutEnabled !== false && !!me?.user;
  const acct = (cfg.auth.accountEnabled !== false && !!me?.user) ? `<a class="btn btn-sm btn-light me-2" href="${esc(cfg.auth.accountHref || '/account.html')}">Account</a>` : '';
  const logout = logoutEnabled ? `<button class="btn btn-sm btn-outline-light" id="navLogout" type="button">Logout</button>` : '';

  const frameworkBlock = cfg.framework.enabled ? `
      <div class="d-flex align-items-center gap-2 me-2">
        <label for="navFrameworkSelect" class="small text-light opacity-75 mb-0" style="white-space:nowrap;">${esc(cfg.framework.label || 'Framework')}</label>
        <select id="navFrameworkSelect" class="form-select form-select-sm" style="min-width:${Number(cfg.framework.selectMinWidthPx || 220)}px;" disabled>
          <option>Loading…</option>
        </select>
      </div>
  ` : '';

  const searchBlock = cfg.search.enabled ? `
      <form class="d-flex me-2" role="search" id="navSearchForm">
        <input class="form-control form-control-sm me-2" id="navSearch" type="search" placeholder="${esc(cfg.search.placeholder || 'Search')}" aria-label="Search" ${cfg.search.datalistId ? `list="${esc(cfg.search.datalistId)}"` : ''}>
        ${cfg.search.datalistId ? `<datalist id="${esc(cfg.search.datalistId)}"></datalist>` : ''}
        <button class="btn btn-sm btn-light" type="submit">Search</button>
      </form>
  ` : '';

  const shortcutsBlock = cfg.shortcuts.enabled ? `
      <div class="dropdown me-2" id="navShortcutsWrap">
        <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          ${esc(cfg.shortcuts.label || 'Shortcuts')}
        </button>
        <ul class="dropdown-menu dropdown-menu-end" id="navShortcutsMenu">
          <li><span class="dropdown-item-text text-muted">Loading…</span></li>
        </ul>
      </div>
  ` : '';

  const bellHref = String(_resolveMaybeFn(_resolveRoleVariant(cfg.bell.href, me), me, cfg) || '#');
  const bellTitle = String(_resolveMaybeFn(_resolveRoleVariant(cfg.bell.title, me), me, cfg) || 'Notifications');
  const bellBlock = cfg.bell.enabled ? `
      <a class="btn btn-sm btn-outline-light me-2 nav-question-bell" id="navBell" href="${esc(bellHref)}" title="${esc(bellTitle)}">
        <i class="bi bi-bell" aria-hidden="true"></i>
        <span class="badge rounded-pill text-bg-warning" id="navBellCount" style="display:none;"></span>
      </a>
  ` : '';

  // Optional extension point for app-specific controls (kept out of core).
  const extraHtml = String(_resolveMaybeFn(cfg.nav?.extraHtml, me, cfg) || '');

  return `
<nav class="navbar navbar-expand-lg navbar-dark navbar-keen fixed-top">
  <div class="container-fluid">
    <a class="navbar-brand fw-bold d-flex align-items-center gap-2" ${cfg.framework.enabled ? 'data-nav-fw="1" data-base-href="' + esc(cfg.brandHref || '/') + '"' : ''} href="${esc(cfg.brandHref || '/')}">
      <img src="${esc(cfg.brandIcon || '/favicon.svg')}" class="keen-brand-icon" alt="" aria-hidden="true">
      <span>${esc(cfg.appName || 'App')}</span>
    </a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mospNav" aria-controls="mospNav" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="mospNav">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">${linkHtml}</ul>
      ${frameworkBlock}
      ${searchBlock}
      <div class="d-flex align-items-center">
        ${extraHtml}
        ${shortcutsBlock}
        ${bellBlock}
        ${acct}
        ${logout}
      </div>
    </div>
  </div>
</nav>
`;
}

async function _initBell(cfg, me) {
  if (!cfg.bell.enabled) return;

  const countEl = document.getElementById('navBellCount');
  const bellEl = document.getElementById('navBell');
  if (!countEl || !bellEl) return;

  const setBellCount = (n) => {
    const v = Number(n || 0);
    if (v > 0) {
      countEl.style.display = '';
      countEl.textContent = String(v);
    } else {
      countEl.style.display = 'none';
      countEl.textContent = '';
    }
  };

  const refresh = async () => {
    const ep = String(_resolveMaybeFn(_resolveRoleVariant(cfg.bell.summaryEndpoint, me), me, cfg) || '').trim();
    if (!ep) return;
    try {
      const data = await apiGet(ep, cfg);
      const key = _resolveMaybeFn(_resolveRoleVariant(cfg.bell.countKey, me), me, cfg) || 'count';
      setBellCount(data?.[key] ?? data?.count ?? 0);
    } catch {
      // ignore
    }
  };

  // Expose for pages that change notification state.
  window.mospRefreshBell = refresh;
  if (cfg.appId === 'keen') window.keenRefreshBell = refresh;

  await refresh();

  // Realtime updates (optional)
  if (cfg.bell.wsUrl && 'WebSocket' in window) {
    const wsUrl = cfg.bell.wsUrl;
    let ws = null;
    let retryMs = 1000;

    const connect = () => {
      try { ws = new WebSocket(wsUrl); } catch { ws = null; return; }

      ws.onopen = () => { retryMs = 1000; };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data || '{}');
          if (msg?.type === cfg.bell.wsType && Object.prototype.hasOwnProperty.call(msg, 'count')) {
            setBellCount(msg.count || 0);
          }
        } catch {/* ignore */}
      };

      ws.onclose = () => {
        ws = null;
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30000);
      };

      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    connect();
  }

  // Polling fallback
  setInterval(refresh, 30000);
}

export async function initNavbar(cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);

  const mount = document.getElementById('navbar');
  if (!mount) return null;

  // Reserve space early to avoid jumping once the fixed navbar renders.
  document.documentElement.style.setProperty('--ui-nav-height', '72px');
  document.documentElement.style.setProperty('--keen-nav-height', '72px'); // legacy

  const active = document.body?.dataset?.page || '';

  // Ask backend who the current user is.
  let me = await apiGet(cfg.auth.meEndpoint, cfg);

  // Optional shape mapping
  if (typeof cfg.mapMe === 'function') {
    try { me = cfg.mapMe(me) || me; } catch {/* ignore */}
  }

  window.mospMe = me;
  if (cfg.appId === 'keen') window.keenMe = me;

  // Preferences: allow backend to set theme
  const theme = String(me?.preferences?.theme || '').trim();
  if (theme) applyTheme(theme, cfg);

  // Store preferences for timestamp formatting helpers
  window.mospDefaultTimezone = me?.default_timezone || 'Etc/UTC';
  window.mospPreferences = me?.preferences || {};
  window.mospPreferredFramework = _normFramework(me?.preferences?.default_framework);

  // Sync sticky/auto-apply from server-side preferences if present
  try { _syncUiPrefsFromMe(me, cfg); } catch {}

  // KEEN legacy globals (keep older page modules working during migration).
  if (cfg.appId === 'keen') {
    window.keenDefaultTimezone = window.mospDefaultTimezone;
    window.keenPreferences = window.mospPreferences;
    window.keenPreferredFramework = window.mospPreferredFramework;
  }

  mount.innerHTML = renderNavbar(active, me, cfg);

  // Offset page content so it doesn't sit underneath the fixed navbar.
  const updateNavHeight = () => {
    const nav = mount.querySelector('nav.navbar');
    const h = nav ? nav.offsetHeight : 0;
    document.documentElement.style.setProperty('--ui-nav-height', `${h}px`);
    document.documentElement.style.setProperty('--keen-nav-height', `${h}px`); // legacy
  };
  updateNavHeight();
  window.addEventListener('resize', updateNavHeight);

  // Framework picker + framework-aware nav links.
  if (cfg.framework.enabled) {
    try { await _initFrameworkSelector(cfg); }
    catch { _applyFrameworkToNavLinks(getCurrentFramework('', cfg), cfg); }
  }

  // Datalist autocomplete (optional)
  if (cfg.search.enabled && cfg.search.datalistEndpoint) {
    await _loadDatalist(cfg);
  }

  // Search form wiring
  if (cfg.search.enabled) {
    const form = document.getElementById('navSearchForm');
    const inp = document.getElementById('navSearch');
    const qKey = cfg.search.queryParam || 'q';

    if (inp) {
      const existingQ = qs(qKey);
      if (existingQ) inp.value = existingQ;
      if (cfg.search.datalistId) attachSavedAutocomplete(inp, cfg.search.datalistId);
    }

    if (form && inp) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const q = (inp.value || '').trim();

        if (typeof cfg.search.onSubmit === 'function') {
          try {
            const r = cfg.search.onSubmit({query: q, input: inp, form, cfg, me});
            const handled = (r && typeof r.then === 'function') ? await r : r;
            if (handled) return;
          } catch {
            /* ignore and fall back to default */
          }
        }

        if (cfg.search.resolveNamesToUrls && cfg.search.datalistEndpoint) {
          const saved = resolveSavedUrl(q);
          if (saved) {
            const jump = cfg.framework.enabled ? withFramework(saved, getCurrentFramework('', cfg), cfg) : saved;
            location.href = jump;
            return;
          }
        }

        const url = new URL(cfg.search.targetPath || '/', location.origin);
        if (q) url.searchParams.set(qKey, q);

        if (cfg.framework.enabled) {
          const fw = getCurrentFramework('', cfg);
          if (fw) url.searchParams.set(cfg.framework.queryParam || 'framework', fw);
        }
        location.href = url.pathname + url.search;
      });
    }
  }

  // Logout
  const logoutBtn = document.getElementById('navLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      // If backend provides an IdP-specific logout URL, prefer it.
      const direct = String(me?.logout_url || '').trim();
      if (direct) {
        location.href = direct;
        return;
      }

      try { await apiPost(cfg.auth.logoutEndpoint, {}, {}, cfg); } catch {}
      location.href = String(me?.logout_redirect || '').trim() || cfg.auth.logoutRedirect || cfg.auth.loginUrl || '/login.html';
    });
  }

  // Shortcuts dropdown
  if (cfg.shortcuts.enabled) {
    await _loadShortcuts(cfg);
  }

  // Bell
  await _initBell(cfg, me);

  // Collapsible filter sections
  try { initCollapsibleFilterSections(cfg); } catch {}

  return me;
}

// ---------------------------------------------------------------------------
// Timestamp formatting (shared UX across apps)
// ---------------------------------------------------------------------------

function _normalizeIsoAssumingUtc(iso) {
  const s = String(iso || '').trim();
  if (!s) return '';
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s + 'Z';
  return s;
}

function _dateFromIso(iso) {
  const norm = _normalizeIsoAssumingUtc(iso);
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

function _effectiveTimezone() {
  const prefs = window.mospPreferences || {};
  const useLocal = !!prefs.use_local_timezone;
  if (useLocal) {
    return (prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim();
  }
  return (window.mospDefaultTimezone || '').trim();
}

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
export function tsSortKey(iso) {
  const d = _dateFromIso(iso);
  return d ? String(d.getTime()) : '';
}

// --- Date inputs (dd/mm/yyyy) ---
export function isoDateToDmy(iso) {
  const s = String(iso || '').trim();
  const m = s.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function dmyToIsoDate(dmy) {
  const raw = String(dmy || '').trim();
  if (!raw) return '';
  const m = raw.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  if (!m) return '';
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return '';
  if (yyyy < 1900 || yyyy > 3000) return '';
  if (mm < 1 || mm > 12) return '';
  if (dd < 1 || dd > 31) return '';
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== (mm - 1) || dt.getUTCDate() !== dd) return '';
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

export function wireIsoDmyDateField(hidden, text, pickBtn, opts = {}) {
  if (!hidden || !text) return null;

  const listenInput = (opts && Object.prototype.hasOwnProperty.call(opts, 'listenInput')) ? !!opts.listenInput : true;
  const dispatchChangeOnText = (opts && Object.prototype.hasOwnProperty.call(opts, 'dispatchChangeOnText')) ? !!opts.dispatchChangeOnText : false;
  const bubbles = (opts && Object.prototype.hasOwnProperty.call(opts, 'bubbles')) ? !!opts.bubbles : true;

  const syncTextFromHidden = () => { text.value = isoDateToDmy(hidden.value || ''); };

  const syncHiddenFromText = () => {
    const raw = String(text.value || '').trim();
    if (!raw) { hidden.value = ''; return; }
    const iso = dmyToIsoDate(raw);
    if (iso) hidden.value = iso;
  };

  const maybeDispatchHiddenChange = () => {
    if (!dispatchChangeOnText) return;
    try { hidden.dispatchEvent(new Event('change', {bubbles})); } catch {}
  };

  if (listenInput) hidden.addEventListener('input', syncTextFromHidden);
  hidden.addEventListener('change', syncTextFromHidden);

  text.addEventListener('change', () => { syncHiddenFromText(); maybeDispatchHiddenChange(); });
  text.addEventListener('blur', () => { syncHiddenFromText(); maybeDispatchHiddenChange(); });

  if (pickBtn) {
    pickBtn.addEventListener('click', () => {
      try {
        if (typeof hidden.showPicker === 'function') hidden.showPicker();
        else { hidden.focus(); hidden.click(); }
      } catch {}
    });
  }

  syncTextFromHidden();
  return {syncTextFromHidden, syncHiddenFromText};
}

// ---------------------------------------------------------------------------
// Table sorting (shared UX)
// ---------------------------------------------------------------------------

export function enableTableSorting(root = document) {
  const tables = Array.from(root.querySelectorAll('table[data-sortable], table.sortable'));
  for (const table of tables) {
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) continue;

    const headers = Array.from(thead.querySelectorAll('th'));
    headers.forEach((th, idx) => {
      if (th.hasAttribute('data-nosort')) return;
      th.classList.add('sortable');
      th.tabIndex = 0;
      th.setAttribute('role', 'button');
      th.setAttribute('aria-label', `Sort by ${th.textContent?.trim() || 'column'}`);

      const handler = (ev) => { ev.preventDefault(); sortTableByColumn(table, idx); };
      th.addEventListener('click', handler);
      th.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') handler(ev); });
    });
  }
}

function cellSortValue(cell) {
  if (!cell) return '';
  const ds = cell.getAttribute('data-sort');
  if (ds !== null && ds !== '') return ds;
  return (cell.textContent || '').trim();
}

function parseSortValue(v) {
  const s = String(v ?? '').trim();
  if (!s) return {t: 'str', v: ''};
  const num = s.replace(/,/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(num)) return {t: 'num', v: parseFloat(num)};
  const d = Date.parse(s);
  if (!Number.isNaN(d) && /\d/.test(s)) return {t: 'date', v: d};
  return {t: 'str', v: s.toLowerCase()};
}

function sortTableByColumn(table, colIndex) {
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  const ths = Array.from(thead.querySelectorAll('th'));
  const th = ths[colIndex];
  if (!th) return;

  const cur = th.getAttribute('data-sort-dir') || '';
  const dir = cur === 'asc' ? 'desc' : 'asc';

  ths.forEach((h) => {
    if (h !== th) {
      h.removeAttribute('data-sort-dir');
      h.classList.remove('sort-asc', 'sort-desc');
    }
  });

  th.setAttribute('data-sort-dir', dir);
  th.classList.remove('sort-asc', 'sort-desc');
  th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');

  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length <= 1) return;

  const decorated = rows.map((tr, i) => {
    const cell = tr.children?.[colIndex];
    if (!cell) return {tr, key: {t: 'str', v: '~~~~'}, i};
    const raw = cellSortValue(cell);
    return {tr, key: parseSortValue(raw), i};
  });

  decorated.sort((a, b) => {
    const ka = a.key; const kb = b.key;
    const order = {num: 0, date: 1, str: 2};
    if (ka.t !== kb.t) return order[ka.t] - order[kb.t];
    let cmp = 0;
    if (ka.v < kb.v) cmp = -1;
    else if (ka.v > kb.v) cmp = 1;
    else cmp = a.i - b.i;
    return dir === 'asc' ? cmp : -cmp;
  });

  for (const r of decorated) tbody.appendChild(r.tr);
}

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

export function toast(containerEl, message, kind = 'info', ttlMs = 0) {
  if (!containerEl) return;
  const cls = {
    info: 'alert alert-info',
    secondary: 'alert alert-secondary',
    success: 'alert alert-success',
    warning: 'alert alert-warning',
    danger: 'alert alert-danger',
  }[kind] || 'alert alert-info';
  containerEl.className = cls;
  containerEl.textContent = message;
  containerEl.style.display = '';

  const token = String(Date.now()) + String(Math.random());
  containerEl.dataset.toastToken = token;

  const ms = Number(ttlMs || 0);
  if (ms > 0) {
    window.setTimeout(() => {
      if (containerEl.dataset.toastToken === token) {
        containerEl.style.display = 'none';
        containerEl.textContent = '';
      }
    }, ms);
  }
}

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

// ---------------------------------------------------------------------------
// Statistics-style filter helpers
// ---------------------------------------------------------------------------

export function isoToday() {
  const dt = new Date();
  dt.setUTCHours(0, 0, 0, 0);
  return isoYmd(dt);
}

export function isoDaysAgo(days) {
  const dt = new Date();
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() - Number(days || 0));
  return isoYmd(dt);
}

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

export function setDatalistOptions(datalistEl, options) {
  if (!(datalistEl instanceof HTMLElement)) return;
  const opts = Array.isArray(options) ? options : [];
  datalistEl.innerHTML = opts.map((v) => `<option value="${esc(String(v ?? ''))}"></option>`).join('');
}

export async function fetchDistinct(table, column, q = '', opts = {}) {
  const limit = Number(opts?.limit || 20);
  const mode = String(opts?.mode || 'contains');
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('limit', String(limit));
  params.set('mode', mode);
  return await apiGet(`/api/v1/meta/distinct/${encodeURIComponent(table)}/${encodeURIComponent(column)}?${params.toString()}`);
}

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

export function attachMydexidAutocomplete(inputEl, datalistEl) {
  return attachDistinctAutocomplete(inputEl, datalistEl, {table: 'pds', column: 'mydex_id', limit: 30, mode: 'contains'});
}

// ---------------------------------------------------------------------------
// Auto-apply filters
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Date range guardrails
// ---------------------------------------------------------------------------

export function isoYmd(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${dateObj.getUTCFullYear()}-${pad2(dateObj.getUTCMonth() + 1)}-${pad2(dateObj.getUTCDate())}`;
}

export function parseYmd(s) {
  const t = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Enforce an inclusive maximum span (in days). Returns possibly adjusted strings.
function formatDisplayDateYmd(ymd) {
  const raw = String(ymd || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function enforceMaxDateRange(fromStr, toStr, maxDays = 365) {
  const from = parseYmd(fromStr);
  const to = parseYmd(toStr);
  if (!from || !to) return {from: fromStr || '', to: toStr || '', adjusted: false, message: ''};
  const msPerDay = 86400000;
  const spanDays = Math.floor((to.getTime() - from.getTime()) / msPerDay);
  if (!Number.isFinite(spanDays) || spanDays <= maxDays) {
    return {from: fromStr || '', to: toStr || '', adjusted: false, message: ''};
  }
  const newFrom = new Date(to.getTime() - (maxDays * msPerDay));
  const nf = isoYmd(newFrom);
  return {
    from: nf,
    to: toStr || '',
    adjusted: true,
    message: `Date range limited to a maximum of ${maxDays} days between the two selected dates. Adjusted From date to ${formatDisplayDateYmd(nf)}.`,
  };
}

// ---------------------------------------------------------------------------
// Taxonomy / capability pill browser
// ---------------------------------------------------------------------------

function _escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function _asSet(v) {
  if (!v) return new Set();
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  try {
    return new Set(v);
  } catch {
    return new Set();
  }
}

function _pathFor(pathsById, id) {
  if (!pathsById) return '';
  if (pathsById instanceof Map) return pathsById.get(Number(id)) || '';
  return pathsById[String(id)] || pathsById[Number(id)] || '';
}

// Render a hierarchical taxonomy as expandable, clickable "pills".
// This is intentionally framework-agnostic so multiple apps can share it.
//
// Required options:
//   - container: HTMLElement
//   - tree: array of nodes (each node: {id, key?, display_name?, children?})
//
// Optional options:
//   - selectedIds: Set/array of ids (multi-select)
//   - selectedId: number (single-select)
//   - expandedIds: Set/array of ids that are expanded
//   - searchTerm: string used to filter by name/key/path
//   - pathsById: Map/object id->path string
//   - selectionMode: 'multi' | 'single' (default: 'multi')
//   - showSelectedPills: boolean (default: true)
//   - emptySelectedText: string
//   - labelForNode(node): string
//   - metaForNode(node): string (small line under pill)
//   - colorForNode(node): css color string used for --cap-color
//   - onToggleSelect(id, node)
//   - onSelect(id, node)
//   - onToggleExpand(id, node)
export function renderTaxonomyPillsBrowser(opts) {
  const o = opts || {};
  const container = o.container;
  if (!container) return;

  const tree = Array.isArray(o.tree) ? o.tree : [];
  const selectionMode = (o.selectionMode === 'single') ? 'single' : 'multi';
  const showSelectedPills = o.showSelectedPills !== false;
  const emptySelectedText = String(o.emptySelectedText || 'No categories selected.');

  const expandedIds = _asSet(o.expandedIds);
  const selectedIds = _asSet(o.selectedIds);
  const selectedId = (selectionMode === 'single') ? Number(o.selectedId ?? NaN) : NaN;
  const term = String(o.searchTerm || '').trim().toLowerCase();

  const labelForNode = (typeof o.labelForNode === 'function')
    ? o.labelForNode
    : (node) => (node?.display_name || node?.display || node?.name || node?.key || String(node?.id || '')).trim();

  const metaForNode = (typeof o.metaForNode === 'function')
    ? o.metaForNode
    : (node) => {
      const p = _pathFor(o.pathsById, node?.id);
      return p && p !== labelForNode(node) ? p : '';
    };

  const colorForNode = (typeof o.colorForNode === 'function')
    ? o.colorForNode
    : () => '';

  // Build a quick lookup map for selected pill rendering.
  const byId = new Map();
  const visit = (n) => {
    if (!n) return;
    byId.set(Number(n.id), n);
    (n.children || []).forEach(visit);
  };
  tree.forEach(visit);

  const shouldShowNode = (node) => {
    if (!term) return true;
    const path = _pathFor(o.pathsById, node?.id);
    const hay = [labelForNode(node), node?.key, path].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(term)) return true;
    return (node.children || []).some((c) => shouldShowNode(c));
  };

  const renderSelected = () => {
    if (selectionMode === 'single') return '';
    if (!showSelectedPills) return '';
    if (!selectedIds.size) return `<div class="small">${_escapeHtml(emptySelectedText)}</div>`;

    const nodes = Array.from(selectedIds)
      .map((id) => byId.get(Number(id)))
      .filter(Boolean)
      .sort((a, b) => String(labelForNode(a)).localeCompare(String(labelForNode(b))));

    return nodes.map((node) => {
      const c = colorForNode(node);
      const p = _pathFor(o.pathsById, node.id) || labelForNode(node);
      return `
        <button type="button" class="capability-pill selected selected-removable" data-action="remove" data-node-id="${Number(node.id)}" style="--cap-color:${_escapeHtml(c)}" title="${_escapeHtml(p)}">
          <span class="pill-label">${_escapeHtml(labelForNode(node))}</span>
          <span class="remove-x" aria-hidden="true">×</span>
        </button>
      `;
    }).join('');
  };

  const renderNode = (node, depth = 0) => {
    if (!shouldShowNode(node)) return '';
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const autoExpand = Boolean(term);
    const isExpanded = hasChildren && (autoExpand || expandedIds.has(Number(node.id)));
    const isSelected = (selectionMode === 'single')
      ? Number(node.id) === selectedId
      : selectedIds.has(Number(node.id));
    const c = colorForNode(node);
    const meta = metaForNode(node);

    const childrenHtml = isExpanded
      ? (node.children || []).map((cNode) => renderNode(cNode, depth + 1)).join('')
      : '';

    return `
      <div class="cap-tree-node depth-${Math.min(depth, 4)}" data-node-id="${Number(node.id)}">
        <div class="cap-node-row">
          ${hasChildren
            ? `<button type="button" class="cap-toggle ${isExpanded ? 'expanded' : ''}" data-toggle-node="${Number(node.id)}" aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${_escapeHtml(labelForNode(node))}">${isExpanded ? '▾' : '▸'}</button>`
            : `<span class="cap-toggle-spacer" aria-hidden="true"></span>`}
          <div class="cap-tree-node-content">
            <button type="button" class="capability-pill ${isSelected ? 'selected' : ''}" data-action="pick" data-node-id="${Number(node.id)}" style="--cap-color:${_escapeHtml(c)}">
              <span class="pill-label">${_escapeHtml(labelForNode(node))}</span>
            </button>
            ${meta ? `<div class="cap-tree-meta small muted">${_escapeHtml(meta)}</div>` : ''}
          </div>
        </div>
        ${childrenHtml ? `<div class="cap-children">${childrenHtml}</div>` : ''}
      </div>
    `;
  };

  const selectedHtml = renderSelected();
  const treeHtml = tree.map((n) => renderNode(n, 0)).join('');

  container.innerHTML = `
    ${showSelectedPills && selectionMode === 'multi' ? `<div class="selected-pills">${selectedHtml}</div>` : ''}
    <div class="capability-tree-wrap">${treeHtml || '<div class="small">No categories available.</div>'}</div>
  `;

  // Pick / remove actions.
  container.querySelectorAll('button[data-action][data-node-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-node-id'));
      if (Number.isNaN(id)) return;
      const node = byId.get(id);
      const action = btn.getAttribute('data-action');
      if (selectionMode === 'single') {
        if (typeof o.onSelect === 'function') o.onSelect(id, node);
        return;
      }
      // multi
      if (action === 'pick' || action === 'remove') {
        if (typeof o.onToggleSelect === 'function') o.onToggleSelect(id, node);
      }
    });
  });

  // Expand/collapse actions.
  container.querySelectorAll('button[data-toggle-node]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = Number(btn.getAttribute('data-toggle-node'));
      if (Number.isNaN(id)) return;
      const node = byId.get(id);
      if (typeof o.onToggleExpand === 'function') o.onToggleExpand(id, node);
    });
  });
}
