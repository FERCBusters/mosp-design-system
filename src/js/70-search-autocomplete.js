// MOSP design system: Search Autocomplete.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Saved datalist for search (optional)
// ---------------------------------------------------------------------------

let _savedByName = new Map();
let _savedByNameLower = new Map();

/**
 * Resolve a saved shortcut/search name to its configured destination URL.
 */
export function resolveSavedUrl(rawName) {
  const key = String(rawName || '').trim();
  if (!key) return '';
  const direct = _savedByName.get(key);
  if (direct) return direct;
  const lower = key.toLowerCase();
  return _savedByNameLower.get(lower) || '';
}

// KEEN back-compat naming.
/**
 * Backward-compatible alias for resolving saved search names.
 */
export function resolveSavedSearchUrl(rawName) {
  return resolveSavedUrl(rawName);
}

/**
 * Attach saved shortcut/search datalist behaviour to a text input.
 */
export function attachSavedAutocomplete(inputEl, datalistId = null) {
  if (!inputEl) return;
  const cfg = getUiConfig();
  inputEl.setAttribute('list', datalistId || cfg.search.datalistId || 'mospSavedSearches');
}

// KEEN back-compat naming.
/**
 * Backward-compatible alias for attaching saved search autocomplete.
 */
export function attachSavedSearchAutocomplete(inputEl, datalistId = null) {
  return attachSavedAutocomplete(inputEl, datalistId);
}

/**
 * Load saved search/shortcut entries for navbar autocomplete.
 */
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
