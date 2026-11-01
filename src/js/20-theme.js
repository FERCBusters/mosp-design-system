// MOSP design system: Theme.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Theme (Bootstrap-variable friendly)
// ---------------------------------------------------------------------------

export const THEMES = [
  ...MOSP_THEME_PALETTES,
  // Dark variants are persisted in the same account preference as their palette.
  ...MOSP_THEME_PALETTES.map(theme => ({id: `${theme.id}-dark`, name: `${theme.name} (dark)`})),
];

/**
 * Apply a theme ID and remember it in this browser, so pages that load
 * dist/theme-boot.js show it from their first paint.
 */
export function applyTheme(themeId, cfgOverrides = null) {
  const cfg = getUiConfig(cfgOverrides);
  const id = mospSetThemeAttributes(document.documentElement, themeId);
  try {
    localStorage.setItem(cfg.storage.themeKey, id);
    // Retire the independent browser preference: the account theme is authoritative.
    localStorage.removeItem('mosp-color-mode');
  } catch {}
}

// Compatibility for callers of the former API; preferences should save a theme ID.
export function applyColorMode(mode = 'light') {
  const palette = document.documentElement.dataset.theme || MOSP_DEFAULT_THEME;
  applyTheme(palette + (mode === 'dark' ? '-dark' : ''));
}
try {
  const cfg = getUiConfig();
  applyTheme(localStorage.getItem(cfg.storage.themeKey), cfg);
} catch { applyTheme(MOSP_DEFAULT_THEME); }
