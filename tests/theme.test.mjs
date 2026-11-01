import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const bundle = (await Promise.all(
  ['src/js/05-theme-attributes.js', 'src/js/10-config.js', 'src/js/20-theme.js'].map(read),
)).join('\n').replace(/^export /gm, '');

function storage(values = {}, { broken = false } = {}) {
  const writes = [];
  const fail = () => { throw new Error('Storage is unavailable'); };
  return {
    writes,
    getItem: broken ? fail : (key) => (key in values ? values[key] : null),
    setItem: broken ? fail : (key, value) => { writes.push([key, value]); values[key] = value; },
    removeItem: broken ? fail : (key) => { delete values[key]; },
  };
}

function page(localStorage, mospUiConfig) {
  const documentElement = { dataset: {} };
  return { document: { documentElement }, localStorage, window: { mospUiConfig } };
}

function themeModule(localStorage, mospUiConfig) {
  const context = page(localStorage, mospUiConfig);
  const api = vm.runInNewContext(`${bundle}\n({applyTheme, THEMES})`, context);
  return { ...api, attributes: context.document.documentElement.dataset };
}

// The boot script is generated, so test the build's own output.
await promisify(execFile)(process.execPath, ['scripts/build.mjs'], {
  cwd: new URL('..', import.meta.url),
});
const bootSource = await read('dist/theme-boot.js');

async function boot(localStorage, mospUiConfig) {
  const context = page(localStorage, mospUiConfig);
  vm.runInNewContext(bootSource, context);
  return { ...context.document.documentElement.dataset };
}

const PALETTES = ['ink', 'sand', 'ocean', 'forest', 'sunset', 'rose', 'slate', 'teal', 'purple'];

test('themes keep their palettes, order and dark variants', () => {
  const { THEMES } = themeModule(storage());
  // Spread into this realm: the module ran in its own context.
  assert.deepEqual(
    [...THEMES.map((theme) => theme.id)],
    [...PALETTES, ...PALETTES.map((id) => `${id}-dark`)],
  );
  assert.equal(THEMES.find((theme) => theme.id === 'ink-dark').name, 'Ink (dark)');
});

test('applyTheme selects the palette and colour mode, and remembers the theme', () => {
  const saved = storage();
  const theme = themeModule(saved);
  theme.applyTheme('ink-dark');
  assert.deepEqual({ ...theme.attributes }, { theme: 'ink', colorMode: 'dark', bsTheme: 'dark' });
  theme.applyTheme(' ocean ');
  assert.deepEqual({ ...theme.attributes }, { theme: 'ocean', colorMode: 'light', bsTheme: 'light' });
  for (const unknown of ['', null, 'unknown', 'dark', '-dark', 'sand-dark-dark', 'INK']) {
    theme.applyTheme(unknown);
    assert.deepEqual({ ...theme.attributes }, { theme: 'ink', colorMode: 'light', bsTheme: 'light' });
  }
  assert.deepEqual(saved.writes.at(-1), ['keen_theme', 'ink']);
  assert.deepEqual(saved.writes[1], ['keen_theme', 'ink-dark']);
  assert.deepEqual(saved.writes[2], ['keen_theme', 'ocean']);
});

test('the boot script applies exactly what applyTheme applies for every saved value', async () => {
  const values = [...PALETTES, ...PALETTES.map((id) => `${id}-dark`), '', 'unknown', 'sand-dark-dark', ' teal-dark '];
  for (const value of values) {
    const module = themeModule(storage());
    module.applyTheme(value);
    assert.deepEqual(await boot(storage({ keen_theme: value })), { ...module.attributes }, value);
  }
});

test('the boot script reads the configured key and never writes', async () => {
  const saved = storage({ keen_theme: 'rose', other_theme: 'slate-dark' });
  assert.deepEqual(await boot(saved, { storage: { themeKey: 'other_theme' } }), {
    theme: 'slate', colorMode: 'dark', bsTheme: 'dark',
  });
  assert.deepEqual(await boot(saved), { theme: 'rose', colorMode: 'light', bsTheme: 'light' });
  assert.deepEqual(saved.writes, []);
});

test('with no saved theme, both apply Ink, the default, and Sand stays selectable', async () => {
  const ink = { theme: 'ink', colorMode: 'light', bsTheme: 'light' };
  assert.deepEqual(await boot(storage({}, { broken: true })), ink);
  assert.deepEqual(await boot(storage()), ink);
  const saved = storage();
  const fresh = themeModule(saved);
  assert.deepEqual({ ...fresh.attributes }, ink);
  assert.deepEqual(saved.writes, [['keen_theme', 'ink']]);
  assert.deepEqual({ ...themeModule(storage({}, { broken: true })).attributes }, ink);
  assert.deepEqual(await boot(storage({ keen_theme: 'sand' })), { theme: 'sand', colorMode: 'light', bsTheme: 'light' });
});

test('the boot script is a classic script that leaves no globals behind', async () => {
  assert.doesNotThrow(() => new vm.Script(bootSource));
  assert.doesNotMatch(bootSource, /^\s*(import|export)\b/m);
  const context = page(storage({ keen_theme: 'ink' }));
  vm.runInNewContext(bootSource, context);
  assert.deepEqual(
    Object.keys(context).sort(),
    ['document', 'localStorage', 'window'],
  );
});
