import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const ORIGIN = 'https://app.example';
const read = (file) => readFile(new URL(`../src/js/${file}`, import.meta.url), 'utf8');
const bundle = (await Promise.all([
  '00-core.js',
  '05-theme-attributes.js',
  '10-config.js',
  '40-querystring.js',
  '60-framework.js',
  '70-search-autocomplete.js',
].map(read)))
  .join('\n')
  .replace(/^export /gm, '');

// The framework and saved-search helpers in a context whose page address is `href`.
function load(href = `${ORIGIN}/events.html`, { framework = {}, items = [], saved = [] } = {}) {
  const url = new URL(href);
  const location = { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash };
  const listeners = {};
  const datalist = { appendChild() {} };
  const select = {
    value: '',
    style: { setProperty() {} },
    children: [],
    appendChild(child) { this.children.push(child); },
    addEventListener(type, fn) { listeners[type] = fn; },
  };
  const context = {
    window: { location, mospUiConfig: { framework } },
    location,
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      getElementById: (id) => (id === 'navFrameworkSelect' ? select : id === 'savedList' ? datalist : null),
      createElement: () => ({}),
      querySelectorAll: () => [],
    },
    apiGet: async (url) => (url === '/saved' ? saved : { items, default: items[0]?.slug || '' }),
    URL,
    URLSearchParams,
  };
  const api = vm.runInNewContext(`${bundle}\n({withFramework, _initFrameworkSelector, _loadDatalist, _savedSearchTarget, getUiConfig})`, context);
  return { api, location, select, listeners };
}

const HOSTILE_PATHS = [
  '/.//evil.example/phish',
  '/%2e//evil.example/phish',
  '/%2E%2e//evil.example/phish',
  '/x/..//evil.example/phish',
  '/x/%2e%2e//evil.example/phish',
  '/././/evil.example/phish',
];

// With a framework, without one, and with framework support off.
const variants = () => [
  ['with a framework', load().api, 'F1', '?framework=F1'],
  ['without a framework', load().api, '', ''],
  ['with framework support off', load(undefined, { framework: { enabled: false } }).api, 'F1', ''],
];

test('a same-origin path with resolved dot segments keeps one leading slash', () => {
  for (const [label, api, framework, query] of variants()) {
    for (const path of HOSTILE_PATHS) {
      const out = api.withFramework(path, framework);
      assert.equal(out, `/evil.example/phish${query}`, `${label}: ${path}`);
      assert.equal(new URL(out, ORIGIN).origin, ORIGIN, `${label}: ${path}`);
    }
    for (const url of [`${ORIGIN}//evil.example/phish`, `${ORIGIN}/.//evil.example/phish`]) {
      const out = api.withFramework(url, framework);
      assert.equal(out.startsWith('//'), false, `${label}: ${url}`);
      assert.equal(new URL(out, ORIGIN).origin, ORIGIN, `${label}: ${url}`);
    }
  }
  // A dot segment resolved from a parsed URL needs no help when it ends on one slash.
  assert.equal(load().api.withFramework('/x/../events.html?q=1#top', 'F1'), '/events.html?q=1&framework=F1#top');
});

test('ordinary application links gain the framework and keep their other parts', () => {
  const { api } = load();
  assert.equal(api.withFramework('/events.html?q=ssh#results', 'F1'), '/events.html?q=ssh&framework=F1#results');
  assert.equal(api.withFramework('/controls.html?framework=OLD', 'F1'), '/controls.html?framework=F1');
  assert.equal(api.withFramework(`${ORIGIN}/risks.html`, 'F1'), '/risks.html?framework=F1');
  assert.equal(api.withFramework('', 'F1'), '/?framework=F1');
  // Without a framework, or with framework support off, the same-origin path comes back as is.
  assert.equal(api.withFramework('/events.html?q=1#top'), '/events.html?q=1#top');
  assert.equal(api.withFramework('/controls.html?framework=OLD', ''), '/controls.html?framework=OLD');
  const off = load(undefined, { framework: { enabled: false } }).api;
  assert.equal(off.withFramework('/events.html?q=ssh#results', 'F1'), '/events.html?q=ssh#results');
  assert.equal(off.withFramework('events.html', 'F1'), '/events.html');
  assert.equal(off.withFramework(`${ORIGIN}/risks.html`, 'F1'), '/risks.html');
});

test('another web address comes back in full, without this application\'s framework', () => {
  for (const [label, api, framework] of variants()) {
    for (const [url, expected] of [
      ['https://docs.example/guide', 'https://docs.example/guide'],
      ['https://docs.example/guide?q=1#part', 'https://docs.example/guide?q=1#part'],
      ['https://docs.example/guide?framework=OTHER', 'https://docs.example/guide?framework=OTHER'],
      ['//docs.example/guide', 'https://docs.example/guide'],
      ['///docs.example/guide', 'https://docs.example/guide'],
      ['http://app.example/insecure', 'http://app.example/insecure'],
      ['https://app.example:8443/other-port', 'https://app.example:8443/other-port'],
    ]) {
      assert.equal(api.withFramework(url, framework), expected, `${label}: ${url}`);
    }
  }
});

test('script, data and other non-web schemes are refused whatever the framework setting', () => {
  for (const [label, api, framework] of variants()) {
    for (const url of [
      'javascript:alert(1)//',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'DATA:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      'blob:https://app.example/0d5a',
    ]) {
      assert.equal(api.withFramework(url, framework), '', `${label}: ${JSON.stringify(url)}`);
    }
  }
});

test('the framework picker stays on this origin from a path that begins with //', async () => {
  const items = [{ slug: 'A', name: 'A' }, { slug: 'B', name: 'B' }];
  for (const href of [`${ORIGIN}//evil.example/`, `${ORIGIN}//evil.example/?q=1&framework=A#part`]) {
    const ui = load(href, { items });
    await ui.api._initFrameworkSelector(ui.api.getUiConfig());
    ui.select.value = 'B';
    ui.listeners.change();
    const next = new URL(ui.location.href, ORIGIN);
    assert.equal(next.origin, ORIGIN, href);
    assert.equal(next.pathname, '//evil.example/', href);
    assert.equal(next.searchParams.get('framework'), 'B', href);
    assert.equal(next.hash, '', href);
  }
  // Clearing the choice removes the parameter and keeps the rest of the query.
  const ui = load(`${ORIGIN}/controls.html?q=1&framework=A`, { items });
  await ui.api._initFrameworkSelector(ui.api.getUiConfig());
  ui.select.value = '';
  ui.listeners.change();
  assert.equal(ui.location.href, `${ORIGIN}/controls.html?q=1`);
  const only = load(`${ORIGIN}/controls.html?framework=A`, { items });
  await only.api._initFrameworkSelector(only.api.getUiConfig());
  only.select.value = '';
  only.listeners.change();
  assert.equal(only.location.href, `${ORIGIN}/controls.html`);
});

test('a saved search opens only a URL the shortcuts menu would link to', async () => {
  const saved = [
    ['Events', '/events.html?q=ssh'],
    ['Dot segments', '/.//evil.example/phish'],
    ['Protocol relative', '//evil.example/phish'],
    ['Backslash', '/\\evil.example/phish'],
    ['Tab', '/\t/evil.example/phish'],
    ['Script', 'javascript:alert(1)//'],
    ['Data', 'data:text/html,<script>alert(1)</script>'],
  ].map(([name, url]) => ({ name, url }));
  for (const framework of [{}, { enabled: false }]) {
    const { api } = load(`${ORIGIN}/home.html?framework=F1`, { framework, saved });
    const cfg = api.getUiConfig({ search: { datalistId: 'savedList', datalistEndpoint: '/saved' } });
    await api._loadDatalist(cfg);
    const target = (name) => api._savedSearchTarget(name, cfg);
    const on = framework.enabled !== false;
    assert.equal(target('events'), on ? '/events.html?q=ssh&framework=F1' : '/events.html?q=ssh');
    const dots = target('Dot segments');
    assert.equal(dots, on ? '/evil.example/phish?framework=F1' : '/evil.example/phish');
    assert.equal(new URL(dots, ORIGIN).origin, ORIGIN);
    for (const name of ['Protocol relative', 'Backslash', 'Tab', 'Script', 'Data', 'Unknown'])
      assert.equal(target(name), '', `${JSON.stringify(framework)} ${name}`);
  }
});
