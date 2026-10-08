// MOSP design system: Theme.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

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

// Dark variants are persisted in the same account preference as their palette.
THEMES.push(...THEMES.map(theme => ({id: `${theme.id}-dark`, name: `${theme.name} (dark)`})));

export function applyTheme(themeId, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const requested = String(themeId || '').trim();
  const id = THEMES.some(theme => theme.id === requested) ? requested : 'purple';
  const dark = id.endsWith('-dark');
  document.documentElement.dataset.theme = dark ? id.slice(0, -5) : id;
  document.documentElement.dataset.colorMode = dark ? 'dark' : 'light';
  document.documentElement.dataset.bsTheme = dark ? 'dark' : 'light';
  try {
    localStorage.setItem(cfg.storage.themeKey, id);
    // Retire the independent browser preference: the account theme is authoritative.
    localStorage.removeItem('mosp-color-mode');
  } catch {}
}

// Compatibility for callers of the former API; preferences should save a theme ID.
export function applyColorMode(mode = 'light') {
  const palette = document.documentElement.dataset.theme || 'purple';
  applyTheme(palette + (mode === 'dark' ? '-dark' : ''));
}
try {
  const cfg = getUiConfig();
  applyTheme(localStorage.getItem(cfg.storage.themeKey) || 'purple', cfg);
} catch { applyTheme('purple'); }
