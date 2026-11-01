// MOSP design system: Theme attributes.
// This file is concatenated by scripts/build.mjs into dist/app.js, and on its
// own into dist/theme-boot.js, a classic script that applies the saved theme
// before the first paint. Keep it free of imports and exports.

// ---------------------------------------------------------------------------
// Theme palettes and the <html> attributes that select them
// ---------------------------------------------------------------------------

// Keep in sync with backend ALLOWED_THEMES if you use server-controlled themes.
const MOSP_THEME_PALETTES = [
  {id: 'ink', name: 'Ink'},
  {id: 'sand', name: 'Sand'},
  {id: 'ocean', name: 'Ocean'},
  {id: 'forest', name: 'Forest'},
  {id: 'sunset', name: 'Sunset'},
  {id: 'rose', name: 'Rose'},
  {id: 'slate', name: 'Slate'},
  {id: 'teal', name: 'Teal'},
  {id: 'purple', name: 'Purple'},
];

// The palette applied when none is saved or the saved one is unknown.
const MOSP_DEFAULT_THEME = 'ink';

// The browser storage key for the theme, unless an app configures another.
const MOSP_THEME_STORAGE_KEY = 'keen_theme';

/**
 * Set the palette and colour mode a theme ID names on `root`, and return the ID
 * applied. A palette ID selects light mode and `<palette>-dark` its dark mode;
 * any other value applies the default palette in light mode.
 */
function mospSetThemeAttributes(root, themeId) {
  const requested = String(themeId || '').trim();
  const dark = requested.endsWith('-dark');
  const palette = dark ? requested.slice(0, -5) : requested;
  const known = MOSP_THEME_PALETTES.some(theme => theme.id === palette);
  const mode = known && dark ? 'dark' : 'light';
  root.dataset.theme = known ? palette : MOSP_DEFAULT_THEME;
  root.dataset.colorMode = mode;
  root.dataset.bsTheme = mode;
  return known ? requested : MOSP_DEFAULT_THEME;
}
