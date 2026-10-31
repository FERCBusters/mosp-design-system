import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/js/120-table-sorting.js', import.meta.url), 'utf8');
const { enableTableSorting } = vm.runInNewContext(
  source.replace(/^export /gm, '') + '\n({enableTableSorting})',
);

// Just enough DOM for header sorting: elements with attributes, classes,
// children and listeners, and selectors made of tag[attr] alternatives.
class El {
  constructor(tag, attrs = {}, children = []) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.children = [];
    this.listeners = {};
    this.parent = null;
    this.text = '';
    const classes = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...names) => names.forEach((n) => classes.add(n)),
      remove: (...names) => names.forEach((n) => classes.delete(n)),
      contains: (n) => classes.has(n),
    };
    for (const child of children) this.appendChild(typeof child === 'string' ? textEl(child) : child);
  }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  hasAttribute(n) { return n in this.attrs; }
  removeAttribute(n) { delete this.attrs[n]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  appendChild(child) {
    if (child.parent) child.parent.children = child.parent.children.filter((c) => c !== child);
    child.parent = this;
    this.children.push(child);
    return child;
  }
  contains(node) {
    for (let n = node; n; n = n.parent) if (n === this) return true;
    return false;
  }
  matches(selector) {
    return selector.split(',').some((part) => {
      const m = part.trim().match(/^([a-z]+)?(?:\[([a-z-]+)\])?(?:\.([a-z-]+))?$/);
      return Boolean(m) && (!m[1] || m[1].toUpperCase() === this.tagName)
        && (!m[2] || this.hasAttribute(m[2])) && (!m[3] || this.classList.contains(m[3]));
    });
  }
  closest(selector) {
    for (let n = this; n; n = n.parent) if (n.matches(selector)) return n;
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    const walk = (n) => n.children.forEach((c) => { if (c.matches(selector)) found.push(c); walk(c); });
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function textEl(text) {
  const t = new El('span');
  t.text = text;
  return t;
}

function fire(target, type, init = {}) {
  const ev = { type, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
  for (let n = target; n; n = n.parent) for (const fn of n.listeners[type] || []) fn(ev);
  return ev;
}

function table() {
  const selectAll = new El('input', { type: 'checkbox' });
  const link = new El('a', { href: '#help' }, ['?']);
  const row = (id, name, when) => new El('tr', { id }, [
    new El('td', {}, [new El('input', { type: 'checkbox' })]),
    new El('td', {}, [name]),
    new El('td', { 'data-sort': when }, [when]),
  ]);
  const root = new El('div', {}, [
    new El('table', { 'data-sortable': '' }, [
      new El('thead', {}, [new El('tr', {}, [
        new El('th', {}, [selectAll]),
        new El('th', {}, ['Name ', link]),
        new El('th', { 'data-nosort': '' }, ['When']),
      ])]),
      new El('tbody', {}, [row('b', 'beta', '2026-01-02'), row('a', 'alpha', '2026-01-03'), row('c', 'gamma', '2026-01-01')]),
    ]),
  ]);
  enableTableSorting(root);
  const [select, name, when] = root.querySelectorAll('th');
  const order = () => root.querySelector('tbody').children.map((r) => r.attrs.id).join('');
  return { root, select, name, when, selectAll, link, order };
}

test('a click on a header sorts its column, and a second click reverses it', () => {
  const t = table();
  assert.equal(t.name.getAttribute('role'), 'button');
  assert.equal(fire(t.name, 'click').defaultPrevented, true);
  assert.equal(t.order(), 'abc');
  assert.ok(t.name.classList.contains('sort-asc'));
  fire(t.name, 'keydown', { key: 'Enter' });
  assert.equal(t.order(), 'cba');
  assert.ok(t.name.classList.contains('sort-desc'));
  // A data-nosort header is left alone.
  assert.equal(t.when.getAttribute('role'), null);
  assert.equal(fire(t.when, 'click').defaultPrevented, false);
  assert.equal(t.order(), 'cba');
});

test('controls inside a header keep their own clicks and keys', () => {
  const t = table();
  for (const [control, init] of [
    [t.selectAll, {}],
    [t.selectAll, { type: 'keydown', key: ' ' }],
    [t.link, {}],
    [t.link, { type: 'keydown', key: 'Enter' }],
  ]) {
    const ev = fire(control, init.type || 'click', init);
    assert.equal(ev.defaultPrevented, false);
    assert.equal(t.order(), 'bac');
    assert.equal(t.select.getAttribute('data-sort-dir'), null);
    assert.equal(t.name.getAttribute('data-sort-dir'), null);
  }
  // The header around the control still sorts.
  fire(t.name, 'click');
  assert.equal(t.order(), 'abc');
});
