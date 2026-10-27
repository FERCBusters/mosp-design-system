import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/js/110-dates.js', import.meta.url), 'utf8');
function load() {
  const window = { mospPreferences: {}, mospDefaultTimezone: 'UTC', mospDefaultDateFormat: 'ymd' };
  let constructions = 0;
  const intl = { DateTimeFormat: function (...args) {
    constructions++;
    return new Intl.DateTimeFormat(...args);
  } };
  const api = vm.runInNewContext(source.replace(/^export /gm, '') + '\n({fmtTs, fmtTsFilename, tsSortKey, isoDateToDisplay, preferredDateFormat})', {
    window, Intl: intl, getUiConfig: () => ({}),
  });
  return { ...api, window, constructions: () => constructions };
}

test('timestamp preferences, offsets, UTC defaults and midnight use the selected format', () => {
  const d = load();
  assert.equal(d.fmtTs('2026-10-23T00:00:00'), '2026-10-23 00:00:00');
  d.window.mospPreferences = { date_format: 'dmy', use_local_timezone: true, timezone: 'Australia/Melbourne' };
  assert.equal(d.fmtTs('2026-10-23T20:08:08Z'), '24/10/2026 07:08:08');
  assert.equal(d.fmtTs('2026-10-24T07:08:08+11:00'), '24/10/2026 07:08:08');
  assert.equal(d.fmtTs('2026-10-23T20:08:08z'), '24/10/2026 07:08:08');
  assert.equal(d.fmtTs('2026-06-23T20:08:08Z'), '24/06/2026 06:08:08');
  d.window.mospPreferences.date_format = 'ymd';
  assert.equal(d.fmtTs('2026-10-23T20:08:08Z'), '2026-10-24 07:08:08');
  d.window.mospPreferences = { date_format: 'default' };
  d.window.mospDefaultDateFormat = 'dmy';
  assert.equal(d.fmtTs('2026-10-23T20:08:08Z'), '23/10/2026 20:08:08');
});

test('calendar dates, wire values, filenames and sorting stay independent of display order', () => {
  const d = load();
  const iso = '2026-10-23T20:08:08Z';
  const filename = d.fmtTsFilename(iso), sort = d.tsSortKey(iso);
  d.window.mospPreferences = { date_format: 'dmy' };
  assert.equal(d.isoDateToDisplay('2026-10-23'), '23/10/2026');
  assert.equal(d.fmtTsFilename(iso), filename);
  assert.equal(d.tsSortKey(iso), sort);
  assert.equal(d.fmtTs(null), '');
  assert.equal(d.fmtTs('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
  assert.equal(d.isoDateToDisplay('not a date'), '');
});

test('formatter construction stays constant per timezone and updates after preference changes', () => {
  const d = load();
  for (let i = 0; i < 10000; i++) d.fmtTs('2026-10-23T20:08:08Z');
  assert.equal(d.constructions(), 1);
  d.window.mospPreferences.date_format = 'dmy';
  assert.equal(d.fmtTs('2026-10-23T20:08:08Z'), '23/10/2026 20:08:08');
  assert.equal(d.constructions(), 1);
  d.window.mospDefaultTimezone = 'Australia/Melbourne';
  assert.equal(d.fmtTs('2026-10-23T20:08:08Z'), '24/10/2026 07:08:08');
  assert.equal(d.constructions(), 2);
  d.window.mospDefaultTimezone = 'invalid/timezone';
  for (let i = 0; i < 100; i++) assert.doesNotThrow(() => d.fmtTs('2026-10-23T20:08:08Z'));
  assert.equal(d.constructions(), 3);
  d.window.mospDefaultTimezone = 'UTC';
  assert.equal(d.fmtTs('2026-10-23T20:08:08Z'), '23/10/2026 20:08:08');
  assert.equal(d.constructions(), 4);
});

test('date entry follows the preference and retains canonical ISO wire values', () => {
  const window = { mospPreferences: { date_format: 'dmy' } };
  const d = vm.runInNewContext(source.replace(/^export /gm, '') + '\n({displayDateToIso, dateFormatPlaceholder})', { window, getUiConfig: () => ({}) });
  assert.equal(d.displayDateToIso('23/10/2026'), '2026-10-23');
  assert.equal(d.displayDateToIso('2026-10-23'), '2026-10-23');
  assert.equal(d.dateFormatPlaceholder(), 'DD/MM/YYYY');
  window.mospPreferences.date_format = 'ymd';
  assert.equal(d.displayDateToIso('23/10/2026'), '');
  assert.equal(d.displayDateToIso('2026-10-23'), '2026-10-23');
  assert.equal(d.displayDateToIso('2026-02-30'), '');
  assert.equal(d.dateFormatPlaceholder(), 'YYYY-MM-DD');
});

test('sorting DMY dates compares calendar order instead of US month/day parsing', async () => {
  const sortSource = await readFile(new URL('../src/js/120-table-sorting.js', import.meta.url), 'utf8');
  const parse = vm.runInNewContext(sortSource.replace(/^export /gm, '') + '\nparseSortValue');
  assert.ok(parse('02/01/2026').v < parse('01/02/2026').v);
  assert.ok(parse('31/12/2025 23:59:59').v < parse('01/01/2026 00:00:00').v);
  assert.equal(parse('23/10/2026').v, Date.parse('2026-10-23T00:00:00Z'));
  assert.equal(parse('1792785600000').v, 1792785600000);
});
