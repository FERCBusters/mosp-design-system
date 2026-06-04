// MOSP design system: Navbar.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Navbar (standard shell)
// ---------------------------------------------------------------------------

/**
 * Check whether the current user has at least one of a set of permission flags.
 */
function _hasAny(me, keys) {
  if (!Array.isArray(keys) || !keys.length) return true;
  for (const k of keys) {
    if (!!me?.[k]) return true;
  }
  return false;
}

/**
 * Check whether the current user has every permission flag in a set.
 */
function _hasAll(me, keys) {
  if (!Array.isArray(keys) || !keys.length) return true;
  for (const k of keys) {
    if (!me?.[k]) return false;
  }
  return true;
}

function _featureAllowed(me, cfgFragment) {
  return _hasAny(me, cfgFragment?.requireAny) && _hasAll(me, cfgFragment?.requireAll);
}

function _meCacheKey(cfg) {
  const app = String(cfg.appId || 'app').replace(/[^A-Za-z0-9_.:-]/g, '_');
  const ep = String(cfg.auth?.meEndpoint || '').replace(/[^A-Za-z0-9_.:/?-]/g, '_');
  return `mosp:${app}:me:${ep}`;
}

function _readCachedMe(cfg) {
  const ttl = Number(cfg.auth?.meCacheMs || 0);
  if (!ttl || ttl <= 0 || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(_meCacheKey(cfg));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || !parsed.ts) return null;
    if ((Date.now() - Number(parsed.ts || 0)) > ttl) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function _writeCachedMe(cfg, me) {
  const ttl = Number(cfg.auth?.meCacheMs || 0);
  if (!ttl || ttl <= 0 || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(_meCacheKey(cfg), JSON.stringify({ts: Date.now(), data: me || null}));
  } catch {
    // ignore storage quota/private-mode errors
  }
}

export function clearCachedMe(cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(_meCacheKey(cfg)); } catch {}
}

/**
 * Resolve a config value that may be a static value or a function of user/config.
 */
function _resolveMaybeFn(v, me, cfg) {
  if (typeof v === 'function') {
    try { return v(me, cfg); } catch { return ''; }
  }
  return v;
}

// Allow {admin, user, default} shorthands for role-sensitive config fields.
/**
 * Resolve a config value that may have admin/user/default variants.
 */
function _resolveRoleVariant(v, me) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  if (me?.is_admin && Object.prototype.hasOwnProperty.call(v, 'admin')) return v.admin;
  if (!me?.is_admin && Object.prototype.hasOwnProperty.call(v, 'user')) return v.user;
  if (Object.prototype.hasOwnProperty.call(v, 'default')) return v.default;
  return v;
}


/**
 * Check whether a navbar element overflows horizontally.
 */
function _navElementOverflows(el) {
  if (!el) return false;
  return (el.scrollWidth || 0) > ((el.clientWidth || 0) + 2);
}

/**
 * Adjust navbar density classes to reduce overflow on narrower layouts.
 */
function _applyNavDensity(mount) {
  const nav = mount?.querySelector?.('nav.navbar-keen');
  if (!nav) return;

  const container = nav.querySelector('.container-fluid');
  const collapse = nav.querySelector('.navbar-collapse');
  const collapseStyle = collapse ? window.getComputedStyle(collapse) : null;

  nav.classList.remove('nav-density-compact', 'nav-density-tight', 'nav-density-overflow');

  // When Bootstrap has collapsed the nav into the hamburger state, the layout is
  // vertical rather than width-constrained. Let Bootstrap handle that mode.
  if (collapseStyle && collapseStyle.display === 'none') return;

  if (!_navElementOverflows(container) && !_navElementOverflows(collapse)) return;

  nav.classList.add('nav-density-compact');
  if (!_navElementOverflows(container) && !_navElementOverflows(collapse)) return;

  nav.classList.add('nav-density-tight');
  if (!_navElementOverflows(container) && !_navElementOverflows(collapse)) return;

  nav.classList.add('nav-density-overflow');
}

/**
 * Install resize observers/listeners that keep navbar density in sync.
 */
function _initNavDensity(mount, onAfterApply = null) {
  const run = () => {
    _applyNavDensity(mount);
    if (typeof onAfterApply === 'function') {
      try { onAfterApply(); } catch { /* ignore layout callback errors */ }
    }
  };

  requestAnimationFrame(run);
  window.addEventListener('resize', run);

  try {
    const nav = mount?.querySelector?.('nav.navbar-keen');
    if (nav && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(() => { requestAnimationFrame(run); });
      ro.observe(nav);
      const container = nav.querySelector('.container-fluid');
      if (container) ro.observe(container);
    }
  } catch {
    // ResizeObserver is progressive enhancement only.
  }

  return run;
}

/**
 * Render the shared MOSP navbar for the current user and configuration.
 */
export function renderNavbar(active = '', me = null, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);

  const links = (cfg.links || []).filter((lnk) => _featureAllowed(me, lnk));

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
      <div class="d-flex align-items-center gap-2 me-2 mosp-nav-framework">
        <label for="navFrameworkSelect" class="small text-light opacity-75 mb-0 mosp-nav-framework-label" style="white-space:nowrap;">${esc(cfg.framework.label || '')}</label>
        <select id="navFrameworkSelect" class="form-select form-select-sm mosp-nav-framework-select" disabled>
          <option>Loading…</option>
        </select>
      </div>
  ` : '';

  const searchAllowed = !!cfg.search.enabled && _featureAllowed(me, cfg.search);
  const searchLabel = esc(cfg.search.label || 'Search');
  const searchPlaceholder = esc(cfg.search.placeholder || 'Search');
  const searchDatalist = cfg.search.datalistId ? `list="${esc(cfg.search.datalistId)}"` : '';
  const searchDatalistHtml = cfg.search.datalistId ? `<datalist id="${esc(cfg.search.datalistId)}"></datalist>` : '';
  const searchBlock = searchAllowed ? `
      <div class="me-2 mosp-nav-search">
        <button class="btn btn-sm btn-light mosp-nav-search-button" id="navSearchOpen" type="button" data-bs-toggle="modal" data-bs-target="#navSearchModal" aria-label="${searchLabel}" title="${searchLabel}">
          <i class="bi bi-search" aria-hidden="true"></i>
          <span class="visually-hidden">${searchLabel}</span>
        </button>
      </div>
  ` : '';

  const searchModalBlock = searchAllowed ? `
<div class="modal fade mosp-search-modal" id="navSearchModal" tabindex="-1" aria-labelledby="navSearchModalTitle" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content" role="search" id="navSearchForm">
      <div class="modal-header">
        <h2 class="modal-title h5" id="navSearchModalTitle"><i class="bi bi-search me-2" aria-hidden="true"></i>${searchLabel}</h2>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <label class="form-label fw-semibold" for="navSearch">${searchLabel}</label>
        <input class="form-control form-control-lg mosp-nav-search-input" id="navSearch" type="search" placeholder="${searchPlaceholder}" aria-label="${searchLabel}" ${searchDatalist}>
        ${searchDatalistHtml}
        <div class="form-text">Search evidence/events, or type the name of a saved shortcut.</div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" type="submit"><i class="bi bi-search me-1" aria-hidden="true"></i>Search</button>
      </div>
    </form>
  </div>
</div>
  ` : '';

  const shortcutsLabel = esc(cfg.shortcuts.label || 'Shortcuts');
  const shortcutsBlock = cfg.shortcuts.enabled ? `
      <div class="dropdown me-2" id="navShortcutsWrap">
        <button class="btn btn-sm btn-outline-light" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="${shortcutsLabel}" title="${shortcutsLabel}">
          <i class="bi bi-bookmark-star" aria-hidden="true"></i>
          <span class="visually-hidden">${shortcutsLabel}</span>
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
  const expandClass = String(cfg.nav?.expandClass || 'navbar-expand-xxl').replace(/[^A-Za-z0-9_-]/g, '') || 'navbar-expand-xxl';

  return `
<nav class="navbar ${esc(expandClass)} navbar-dark navbar-keen fixed-top">
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
      <div class="d-flex align-items-center mosp-nav-actions">
        ${extraHtml}
        ${shortcutsBlock}
        ${bellBlock}
        ${acct}
        ${logout}
      </div>
    </div>
  </div>
</nav>
${searchModalBlock}
`;
}

/**
 * Initialise notification bell counts, polling, and optional websocket updates.
 */
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

/**
 * Fetch the current user, render the navbar, and initialise shared page behaviours.
 */
export async function initNavbar(cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);

  const mount = document.getElementById('navbar');
  if (!mount) return null;

  // Reserve space early to avoid jumping once the fixed navbar renders.
  document.documentElement.style.setProperty('--ui-nav-height', '72px');
  document.documentElement.style.setProperty('--keen-nav-height', '72px'); // legacy

  const active = document.body?.dataset?.page || '';

  // Ask backend who the current user is. Use a short-lived per-tab cache so
  // ordinary page-to-page navigation does not refetch the same /me payload for
  // every navbar render. Backend route permissions remain authoritative.
  let me = _readCachedMe(cfg);
  if (!me) {
    me = await apiGet(cfg.auth.meEndpoint, cfg);
    _writeCachedMe(cfg, me);
  }

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
  window.mospDefaultDateFormat = me?.default_date_format || getUiConfig().dateFormat || 'ymd';
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

  // Let Bootstrap's navbar-expand-* breakpoint decide when to use the
  // hamburger. While the nav is expanded, progressively tighten spacing/font
  // size if the available width becomes cramped, including at browser zoom.
  const refreshNavLayout = _initNavDensity(mount, updateNavHeight);
  refreshNavLayout();

  // Framework picker + framework-aware nav links.
  if (cfg.framework.enabled) {
    try { await _initFrameworkSelector(cfg); }
    catch { _applyFrameworkToNavLinks(getCurrentFramework('', cfg), cfg); }
    refreshNavLayout();
  }

  // Datalist autocomplete (optional)
  const searchAllowed = !!cfg.search.enabled && _featureAllowed(me, cfg.search);
  if (searchAllowed && cfg.search.datalistEndpoint) {
    await _loadDatalist(cfg);
  }

  // Search form wiring
  if (searchAllowed) {
    const form = document.getElementById('navSearchForm');
    const inp = document.getElementById('navSearch');
    const qKey = cfg.search.queryParam || 'q';

    if (inp) {
      const existingQ = qs(qKey);
      if (existingQ) inp.value = existingQ;
      if (cfg.search.datalistId) attachSavedAutocomplete(inp, cfg.search.datalistId);
    }

    const modalEl = document.getElementById('navSearchModal');
    if (modalEl && inp) {
      modalEl.addEventListener('shown.bs.modal', () => {
        try { inp.focus(); inp.select(); } catch { /* ignore */ }
      });
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

      clearCachedMe(cfg);
      try { await apiPost(cfg.auth.logoutEndpoint, {}, {}, cfg); } catch {}
      location.href = String(me?.logout_redirect || '').trim() || cfg.auth.logoutRedirect || cfg.auth.loginUrl || '/login.html';
    });
  }

  // Shortcuts dropdown
  if (cfg.shortcuts.enabled) {
    await _loadShortcuts(cfg);
    refreshNavLayout();
  }

  // Bell
  await _initBell(cfg, me);
  refreshNavLayout();

  // Keep content offset correct while the hamburger menu opens/closes.
  const navCollapse = mount.querySelector('.navbar-collapse');
  if (navCollapse) {
    navCollapse.addEventListener('shown.bs.collapse', refreshNavLayout);
    navCollapse.addEventListener('hidden.bs.collapse', refreshNavLayout);
  }

  // Collapsible filter/visualisation sections
  try { initCollapsibleFilterSections(cfg); } catch {}
  try { initCollapsibleVisualisationSections(cfg); } catch {}

  return me;
}
