// MOSP design system: Table Sorting.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Table sorting (shared UX)
// ---------------------------------------------------------------------------

/**
 * Enable click-to-sort behaviour on tables marked with sortable headers.
 */
export function enableTableSorting(root = document) {
  const tables = Array.from(root.querySelectorAll('table[data-sortable], table.sortable'));
  for (const table of tables) {
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) continue;

    const headers = Array.from(thead.querySelectorAll('th'));
    headers.forEach((th, idx) => {
      if (th.hasAttribute('data-nosort')) return;
      th.classList.add('sortable');
      th.tabIndex = 0;
      th.setAttribute('role', 'button');
      th.setAttribute('aria-label', `Sort by ${th.textContent?.trim() || 'column'}`);

      const handler = (ev) => { ev.preventDefault(); sortTableByColumn(table, idx); };
      th.addEventListener('click', handler);
      th.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') handler(ev); });
    });
  }
}

/**
 * Read the sortable value from a table cell.
 */
function cellSortValue(cell) {
  if (!cell) return '';
  const ds = cell.getAttribute('data-sort');
  if (ds !== null && ds !== '') return ds;
  return (cell.textContent || '').trim();
}

/**
 * Parse a table sort value as a number, timestamp, or lowercase string.
 */
function parseSortValue(v) {
  const s = String(v ?? '').trim();
  if (!s) return {t: 'str', v: ''};
  const num = s.replace(/,/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(num)) return {t: 'num', v: parseFloat(num)};
  const d = Date.parse(s);
  if (!Number.isNaN(d) && /\d/.test(s)) return {t: 'date', v: d};
  return {t: 'str', v: s.toLowerCase()};
}

/**
 * Sort a table body by a selected column and toggle sort direction.
 */
function sortTableByColumn(table, colIndex) {
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  const ths = Array.from(thead.querySelectorAll('th'));
  const th = ths[colIndex];
  if (!th) return;

  const cur = th.getAttribute('data-sort-dir') || '';
  const dir = cur === 'asc' ? 'desc' : 'asc';

  ths.forEach((h) => {
    if (h !== th) {
      h.removeAttribute('data-sort-dir');
      h.classList.remove('sort-asc', 'sort-desc');
    }
  });

  th.setAttribute('data-sort-dir', dir);
  th.classList.remove('sort-asc', 'sort-desc');
  th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');

  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length <= 1) return;

  const decorated = rows.map((tr, i) => {
    const cell = tr.children?.[colIndex];
    if (!cell) return {tr, key: {t: 'str', v: '~~~~'}, i};
    const raw = cellSortValue(cell);
    return {tr, key: parseSortValue(raw), i};
  });

  decorated.sort((a, b) => {
    const ka = a.key; const kb = b.key;
    const order = {num: 0, date: 1, str: 2};
    if (ka.t !== kb.t) return order[ka.t] - order[kb.t];
    let cmp = 0;
    if (ka.v < kb.v) cmp = -1;
    else if (ka.v > kb.v) cmp = 1;
    else cmp = a.i - b.i;
    return dir === 'asc' ? cmp : -cmp;
  });

  for (const r of decorated) tbody.appendChild(r.tr);
}
