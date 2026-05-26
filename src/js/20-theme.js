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

/**
 * Apply a named theme to the document and persist it to localStorage.
 */
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
