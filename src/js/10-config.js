// MOSP design system: Config.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// NOTE: KEEN is treated as the baseline shell; other apps override via
// `window.mospUiConfig`.
const DEFAULT_CONFIG = {
  appId: 'keen',
  appName: 'Keen',
  brandIcon: '/keen.svg',
  brandHref: '/index.html',
  // Navigation links. Each entry:
  // { label, href, key, requireAny?: ['is_admin', 'can_audit_trail'], requireAll?: [] }
  // label/href MAY be functions (me, cfg) => string for role-aware nav.
  links: [
    {key: 'home', label: 'Home', href: '/index.html'},
    {key: 'controls', label: 'Controls', href: '/controls.html'},
    {key: 'clauses', label: 'Clauses', href: '/clauses.html'},
    {key: 'events', label: 'Events', href: '/events.html'},
    {key: 'sources', label: 'Sources', href: '/sources.html'},
    {key: 'viz', label: 'Visuals', href: '/visualisation.html'},
    {key: 'risks', label: 'Risks', href: '/risks.html', requireAny: ['is_admin', 'can_view_risks', 'can_manage_risks']},
    {key: 'audits', label: 'Audits', href: '/audits.html', requireAny: ['is_admin', 'can_view_audits', 'can_manage_audits']},
    {key: 'diary', label: 'Diary', href: '/events.html?source=diary', requireAny: ['is_admin']},
    {key: 'admin', label: (me) => (me?.is_admin ? 'Admin' : 'Audit'), href: (me) => (me?.is_admin ? '/admin.html' : '/admin.html#audit'), requireAny: ['is_admin', 'can_audit_trail']},
  ],
  // If true, nav links will automatically be augmented with ?framework=<slug>
  framework: {
    enabled: true,
    label: 'Framework',
    queryParam: 'framework',
    endpoint: '/api/v1/frameworks',
    default: '',
    // Let the framework picker fit its contents without forcing a wide nav item.
    selectMinChars: 12,
    selectMaxChars: 26,
    selectExtraChars: 4,
    // Backwards compatibility: set this only when an app deliberately needs a fixed minimum.
    selectMinWidthPx: 0,
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
    // Collapse the nav earlier so laptops/tablets get a hamburger instead of cramped controls.
    expandClass: 'navbar-expand-xxl',
    // Optional HTML (string or function(me,cfg)=>string) injected into the right
    // side of the navbar, before shortcuts/bell/account/logout.
    extraHtml: (me) => ((me?.can_manage_audits || me?.is_admin) ? '<a class="btn btn-sm btn-success me-2" data-nav-fw="1" data-base-href="/audits.html?new=1" href="/audits.html?new=1"><i class="bi bi-clipboard2-plus me-1" aria-hidden="true"></i><span class="nav-label-optional">Start audit</span></a>' : ''),
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
  // Visible text-date format for shared date helpers. Native/API values stay YYYY-MM-DD.
  // Apps may override with `dateFormat: 'dmy'` or `locale: {dateFormat: 'dmy'}`.
  dateFormat: 'ymd',
  locale: {
    dateFormat: 'ymd',
  },
  // Optional hook to adjust the returned `me` object (e.g. map shape across apps)
  mapMe: null,
};

/**
 * Recursively merge plain configuration objects without mutating the inputs.
 */
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

/**
 * Resolve the effective MOSP UI configuration from defaults, window-level config, and call-specific overrides.
 */
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
