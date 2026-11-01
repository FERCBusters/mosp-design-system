// MOSP design system: Theme before the first paint.
// scripts/build.mjs wraps this with src/js/05-theme-attributes.js into
// dist/theme-boot.js. Load that file as a classic script in <head>, before the
// stylesheets and without defer or async, so the theme this browser last
// applied is in place when the page first paints. The bundle's applyTheme
// takes over once the page's modules run. An app that renames the storage key
// through window.mospUiConfig sets it before this script.

let savedTheme = null;
try {
  const key = window.mospUiConfig?.storage?.themeKey || MOSP_THEME_STORAGE_KEY;
  savedTheme = localStorage.getItem(key);
} catch {}
mospSetThemeAttributes(document.documentElement, savedTheme);
