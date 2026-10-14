import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function load(file, names, globals) {
  const source = await readFile(new URL(`../src/js/${file}`, import.meta.url), 'utf8');
  return vm.runInNewContext(source.replace(/^export /gm, '') + `\n({${names.join(',')}})`, globals);
}
function node() {
  return { style: {}, children: [], appendChild(child) { this.children.push(child); }, addEventListener() {} };
}

test('framework picker exposes its original catalogue without another request', async () => {
  let reads = 0;
  const data = { items: [{slug: 'F1', name: 'Framework', has_clauses: true}], default: 'F1' };
  const api = await load('60-framework.js', ['_fetchFrameworks', 'getLoadedFrameworkCatalog'], {
    apiGet: async () => { reads++; return data; },
  });
  assert.equal(api.getLoadedFrameworkCatalog(), null);
  await Promise.all([api._fetchFrameworks({framework:{}}), api._fetchFrameworks({framework:{}})]);
  assert.equal(api.getLoadedFrameworkCatalog(), data);
  assert.equal(reads, 1);
});

test('shortcuts reuse initial items but explicitly refreshing fetches again', async () => {
  let reads = 0;
  const api = await load('80-shortcuts.js', ['_loadShortcuts'], {
    document: { getElementById: () => node(), createElement: node },
    apiGet: async () => { reads++; return []; },
  });
  const cfg = { shortcuts: { endpoint: '/saved' } };
  await api._loadShortcuts(cfg, []);
  assert.equal(reads, 0);
  await api._loadShortcuts(cfg);
  assert.equal(reads, 1);
});

test('failed autocomplete returns no reusable result so shortcuts can retry', async () => {
  const api = await load('70-search-autocomplete.js', ['_loadDatalist'], {
    document: { getElementById: () => node() },
    apiGet: async () => { throw new Error('temporary outage'); },
  });
  assert.equal(await api._loadDatalist({search:{datalistEndpoint:'/saved'}}), null);
});
