// MOSP design system: Api.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// CSRF + API helpers
// ---------------------------------------------------------------------------

/**
 * Read a cookie value by name.
 */
function readCookie(name) {
  const target = `${name}=`;
  const parts = (document.cookie || '').split(/;\s*/);
  for (const p of parts) {
    if (p.startsWith(target)) return decodeURIComponent(p.slice(target.length));
  }
  return '';
}

/**
 * Read the configured CSRF token from cookies.
 */
function csrfToken(cfg) {
  return readCookie(cfg.csrf.cookieName);
}

/**
 * Build CSRF request headers for mutating API calls.
 */
function csrfHeaders(cfg) {
  const t = csrfToken(cfg);
  return t ? {[cfg.csrf.headerName]: t} : {};
}

/**
 * Resolve an API path against the configured API base.
 */
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

/**
 * Redirect the browser to the configured login page.
 */
function redirectToLogin(cfg) {
  const next = location.pathname + (location.search || '');
  const url = new URL(cfg.auth.loginUrl || '/login.html', location.origin);
  if (next && next !== '/login.html') url.searchParams.set('next', next);
  location.href = url.pathname + url.search;
}

/**
 * Extract a readable error message from a failed fetch response.
 */
async function readError(res) {
  try {
    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Fetch JSON from an API endpoint with shared authentication handling.
 */
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

/**
 * Parse JSON responses, returning null for empty bodies.
 */
async function _jsonish(res) {
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { return text; }
}

/**
 * POST a JSON payload to an API endpoint with CSRF handling.
 */
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

/**
 * PATCH a JSON payload to an API endpoint with CSRF handling.
 */
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

/**
 * PUT a JSON payload to an API endpoint with CSRF handling.
 */
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

/**
 * DELETE an API resource with CSRF handling.
 */
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

/**
 * POST a FormData payload to an API endpoint with CSRF handling.
 */
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
/**
 * Run a configurable API request using the shared MOSP API conventions.
 */
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
