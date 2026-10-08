# @FERCBusters/mosp-design-system

A small shared UI "shell" + helper library designed to be used across various FERCBusters Open Source projects.

It assumes you're serving mostly-static HTML pages (no SPA) and using:

- Bootstrap 5 (CSS + JS bundle)
- bootstrap-icons
- D3 (page-specific; not bundled here)

## What this provides

### Standard UI shell
- Fixed **horizontal** Bootstrap navbar (`navbar-keen`)
- Consistent brand slot (icon + name)
- Consistent buttons, cards, tables, muted text (via `styles.css`)
- Optional:
  - Framework selector (adds `?framework=<slug>` to nav links)
  - Global search box (optionally with datalist autocomplete)
  - Notification bell + badge (polling + optional websocket)
  - **Shortcuts** dropdown: "Save this view…" + list + delete

### Standard helpers (shared patterns)
- CSRF header handling
- `apiGet/apiPost/apiPatch/apiPut/apiDelete/apiPostForm`
- querystring helpers (`qs/qbool/qint/setQuery`)
- timestamp helpers (`fmtTs`, filename-safe `fmtTsFilename`)
- configurable visible date-format ↔ yyyy-mm-dd helpers
- sortable tables
- `toast()` helper for Bootstrap alerts
- `bindAutoApply()` helper (debounced auto-apply for filters)

## Files

- `dist/app.js` – bundled ESM module for consuming applications.
- `dist/styles.css` – bundled themeable CSS for consuming applications.
- `src/js/*.js` – maintainable JavaScript source fragments, split by feature area.
- `src/css/*.css` – maintainable CSS source fragments, split by feature area.
- `scripts/build.mjs` – concatenates the ordered source fragments into `dist/app.js` and `dist/styles.css`.

The source fragments intentionally share one bundle scope and are concatenated in the explicit order listed in `scripts/build.mjs`. Edit the relevant file under `src/js/` or `src/css/`, then run `npm run build`; do not edit generated files under `dist/` directly.

## Basic integration pattern (static HTML)

1) Copy the kit into each app's `public/` (recommended path):
```
services/ui/public/vendor/mosp-design-system/
  app.js
  styles.css
```

2) Include Bootstrap + icons
```html
<link href="/vendor/bootstrap/bootstrap.min.css" rel="stylesheet">
<link href="/vendor/bootstrap-icons/bootstrap-icons.min.css" rel="stylesheet">
<link rel="stylesheet" href="/vendor/mosp-design-system/styles.css">
```

3) Add a navbar mount element:
```html
<body data-page="controls">
  <div id="navbar"></div>
  ...
</body>
```

4) Configure BEFORE importing (inline `<script>` *above* any module imports):

Example for KEEN:

```html
<script>
  window.mospUiConfig = {
    appId: "keen",
    appName: "Keen",
    brandIcon: "/keen.svg",
    brandHref: "/",
    csrf: { cookieName: "keen_csrf" },
    auth: {
      meEndpoint: "/api/v1/me",
      logoutEndpoint: "/api/v1/auth/logout",
      logoutRedirect: "/login.html",
      accountHref: "/account.html"
    },
    links: [
      { label: "Controls", href: "/?stay=1", key: "controls" },
      { label: "Events", href: "/events.html", key: "events" },
      { label: "Sources", href: "/sources.html", key: "sources" },
      { label: "Admin", href: "/admin.html", key: "admin", requireAny: ["is_admin", "can_audit_trail"] }
    ],
    framework: {
      enabled: true,
      endpoint: "/api/v1/frameworks",
      queryParam: "framework",
      default: "ISO27001:2022"
    },
    search: {
      enabled: true,
      placeholder: "Search events",
      targetPath: "/events.html",
      queryParam: "q",
      datalistId: "mospSavedSearches",
      datalistEndpoint: "/api/v1/me/saved-searches"
    },
    shortcuts: {
      enabled: true,
      endpoint: "/api/v1/me/shortcuts"
    },
    bell: {
      enabled: true,
      href: "/admin.html#questions",
      title: "Open questions",
      summaryEndpoint: "/api/v1/admin/questions/summary",
      countKey: "open_count",
      wsUrl: (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/api/ws/notifications",
      wsType: "questions.open_count"
    }
  };
</script>
```

5) In your page modules, call `initNavbar()`:
```js
import { initNavbar, apiGet } from "/vendor/mosp-design-system/app.js";

const me = await initNavbar();
// ... page-specific logic ...
```

## Sharing the code across repos

### Option A — npm dependency via git
In each app's UI build directory:
- add dependency:
  - `"@FERCBusters/mosp-design-system": "git+ssh://git@github.com/FERCBusters/mosp-design-system.git#dev"`

- add a build/copy step to place `dist/` into `services/ui/public/vendor/mosp-design-system/`.

### Option B — git submodule
- Add the UI kit as a submodule into each repo (e.g. `vendor/mosp-design-system/`)
- Copy `dist/*` into `public/vendor/mosp-design-system/` during build/deploy.
