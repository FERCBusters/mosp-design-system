import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const CSRF = { cookieName: 'keen_csrf', headerName: 'X-CSRF-Token' };

// The API helpers as the bundle runs them, with a page's cookies and a fetch
// that records what each request would send.
async function page(cookie, csrf = CSRF) {
  const source = await readFile(new URL('../src/js/50-api.js', import.meta.url), 'utf8');
  const sent = [];
  const names = ['csrfHeaders', 'apiGet', 'apiPost', 'apiPatch', 'apiPut', 'apiDelete', 'apiPostForm', 'apiRequest'];
  const api = vm.runInNewContext(source.replace(/^export /gm, '') + `\n({${names.join(',')}})`, {
    document: { cookie },
    getUiConfig: () => ({ csrf, apiBase: '', auth: {} }),
    fetch: async (url, options) => {
      sent.push({ url, method: options.method, headers: { ...options.headers } });
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
    },
  });
  return { api, sent, header: () => api.csrfHeaders({ csrf })[csrf.headerName] };
}

test('the __Host- cookie is read ahead of one a sibling site could plant', async () => {
  // A site under the same parent domain can set keen_csrf for the whole
  // domain; a browser lets only this host set the __Host- name.
  for (const cookie of [
    'keen_csrf=planted; __Host-keen_csrf=issued',
    '__Host-keen_csrf=issued; keen_csrf=planted',
    'theme=ink; keen_csrf=planted; other=1; __Host-keen_csrf=issued; last=1',
  ]) {
    assert.equal((await page(cookie)).header(), 'issued', cookie);
  }
});

test('the configured name alone serves a server that sets no prefix', async () => {
  assert.equal((await page('theme=ink; keen_csrf=plain')).header(), 'plain');
  // An empty __Host- cookie holds no token to prefer.
  assert.equal((await page('__Host-keen_csrf=; keen_csrf=plain')).header(), 'plain');
});

test('a configured name that already carries a prefix is read as it is', async () => {
  for (const prefix of ['__Host-', '__Secure-', '__host-']) {
    const csrf = { cookieName: `${prefix}app_csrf`, headerName: 'X-CSRF-Token' };
    const cookie = `__Host-${prefix}app_csrf=doubled; app_csrf=bare; ${prefix}app_csrf=configured`;
    assert.equal((await page(cookie, csrf)).header(), 'configured', prefix);
  }
});

test('only a cookie with exactly the expected name gives a token', async () => {
  for (const cookie of [
    '',
    'theme=ink',
    'x__Host-keen_csrf=a; my_keen_csrf=b; keen_csrf2=c; __Host-keen_csrf_old=d',
    '__Secure-keen_csrf=a; __host-keen_csrf=b',
  ]) {
    const { api } = await page(cookie);
    assert.deepEqual({ ...api.csrfHeaders({ csrf: CSRF }) }, {}, cookie);
  }
});

test('the token is decoded and sent under the configured header name', async () => {
  const csrf = { cookieName: 'app_csrf', headerName: 'X-App-Token' };
  const { api } = await page('__Host-app_csrf=a%2Bb%3D', csrf);
  assert.deepEqual({ ...api.csrfHeaders({ csrf }) }, { 'X-App-Token': 'a+b=' });
});

test('every helper that changes data sends the __Host- token', async () => {
  const { api, sent } = await page('keen_csrf=planted; __Host-keen_csrf=issued');
  await api.apiPost('/api/v1/a', {});
  await api.apiPatch('/api/v1/a', {});
  await api.apiPut('/api/v1/a', {});
  await api.apiDelete('/api/v1/a');
  await api.apiPostForm('/api/v1/a', 'form');
  await api.apiRequest('/api/v1/a', { method: 'POST', json: {} });
  await api.apiRequest('/api/v1/a', { method: 'POST', formData: 'form' });
  await api.apiRequest('/api/v1/a', { method: 'DELETE' });
  await api.apiRequest('/api/v1/a', { method: 'PUT', body: 'text' });
  assert.equal(sent.length, 9);
  for (const request of sent) {
    assert.equal(request.headers['X-CSRF-Token'], 'issued', `${request.method} ${request.url}`);
  }
});

test('a read sends no token', async () => {
  const { api, sent } = await page('__Host-keen_csrf=issued');
  await api.apiGet('/api/v1/a');
  await api.apiRequest('/api/v1/a');
  await api.apiRequest('/api/v1/a', { method: 'HEAD', body: undefined });
  assert.equal(sent.length, 3);
  for (const request of sent) {
    assert.equal('X-CSRF-Token' in request.headers, false, `${request.method} ${request.url}`);
  }
});
