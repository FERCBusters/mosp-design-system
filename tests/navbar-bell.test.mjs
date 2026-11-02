import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../src/js/${file}`, import.meta.url), 'utf8');
const bundle = (await Promise.all(['00-core.js', '05-theme-attributes.js', '10-config.js', '100-navbar.js'].map(read)))
  .join('\n')
  .replace(/^export /gm, '');

// A small DOM: the elements the bell reads, by id, parsed from rendered markup.
function page(html, replies) {
  const elements = {};
  for (const match of html.matchAll(/<(\w+)[^>]*\sid="([^"]+)"[^>]*>/g)) {
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    elements[match[2]] = {
      tag: match[1],
      style: { display: 'none' },
      textContent: '',
      attributes,
      getAttribute: (name) => attributes[name] ?? null,
      setAttribute: (name, value) => { attributes[name] = String(value); },
    };
  }
  const requests = [];
  const window = {};
  const context = {
    window,
    document: { getElementById: (id) => elements[id] || null },
    apiGet: async (url) => {
      requests.push(url);
      if (replies[url] instanceof Error) throw replies[url];
      return replies[url];
    },
    setInterval: () => 0,
  };
  const api = vm.runInNewContext(`${bundle}\n({renderNavbar, _bellHtml, _initBell, getUiConfig})`, context);
  return { api, elements, requests, window };
}

const ADMIN = { user: 'admin', is_admin: true };
const MENU = [
  { label: 'Questions', href: '/questions.html', icon: 'bi-chat"x', summaryEndpoint: '/q', countKey: 'open_count', ws: true },
  { label: 'Suggested rules', href: '/admin.html#rule-suggestions', summaryEndpoint: { admin: '/s', user: '' }, countKey: 'open_count' },
];

function bell(items, me = ADMIN) {
  const { api } = page('', {});
  const cfg = api.getUiConfig({ bell: { items, title: 'Notifications' } });
  return { cfg, html: api._bellHtml(cfg, me) };
}

test('without items the bell is the single link it always was', () => {
  const { api } = page('', {});
  const cfg = api.getUiConfig({ bell: { href: '/questions.html', title: 'Questions' } });
  const html = api._bellHtml(cfg, ADMIN);
  assert.match(html, /<a class="[^"]*nav-question-bell" id="navBell" href="\/questions.html" title="Questions"/);
  assert.match(html, /<span class="visually-hidden">Questions<\/span>/);
  assert.doesNotMatch(html, /dropdown/);
});

test('one kind of notification makes the bell a link to it', () => {
  const { html } = bell([MENU[1]]);
  assert.match(html, /<a [^>]*id="navBell" href="\/admin.html#rule-suggestions" title="Suggested rules"/);
  assert.doesNotMatch(html, /navBellMenu/);
});

test('several kinds make the bell a menu with a count beside each', () => {
  const { html } = bell(MENU);
  assert.match(html, /<button [^>]*id="navBell" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Notifications"/);
  assert.match(html, /<a class="dropdown-item[^"]*" id="navBellItem0" href="\/questions.html"><i class="bi bi-chatx" aria-hidden="true"><\/i><span class="flex-grow-1">Questions<\/span><span [^>]*id="navBellCount0"/);
  assert.match(html, /id="navBellItem1" href="\/admin.html#rule-suggestions"><span class="flex-grow-1">Suggested rules<\/span>/);
});

test('no kinds hide the bell, and items may depend on the user', () => {
  assert.equal(bell([]).html, '');
  const items = (me) => (me?.is_admin ? MENU : MENU.slice(0, 1));
  assert.match(bell(items).html, /navBellMenu/);
  assert.doesNotMatch(bell(items, { user: 'reader' }).html, /navBellMenu/);
  // A label or link is required; malformed entries are left out.
  assert.equal(bell([{ label: 'No link' }, null]).html, '');
});

test('the bell totals each kind and labels the menu with it', async () => {
  const { api } = page('', {});
  const cfg = api.getUiConfig({ bell: { items: MENU, title: 'Notifications' } });
  const shown = page(api._bellHtml(cfg, ADMIN), { '/q': { open_count: 2 }, '/s': { open_count: 3 } });
  await shown.api._initBell(cfg, ADMIN);
  const { elements } = shown;
  assert.deepEqual(shown.requests.sort(), ['/q', '/s']);
  assert.equal(elements.navBellCount.textContent, '5');
  assert.equal(elements.navBellCount.style.display, '');
  assert.equal(elements.navBellCount0.textContent, '2');
  assert.equal(elements.navBellCount1.textContent, '3');
  assert.equal(elements.navBell.getAttribute('aria-label'), 'Notifications: 5 waiting');
  assert.equal(typeof shown.window.mospRefreshBell, 'function');
});

test('a failing or empty kind counts as none', async () => {
  const { api } = page('', {});
  const cfg = api.getUiConfig({ bell: { items: MENU, title: 'Notifications' } });
  const shown = page(api._bellHtml(cfg, ADMIN), { '/q': new Error('offline'), '/s': { open_count: 0 } });
  await shown.api._initBell(cfg, ADMIN);
  assert.equal(shown.elements.navBellCount.style.display, 'none');
  assert.equal(shown.elements.navBellCount1.style.display, 'none');
  assert.equal(shown.elements.navBell.getAttribute('aria-label'), 'Notifications');
  // The user variant of an endpoint can be empty: that kind is not fetched.
  const reader = { user: 'reader' };
  const quiet = page(api._bellHtml(cfg, reader), { '/q': { unread_count: 1 } });
  await quiet.api._initBell(cfg, reader);
  assert.deepEqual(quiet.requests, ['/q']);
});

test('the single-kind bell still counts from its own endpoint', async () => {
  const { api } = page('', {});
  const cfg = api.getUiConfig({ bell: { summaryEndpoint: '/q', countKey: 'open_count' } });
  const shown = page(api._bellHtml(cfg, ADMIN), { '/q': { open_count: 4 } });
  await shown.api._initBell(cfg, ADMIN);
  assert.equal(shown.elements.navBellCount.textContent, '4');
  assert.equal(shown.elements.navBell.getAttribute('aria-label'), null);
});
