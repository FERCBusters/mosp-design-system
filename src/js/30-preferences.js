// MOSP design system: Preferences.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// UI behaviour preferences (sticky, auto-apply) stored in localStorage
// ---------------------------------------------------------------------------

/**
 * Parse common boolean-like values while preserving a fallback for unknown values.
 */
function _parseBool(v, fallback) {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === '') return fallback;
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return fallback;
}

/**
 * Resolve the localStorage key used for sticky filter/chart preference state.
 */
function _stickyKey(cfg) {
  return (cfg && cfg.storage && cfg.storage.stickyKey) ? String(cfg.storage.stickyKey) : `${cfg.appId}_sticky`;
}

/**
 * Resolve the localStorage key used for auto-apply preference state.
 */
function _autoApplyKey(cfg) {
  return (cfg && cfg.storage && cfg.storage.autoApplyKey) ? String(cfg.storage.autoApplyKey) : `${cfg.appId}_auto_apply`;
}

/**
 * Returns whether sticky filter/chart containers should be enabled.
 * Stored as a local-only preference (not sent to the backend).
 */
export function getStickyEnabled(cfgOverrides = null, fallback = false) {
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
  const enabled = getStickyEnabled(cfg, false);
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
/**
 * Synchronise UI preference values returned by the backend into localStorage and page state.
 */
function _syncUiPrefsFromMe(me, cfg) {
  const prefs = me?.preferences || {};
  const hasSticky = typeof prefs.sticky_enabled === 'boolean';
  const hasAuto = typeof prefs.auto_apply_enabled === 'boolean';

  if (hasSticky) setStickyEnabled(!!prefs.sticky_enabled, cfg);
  if (hasAuto) setAutoApplyEnabled(!!prefs.auto_apply_enabled, cfg);
}

/**
 * Build a per-page localStorage key for collapsible filter sections.
 */
function _collapseStorageKey(cfg, section) {
  const raw = String(section?.dataset?.mospFilterSection || '').trim() || location.pathname;
  return `${cfg.appId}:filters-collapsed:${raw}`;
}

/**
 * Update any shared sticky preference checkbox on the current page.
 */
function _setStickyCheckbox(enabled) {
  const box = document.getElementById('prefSticky');
  if (box instanceof HTMLInputElement) box.checked = !!enabled;
}

/**
 * Persist sticky preference locally and, when configured, back to the application API.
 */
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

/**
 * Apply collapsed/expanded state to a filter section and its toggle.
 */
function _setFilterCollapsed(section, body, toggle, collapsed) {
  if (!section || !body) return;
  section.classList.toggle('mosp-filter-collapsed', !!collapsed);
  body.hidden = !!collapsed;
  body.style.display = collapsed ? 'none' : '';
  if (toggle) {
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const label = toggle.querySelector('[data-mosp-filter-toggle-label]');
    if (label) label.textContent = collapsed ? EXPAND_LABEL : COLLAPSE_LABEL;
    const icon = toggle.querySelector('i.bi');
    if (icon) {
      icon.classList.toggle('bi-chevron-down', !!collapsed);
      icon.classList.toggle('bi-chevron-up', !collapsed);
    }
  }
}

/**
 * Ensure a filter section header contains a shared Show/Hide filters toggle.
 */
function _ensureFilterToggle(section, header) {
  if (!header) return null;
  let toggle = section.querySelector('[data-mosp-filter-toggle]');
  if (toggle) return toggle;

  toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-sm btn-outline-secondary';
  toggle.setAttribute('data-mosp-filter-toggle', '1');
  toggle.innerHTML = `<i class="bi bi-chevron-up" aria-hidden="true"></i><span data-mosp-filter-toggle-label>${COLLAPSE_LABEL}</span>`;

  const maybeTitle = header.querySelector('.fw-bold, .fw-semibold, h2, h3, h4, h5, h6, span');
  if (!header.classList.contains('d-flex')) {
    header.classList.add('d-flex', 'align-items-center', 'justify-content-between', 'gap-2', 'flex-wrap');
    if (maybeTitle && maybeTitle.parentElement === header) maybeTitle.classList.add('mb-0');
  }
  header.appendChild(toggle);
  return toggle;
}

/**
 * Locate or create the card header used for a collapsible filter section.
 */
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

/**
 * Wire all marked filter sections so users can hide or show them consistently.
 */
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

      if (nextCollapsed && getStickyEnabled(cfg, false)) {
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

/**
 * Build a per-page localStorage key for collapsible visualisation sections.
 */
function _vizCollapseStorageKey(cfg, section) {
  const raw = String(section?.dataset?.mospVizSection || '').trim() || location.pathname;
  return `${cfg.appId}:viz-collapsed:${raw}`;
}

/**
 * Apply collapsed/expanded state to a visualisation section and its toggle.
 */
function _setVizCollapsed(section, body, toggle, collapsed) {
  if (!section || !body) return;
  section.classList.toggle('mosp-viz-collapsed', !!collapsed);
  body.hidden = !!collapsed;
  body.style.display = collapsed ? 'none' : '';
  if (toggle) {
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const label = toggle.querySelector('[data-mosp-viz-toggle-label]');
    if (label) label.textContent = collapsed ? EXPAND_LABEL : COLLAPSE_LABEL;
    const icon = toggle.querySelector('i.bi');
    if (icon) {
      icon.classList.toggle('bi-chevron-down', !!collapsed);
      icon.classList.toggle('bi-chevron-up', !collapsed);
    }
  }
}

/**
 * Ensure a visualisation section header contains a shared Show/Hide visualisations toggle.
 */
function _ensureVizToggle(section, header) {
  if (!header) return null;
  let toggle = section.querySelector('[data-mosp-viz-toggle]');
  if (toggle) return toggle;

  toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-sm btn-outline-secondary';
  toggle.setAttribute('data-mosp-viz-toggle', '1');
  toggle.innerHTML = `<i class="bi bi-chevron-up" aria-hidden="true"></i><span data-mosp-viz-toggle-label>${COLLAPSE_LABEL}</span>`;

  const maybeTitle = header.querySelector('.fw-bold, .fw-semibold, h2, h3, h4, h5, h6, span');
  if (!header.classList.contains('d-flex')) {
    header.classList.add('d-flex', 'align-items-center', 'justify-content-between', 'gap-2', 'flex-wrap');
    if (maybeTitle && maybeTitle.parentElement === header) maybeTitle.classList.add('mb-0');
  }
  header.appendChild(toggle);
  return toggle;
}

/**
 * Locate or create the card header used for a collapsible visualisation section.
 */
function _ensureVizHeader(section) {
  let header = section.querySelector(':scope > .card-header');
  if (header) return header;

  header = document.createElement('div');
  header.className = 'card-header';
  const title = String(section.dataset.mospVizTitle || 'Visualisation').trim() || 'Visualisation';
  header.innerHTML = `<div class="fw-bold">${esc(title)}</div>`;
  section.insertBefore(header, section.firstChild);
  return header;
}

/**
 * Wire all marked visualisation sections so users can hide or show them consistently.
 */
export function initCollapsibleVisualisationSections(cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const sections = Array.from(document.querySelectorAll('[data-mosp-viz-section]'));
  if (!sections.length) return;

  sections.forEach((section) => {
    const header = _ensureVizHeader(section);
    const body = section.querySelector('[data-mosp-viz-body]') || section.querySelector(':scope > .card-body') || section.querySelector('[role="img"]') || section.querySelector('svg') || section.querySelector('canvas');
    if (!body) return;

    const toggle = _ensureVizToggle(section, header);
    const storageKey = _vizCollapseStorageKey(cfg, section);
    const initiallyCollapsed = (() => {
      try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
    })();
    _setVizCollapsed(section, body, toggle, initiallyCollapsed);

    toggle?.addEventListener('click', async () => {
      const nextCollapsed = !(section.classList.contains('mosp-viz-collapsed'));
      _setVizCollapsed(section, body, toggle, nextCollapsed);
      try { localStorage.setItem(storageKey, nextCollapsed ? '1' : '0'); } catch {}

      if (nextCollapsed && getStickyEnabled(cfg, false)) {
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
