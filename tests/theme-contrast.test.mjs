// Text the theme tokens colour clears WCAG AA, 4.5:1, on the surfaces the
// tokens paint, in every palette and in both colour modes. The tokens are read
// from the CSS sources, so a palette change is checked as it is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const tokenCss = await read('src/css/00-theme-tokens.css');
const darkCss = await read('src/css/90-taxonomy-and-utilities.css');

const PALETTES = ['ink', 'sand', 'ocean', 'forest', 'sunset', 'rose', 'slate', 'teal', 'purple'];

// How much accent the dark rules keep when they lift accent text towards white.
function accentShare(pattern) {
  const found = darkCss.match(pattern);
  assert.ok(found, `the dark rule ${pattern} is present`);
  return Number(found[1]) / 100;
}
const lifted = String.raw`color-mix\(in srgb,rgb\(var\(--keen-accent-rgb\)\) (\d+)%,white\)`;
const darkShare = {
  tab: accentShare(new RegExp(String.raw`--bs-nav-tabs-link-active-color:${lifted}`)),
  badge: accentShare(new RegExp(String.raw`\.badge-soft,[^{]*\{\s*color:${lifted}`)),
};
const AA = 4.5;

function declarations(css, selector) {
  const escaped = selector.replace(/[[\]"=().]/g, (c) => `\\${c}`);
  const found = {};
  for (const [, body] of css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))) {
    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');
      const name = declaration.slice(0, colon).trim();
      if (colon > 0 && name.startsWith('--')) found[name] = declaration.slice(colon + 1).trim();
    }
  }
  return found;
}

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
// Mix two colours in sRGB, as color-mix(in srgb, a p%, b) does.
const mix = (a, share, b) => toHex(channels(a).map((v, i) => v * share + channels(b)[i] * (1 - share)));

function resolver(tokens) {
  const resolve = (value) => {
    let match;
    if ((match = value.match(/^var\((--[\w-]+)\)$/))) {
      assert.ok(match[1] in tokens, `${match[1]} is declared`);
      return resolve(tokens[match[1]]);
    }
    if ((match = value.match(/^rgb\(var\((--[\w-]+)\)\)$/)))
      return toHex(tokens[match[1]].split(',').map(Number));
    if ((match = value.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/)))
      return mix(resolve(match[1]), Number(match[2]) / 100, resolve(match[3]));
    if (value === 'white') return '#ffffff';
    if (/^#[0-9a-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map((c) => c + c).join('')}`;
    assert.match(value, /^#[0-9a-f]{6}$/i, `a colour the check can read: ${value}`);
    return value.toLowerCase();
  };
  return (name) => resolve(`var(${name})`);
}

function theme(palette, mode) {
  const tokens = { ...declarations(tokenCss, ':root') };
  if (palette !== 'sand') Object.assign(tokens, declarations(tokenCss, `:root[data-theme="${palette}"]`));
  if (mode === 'dark') {
    Object.assign(tokens, declarations(darkCss, ':root[data-bs-theme=dark]'));
    if (palette === 'ink') Object.assign(tokens, declarations(darkCss, ':root[data-bs-theme=dark][data-theme=ink]'));
  }
  return resolver(tokens);
}

function luminance(hex) {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// Every pairing of a token-coloured text with a token-painted surface, for one
// palette in one mode: [description, text, background].
function pairings(token, mode) {
  const accent = token('--keen-accent');
  const surfaces = ['--bs-body-bg', '--bs-secondary-bg', '--bs-tertiary-bg'].map(token);
  if (mode === 'light') surfaces.push('#ffffff');
  // Soft badges lay a 10% accent wash over the surface they sit on.
  const washed = surfaces.map((surface) => mix(accent, 0.1, surface));
  // Dark mode lifts accent text by mixing it with white.
  const tab = mix(accent, darkShare.tab, '#ffffff');
  const badge = mix(accent, darkShare.badge, '#ffffff');
  const texts =
    mode === 'light'
      ? [
          ['link', token('--bs-link-color'), surfaces],
          ['hovered link', token('--bs-link-hover-color'), surfaces],
          ['accent text (tabs, outline buttons)', token('--keen-accent-700'), surfaces],
          ['soft badge', token('--keen-accent-700'), washed],
        ]
      : [
          ['link', token('--bs-link-color'), surfaces],
          ['hovered link', token('--bs-link-hover-color'), surfaces],
          ['active tab', tab, surfaces],
          ['soft badge', badge, washed],
        ];
  return [
    ...texts.flatMap(([what, text, backgrounds]) => backgrounds.map((bg) => [what, text, bg])),
    ...surfaces.map((bg) => ['body text', token('--bs-body-color'), bg]),
    ...surfaces.map((bg) => ['muted text', token('--keen-muted'), bg]),
    ['primary button', token('--keen-accent-contrast'), accent],
    ['hovered primary button', token('--keen-accent-contrast'), token('--keen-accent-700')],
  ];
}

function failures(palettes = PALETTES, themeFor = theme) {
  const found = [];
  for (const mode of ['light', 'dark'])
    for (const palette of palettes) {
      const worst = new Map();
      for (const [what, text, bg] of pairings(themeFor(palette, mode), mode)) {
        const ratio = contrast(text, bg);
        if (ratio < AA && ratio < (worst.get(what)?.ratio ?? Infinity)) worst.set(what, { ratio, text, bg });
      }
      for (const [what, { ratio, text, bg }] of worst)
        found.push(`${palette} ${mode}: ${what} ${text} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  return found;
}

test('every palette clears 4.5:1 for its text in light and dark modes', () => {
  assert.deepEqual(failures(), []);
});

test('the check finds a palette that falls short', () => {
  // The Forest and Sunset palettes as they were: a bright green under white
  // button text, and a bright orange used as link text on the light canvas.
  const earlier = {
    forest: {
      '--keen-accent': '#16a34a',
      '--keen-accent-700': '#15803d',
      '--keen-accent-rgb': '22,163,74',
      '--keen-link-hover': '#166534',
    },
    sunset: {
      '--keen-accent': '#f97316',
      '--keen-accent-700': '#ea580c',
      '--keen-accent-rgb': '249,115,22',
      '--keen-accent-contrast': '#111827',
      '--keen-link-hover': '#c2410c',
    },
  };
  const withEarlier = (palette, mode) => {
    const tokens = { ...declarations(tokenCss, ':root'), ...declarations(tokenCss, `:root[data-theme="${palette}"]`), ...earlier[palette] };
    if (mode === 'dark') Object.assign(tokens, declarations(darkCss, ':root[data-bs-theme=dark]'));
    return resolver(tokens);
  };
  assert.deepEqual(failures(['forest', 'sunset'], withEarlier).sort(), [
    'forest dark: primary button #ffffff on #16a34a is 3.30:1',
    'forest light: accent text (tabs, outline buttons) #15803d on #f4eee1 is 4.34:1',
    'forest light: link #15803d on #f4eee1 is 4.34:1',
    'forest light: primary button #ffffff on #16a34a is 3.30:1',
    'forest light: soft badge #15803d on #dee7d2 is 3.93:1',
    'sunset light: accent text (tabs, outline buttons) #ea580c on #f4eee1 is 3.08:1',
    'sunset light: hovered link #c2410c on #f4eee1 is 4.48:1',
    'sunset light: link #ea580c on #f4eee1 is 3.08:1',
    'sunset light: soft badge #ea580c on #f5e2cd is 2.82:1',
  ]);
});
