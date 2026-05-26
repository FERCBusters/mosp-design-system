// MOSP design system: Shortcuts.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Shortcuts dropdown (optional, standardises "save this view")
// ---------------------------------------------------------------------------

/**
 * Load and render the navbar shortcuts dropdown, including save and delete actions.
 */
async function _loadShortcuts(cfg) {
  const menu = document.getElementById('navShortcutsMenu');
  if (!menu) return;

  const ep = String(cfg.shortcuts.endpoint || '').trim();
  if (!ep) {
    // If no endpoint configured, hide the dropdown container
    const wrap = document.getElementById('navShortcutsWrap');
    if (wrap) wrap.style.display = 'none';
    return;
  }

  const render = (items) => {
    menu.innerHTML = '';

    // Save current view
    const liSave = document.createElement('li');
    const aSave = document.createElement('a');
    aSave.href = '#';
    aSave.className = 'dropdown-item';
    aSave.textContent = 'Save this view…';
    aSave.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const name = prompt('Shortcut name:', document.title || 'View');
      if (!name) return;
      const url = location.pathname + (location.search || '') + (location.hash || '');
      try {
        await apiPost(ep, {name, url}, {}, cfg);
        await _loadShortcuts(cfg);
      } catch (e) {
        alert(`Failed to save shortcut: ${e?.message || e}`);
      }
    });
    liSave.appendChild(aSave);
    menu.appendChild(liSave);

    const liDiv = document.createElement('li');
    liDiv.innerHTML = '<hr class="dropdown-divider">';
    menu.appendChild(liDiv);

    if (!items.length) {
      const liEmpty = document.createElement('li');
      const span = document.createElement('span');
      span.className = 'dropdown-item-text text-muted';
      span.textContent = 'No shortcuts yet.';
      liEmpty.appendChild(span);
      menu.appendChild(liEmpty);
      return;
    }

    for (const it of items) {
      const name = String(it?.name || '').trim();
      const url = String(it?.url || '').trim();
      const id = it?.id ?? it?.shortcut_id ?? null;
      if (!name || !url) continue;

      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center justify-content-between gap-2 px-2';

      const a = document.createElement('a');
      a.className = 'dropdown-item flex-grow-1';
      a.style.whiteSpace = 'nowrap';
      a.style.overflow = 'hidden';
      a.style.textOverflow = 'ellipsis';
      a.href = safeExternalHref(url) || url;
      a.textContent = name;

      row.appendChild(a);

      if (id !== null && id !== undefined) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline-danger';
        btn.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        btn.title = 'Delete shortcut';
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!confirm(`Delete shortcut "${name}"?`)) return;
          try {
            await apiDelete(`${ep}/${encodeURIComponent(String(id))}`, {}, cfg);
            await _loadShortcuts(cfg);
          } catch (e) {
            alert(`Failed to delete shortcut: ${e?.message || e}`);
          }
        });
        row.appendChild(btn);
      }

      li.appendChild(row);
      menu.appendChild(li);
    }
  };

  try {
    const data = await apiGet(ep, cfg);
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    render(items);
  } catch {
    const wrap = document.getElementById('navShortcutsWrap');
    if (wrap) wrap.style.display = 'none';
  }
}
