// MOSP design system: Toast.
// This file is concatenated by scripts/build.mjs; keep declarations in bundle order.

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

/**
 * Show a Bootstrap-styled transient toast/alert message.
 */
export function toast(containerEl, message, kind = 'info', ttlMs = 4000) {
  if (!containerEl) return;
  const cls = {
    info: 'alert alert-info',
    secondary: 'alert alert-secondary',
    success: 'alert alert-success',
    warning: 'alert alert-warning',
    danger: 'alert alert-danger',
  }[kind] || 'alert alert-info';
  containerEl.className = cls;
  containerEl.textContent = message;
  containerEl.style.display = '';

  const token = String(Date.now()) + String(Math.random());
  containerEl.dataset.toastToken = token;

  const ms = Number(ttlMs ?? 4000);
  if (ms > 0) {
    window.setTimeout(() => {
      if (containerEl.dataset.toastToken === token) {
        containerEl.style.display = 'none';
        containerEl.textContent = '';
      }
    }, ms);
  }
}
