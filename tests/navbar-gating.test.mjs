import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../src/js/${file}`, import.meta.url), 'utf8');
const bundle = (await Promise.all(['00-core.js', '05-theme-attributes.js', '10-config.js', '60-framework.js', '100-navbar.js'].map(read)))
  .join('\n')
  .replace(/^export /gm, '');
const api = vm.runInNewContext(`${bundle}\n({renderNavbar})`, { window: {}, document: {} });

const ON = { user: 'admin', is_admin: true, feature_frameworks: true, feature_questions: true };
const OFF = { user: 'admin', is_admin: true, feature_frameworks: false, feature_questions: false };
const cfg = {
  links: [{ label: 'Admin', href: '/admin.html', key: 'admin' }],
  nav: { extraHtml: '' },
  framework: { enabled: true, label: 'Framework', requireAll: ['feature_frameworks'] },
  bell: { enabled: true, href: '/questions.html', title: 'Questions', requireAll: ['feature_questions'] },
};

test('the framework picker and bell follow the flags links use', () => {
  const on = api.renderNavbar('', ON, cfg);
  assert.match(on, /id="navFrameworkSelect"/);
  assert.match(on, /data-nav-fw="1"/);
  assert.match(on, /id="navBell"/);

  const off = api.renderNavbar('', OFF, cfg);
  assert.doesNotMatch(off, /navFrameworkSelect/);
  // Links stop carrying the framework when there is no picker.
  assert.doesNotMatch(off, /data-nav-fw/);
  assert.doesNotMatch(off, /navBell/);
});

test('without flags the picker and bell keep their enabled setting', () => {
  const plain = { ...cfg, framework: { enabled: true }, bell: { enabled: false } };
  const html = api.renderNavbar('', { user: 'u' }, plain);
  assert.match(html, /id="navFrameworkSelect"/);
  assert.doesNotMatch(html, /navBell/);
});
