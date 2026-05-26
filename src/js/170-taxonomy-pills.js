// MOSP design system: Taxonomy Pills.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Taxonomy / capability pill browser
// ---------------------------------------------------------------------------

/**
 * Escape text for the taxonomy pill browser HTML renderer.
 */
function _escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Convert common iterable or array-like values into a Set.
 */
function _asSet(v) {
  if (!v) return new Set();
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  try {
    return new Set(v);
  } catch {
    return new Set();
  }
}

/**
 * Resolve a taxonomy node path from a Map or object lookup.
 */
function _pathFor(pathsById, id) {
  if (!pathsById) return '';
  if (pathsById instanceof Map) return pathsById.get(Number(id)) || '';
  return pathsById[String(id)] || pathsById[Number(id)] || '';
}

// Render a hierarchical taxonomy as expandable, clickable "pills".
// This is intentionally framework-agnostic so multiple apps can share it.
//
// Required options:
//   - container: HTMLElement
//   - tree: array of nodes (each node: {id, key?, display_name?, children?})
//
// Optional options:
//   - selectedIds: Set/array of ids (multi-select)
//   - selectedId: number (single-select)
//   - expandedIds: Set/array of ids that are expanded
//   - searchTerm: string used to filter by name/key/path
//   - pathsById: Map/object id->path string
//   - selectionMode: 'multi' | 'single' (default: 'multi')
//   - showSelectedPills: boolean (default: true)
//   - emptySelectedText: string
//   - labelForNode(node): string
//   - metaForNode(node): string (small line under pill)
//   - colorForNode(node): css color string used for --cap-color
//   - onToggleSelect(id, node)
//   - onSelect(id, node)
//   - onToggleExpand(id, node)
/**
 * Render and wire an expandable hierarchical taxonomy pill browser.
 */
export function renderTaxonomyPillsBrowser(opts) {
  const o = opts || {};
  const container = o.container;
  if (!container) return;

  const tree = Array.isArray(o.tree) ? o.tree : [];
  const selectionMode = (o.selectionMode === 'single') ? 'single' : 'multi';
  const showSelectedPills = o.showSelectedPills !== false;
  const emptySelectedText = String(o.emptySelectedText || 'No categories selected.');

  const expandedIds = _asSet(o.expandedIds);
  const selectedIds = _asSet(o.selectedIds);
  const selectedId = (selectionMode === 'single') ? Number(o.selectedId ?? NaN) : NaN;
  const term = String(o.searchTerm || '').trim().toLowerCase();

  const labelForNode = (typeof o.labelForNode === 'function')
    ? o.labelForNode
    : (node) => (node?.display_name || node?.display || node?.name || node?.key || String(node?.id || '')).trim();

  const metaForNode = (typeof o.metaForNode === 'function')
    ? o.metaForNode
    : (node) => {
      const p = _pathFor(o.pathsById, node?.id);
      return p && p !== labelForNode(node) ? p : '';
    };

  const colorForNode = (typeof o.colorForNode === 'function')
    ? o.colorForNode
    : () => '';

  // Build a quick lookup map for selected pill rendering.
  const byId = new Map();
  const visit = (n) => {
    if (!n) return;
    byId.set(Number(n.id), n);
    (n.children || []).forEach(visit);
  };
  tree.forEach(visit);

  const shouldShowNode = (node) => {
    if (!term) return true;
    const path = _pathFor(o.pathsById, node?.id);
    const hay = [labelForNode(node), node?.key, path].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(term)) return true;
    return (node.children || []).some((c) => shouldShowNode(c));
  };

  const renderSelected = () => {
    if (selectionMode === 'single') return '';
    if (!showSelectedPills) return '';
    if (!selectedIds.size) return `<div class="small">${_escapeHtml(emptySelectedText)}</div>`;

    const nodes = Array.from(selectedIds)
      .map((id) => byId.get(Number(id)))
      .filter(Boolean)
      .sort((a, b) => String(labelForNode(a)).localeCompare(String(labelForNode(b))));

    return nodes.map((node) => {
      const c = colorForNode(node);
      const p = _pathFor(o.pathsById, node.id) || labelForNode(node);
      return `
        <button type="button" class="capability-pill selected selected-removable" data-action="remove" data-node-id="${Number(node.id)}" style="--cap-color:${_escapeHtml(c)}" title="${_escapeHtml(p)}">
          <span class="pill-label">${_escapeHtml(labelForNode(node))}</span>
          <span class="remove-x" aria-hidden="true">×</span>
        </button>
      `;
    }).join('');
  };

  const renderNode = (node, depth = 0) => {
    if (!shouldShowNode(node)) return '';
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const autoExpand = Boolean(term);
    const isExpanded = hasChildren && (autoExpand || expandedIds.has(Number(node.id)));
    const isSelected = (selectionMode === 'single')
      ? Number(node.id) === selectedId
      : selectedIds.has(Number(node.id));
    const c = colorForNode(node);
    const meta = metaForNode(node);

    const childrenHtml = isExpanded
      ? (node.children || []).map((cNode) => renderNode(cNode, depth + 1)).join('')
      : '';

    return `
      <div class="cap-tree-node depth-${Math.min(depth, 4)}" data-node-id="${Number(node.id)}">
        <div class="cap-node-row">
          ${hasChildren
            ? `<button type="button" class="cap-toggle ${isExpanded ? 'expanded' : ''}" data-toggle-node="${Number(node.id)}" aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${_escapeHtml(labelForNode(node))}">${isExpanded ? '▾' : '▸'}</button>`
            : `<span class="cap-toggle-spacer" aria-hidden="true"></span>`}
          <div class="cap-tree-node-content">
            <button type="button" class="capability-pill ${isSelected ? 'selected' : ''}" data-action="pick" data-node-id="${Number(node.id)}" style="--cap-color:${_escapeHtml(c)}">
              <span class="pill-label">${_escapeHtml(labelForNode(node))}</span>
            </button>
            ${meta ? `<div class="cap-tree-meta small muted">${_escapeHtml(meta)}</div>` : ''}
          </div>
        </div>
        ${childrenHtml ? `<div class="cap-children">${childrenHtml}</div>` : ''}
      </div>
    `;
  };

  const selectedHtml = renderSelected();
  const treeHtml = tree.map((n) => renderNode(n, 0)).join('');

  container.innerHTML = `
    ${showSelectedPills && selectionMode === 'multi' ? `<div class="selected-pills">${selectedHtml}</div>` : ''}
    <div class="capability-tree-wrap">${treeHtml || '<div class="small">No categories available.</div>'}</div>
  `;

  // Pick / remove actions.
  container.querySelectorAll('button[data-action][data-node-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-node-id'));
      if (Number.isNaN(id)) return;
      const node = byId.get(id);
      const action = btn.getAttribute('data-action');
      if (selectionMode === 'single') {
        if (typeof o.onSelect === 'function') o.onSelect(id, node);
        return;
      }
      // multi
      if (action === 'pick' || action === 'remove') {
        if (typeof o.onToggleSelect === 'function') o.onToggleSelect(id, node);
      }
    });
  });

  // Expand/collapse actions.
  container.querySelectorAll('button[data-toggle-node]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = Number(btn.getAttribute('data-toggle-node'));
      if (Number.isNaN(id)) return;
      const node = byId.get(id);
      if (typeof o.onToggleExpand === 'function') o.onToggleExpand(id, node);
    });
  });
}
