import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function load(file, names, globals) {
  const source = await readFile(new URL(`../src/js/${file}`, import.meta.url), 'utf8');
  return vm.runInNewContext(source.replace(/^export /gm, '') + `\n({${names.join(',')}})`, globals);
}

test('errorText prefers the readable message behind API errors', async (t) => {
  const api = await load('50-api.js', ['errorText'], {});
  assert.equal(api.errorText(null), api.errorText(new Error('')));
  assert.match(api.errorText(new Error('Not found')), /Not found/);
  // Failed fetches become plain language instead of a browser exception.
  assert.equal(
    api.errorText(new Error('Failed to fetch')),
    'Network problem. Check your connection and try again.',
  );
  // JSON bodies from server errors surface their detail field.
  assert.equal(api.errorText(new Error('{"detail":"Validation failed"}')), 'Validation failed');
  // Anything without a usable message falls back to the generic sentence.
  assert.match(api.errorText(undefined), /Something went wrong/);
  // Very long blow-ups stay bounded and readable.
  assert.match(api.errorText(new Error('x'.repeat(5000))), /…$/);
});
