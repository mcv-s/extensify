# Extensify Roadmap and Handoff

## Goal

Build and maintain a usable Chromium Manifest V3 extension for browsing and managing trusted addons. The user loads this repository itself through **Load unpacked**. The extension has no custom server and no build/bundle step; Supabase supplies auth and catalog storage. Keep source readable and preserve addon filenames and formatting.

## Repository baseline

- The repository has no app framework or meaningful implementation yet; it contains only a short `README.md` and project metadata.
- Existing `README.md` has a pre-existing working-tree modification. Preserve its content unless a targeted documentation update is needed.
- Use browser-native ES modules, CSS, Chrome storage, and APIs. No Vite or dependency downloads are required.
- Supabase public settings are configured in root `supabase.json`; it contains the project ref, HTTPS URL, and public anon/publishable key. Never print or embed a service-role key.
- The user asked to keep work quick and usable first; editor scope is intentionally plain text file editing, local drafts, ZIP import/export, validation, and local install. Rich editor features can be added later.

## Product architecture

- `src/background/`: MV3 service worker, message routing, tab/content execution registration.
- `src/content/`: content-script bridge and isolated-page integration.
- `src/runtime/`: versioned `window.extensify` runtime, capability checks, addon context.
- `src/storage/`: centralized versioned local persistence and addon-scoped storage.
- `src/data/`: all-user-data export/import, validation, migration and reset.
- `src/addons/`: config/package validation, install/refresh/uninstall, matching, settings generation.
- `src/supabase/`, `src/auth/`: optional public client, auth, compact catalog/download/publish mapping.
- `src/editor/`: file tree, tabs, plain-text source editor, validation, ZIP import/export and local draft save.
- `src/pages/`, `src/components/`, `src/styles/`: small page modules and shared primitives plus page-specific CSS.
- Root `manifest.json`, popup and page HTML entrypoints; root `supabase.json`; `supabase/migrations/` for RLS-backed schema; `docs.html` for user/developer documentation.

## Work phases

### 1. Scaffold and design system

- Keep the MV3 manifest at repository root and page scripts/styles directly loadable from the unpacked folder; use shared theme tokens and accessible navigation.
- Establish dark/light themes, Phosphor icon usage, tooltip integration with graceful fallback, responsive shell and popup.

### 2. Local data and addon core

- Implement namespaced, versioned local storage and migration seams.
- Implement `config.json` parsing/validation, path and extension safety, SVG safety, URL match patterns, permissions, settings schema validation and defaults.
- Implement local install/enable/disable/refresh/uninstall and generated settings.
- Implement central versioned data export/import/reset and popup state.

### 3. Catalog and Supabase

- Add optional config-driven Supabase public client and auth.
- Add compact schema/RLS migration for profiles, addons, versions, and files, with public published reads and owner/admin writes.
- Fetch listings compactly; fetch source files only for detail/install/refresh; preserve readable source.
- Provide graceful disconnected/local-only experience when credentials are absent.

### 4. Pages and editor

- Implement main app, Explorer search/list, addon detail/install management, Extensify settings, and docs.
- Implement `/editor` with a file tree, tabs, plain-text file editing, metadata/config editing, local draft save, validation, ZIP import/export, and install-local action. Rich syntax editor and preview are deferred.

### 5. Verification and handoff

- Add focused tests for validation, URL matching, settings schemas, migration/export/import, install/refresh/uninstall, SVG, ZIP, and Supabase mapping.
- Build the extension and fix compile/runtime issues; exercise core flows in available browser tooling where possible.
- Update README and docs with setup, Supabase configuration/migrations, Chromium loading, addon authoring and limitations.

## Decisions and constraints

- One Chromium extension targets Chrome and Edge; Firefox is out of scope.
- No payments, ratings, reviews, social layer, or moderation workflow.
- Only SVG stored addon image assets; reject raster images and unsafe SVG constructs.
- Addon scripts are trusted creator code, readable and preserved. Runtime permission declarations are transparent; browser-delivered “hidden” settings are not secrets but values changable by the addon itself and usable in config fields.
- Use only public Supabase credentials in the extension; RLS is mandatory. No privileged key in client code.
- Keep addon files normalized by `addon_id`, version and relative path; enforce file count/size limits.
- Preserve pre-existing user changes and do not overwrite unrelated files.

## Progress

- [x] Inspect repository and record baseline.
- [x] Create this durable roadmap.
- [x] Proceed with placeholder Supabase settings at root `supabase.json` (user requested a fill-in config file).
- [x] Build the extension as a directly loadable root folder with no build tooling or external package dependencies.
- [x] Implement popup, shell/pages, local state, addon validation/lifecycle/settings, data transfer, Supabase REST/auth adapter, SQL migration, docs, text editor, local install, and ZIP import/export.
- [x] Add editor project picker for multiple drafts/installed addons, fixed-height app shell with independently scrolling page content, persisted collapsible sidebar (button and Ctrl+B), live Light/Dark/System appearance controls, and the installed-addon permission label initialization fix.
- [x] Compact the home dashboard to fit typical laptop-height windows.
- [x] Give Installed its own route/page; add persisted collapse-versus-hide sidebar behavior; move content scrolling to a full-width viewport for right-edge scrollbars; make the editor flush to the content edges and hide horizontal tab scrollbars.
- [x] Remove Supabase onboarding from end-user Settings and remove the auth redirect flow; creator login uses password auth. Supabase project/schema setup remains one-time maintainer setup.
- [x] Verify core logic with Node tests and JavaScript syntax checks.
- [x] Configure root `supabase.json` with the Supabase project URL and public key.
- [ ] Apply the database migration once, create/sign in the creator user, and add its UUID to `extensify_admins`.
- [ ] Browser-check catalog, password sign-in, local addon installation, User Scripts enable/disable, and sync against the configured Supabase project.

## Resume notes

Start by checking this roadmap and `git status`. Root `manifest.json` points directly at `src/background/service-worker.js`; every page uses relative paths and local ES modules. Load the repository root as unpacked. The user confirmed the extension now loads. Project URL/public key are configured in `supabase.json`; the outstanding external setup is applying the schema migration and creating/authorizing the creator account. No Vite, generated `dist/`, npm install, or server is needed. The editor intentionally stays plain text + ZIP for now.

Latest UI details: `/editor` without a project query shows a project chooser, creates a unique new addon draft, and loads ZIPs as drafts. The shared shell is fixed to `100vh`/`100dvh`; page content scrolls within the shell. Theme choices save immediately and System follows `prefers-color-scheme`. Sidebar collapse is persisted and toggles with Ctrl+B or its topbar control. If the installed addon detail view previously failed due to `permissionText` initialization, that declaration now precedes initial rendering.

Latest navigation/layout details: Installed is `installed.html` and the sidebar/main dashboard links target it. Settings stores `preferences.sidebarBehavior` (`collapse` or `hide`) alongside the visible/collapsed state; local storage schema is v3. The scroll container spans the whole main column so long pages keep the scrollbar at the app’s right edge. The editor uses the flush shell layout, sizes its file workspace to the remaining viewport below the page heading and toolbar, and hides the horizontal tab scrollbar.

Latest addon/editor changes: addon descriptions are full Markdown in the required `addon-description.md`; addon-specific docs pages/fields have been removed. `config.json` logos may use any Phosphor icon name/class plus a six-digit hex color or an included SVG file path. Legacy local packages migrate old description/icon fields automatically. The project picker supports multiple saved editor drafts and published creator projects; installed consumer addons are never editable through the editor. Right-clicking editor files opens rename/delete actions (the config and description filenames are protected). Publish appears for signed-in users; the Supabase migration restricts publishing to the configured admin user. **Install locally** installs or refreshes the current package and navigates to its detail page. Local addon refresh uses the saved local draft/code and does not query Supabase. Supabase single-row queries now return readable missing-record errors instead of PostgREST object-coercion failures.

Latest editor/catalog follow-up: addon cards in the Editor project picker now have right-click **Rename title** and **Delete addon** actions. IDs stay stable when titles are renamed. Renaming a published package warns that the public title changes only after republishing; deleting one warns that its public listing and local state are removed, then deletes the remote Supabase addon record (RLS still checks ownership/admin access). New/default/legacy-migrated addon logos use a Phosphor `PuzzlePiece` icon instead of defaulting to an SVG. The app uses the regular Phosphor Web stylesheet from jsDelivr and `ph ph-*` markup. Editor code-pane descendants now have explicit zero minimum heights so they size within the remaining panel instead of forcing the page taller. Explorer retries catalog reads without `addons.logo` when connected databases have the older schema; publish and draft upsert similarly retry without that optional column. The one-time migration still adds `logo` for full color/icon metadata. Regression coverage includes both missing-column error shapes; `npm test` passes (17 tests).

The SQL migration was updated idempotently to add the `logo` JSONB column to existing `addons` tables. If the catalog schema is already installed, rerun `supabase/migrations/202610110001_extensify_schema.sql` once before publishing or reading logo metadata. Extension users do not perform this setup. Verification: `npm test` passes (15 tests); all `src/**/*.js` files pass `node --check`. Browser-check catalog/login/publish against the configured live project when convenient.


Latest request follow-up: new templates omit README.md; package normalization strips legacy README.md while preserving addon-description.md. Addon logo color is rendered from the package config throughout installed, popup, Editor, and Explorer surfaces. Phosphor icon names are free-form and passed through to the web stylesheet. Account chip displays the signed-in email or Signed out, including after auth changes. Supabase migration backfills addons.logo from each current version config; rerun it once to expose remote catalog colors on older projects. Added regression tests for README removal and arbitrary icon names.


Latest UI follow-up: Explorer now fills missing/default addon listing logos from published version config (metadata-only query, no source file download), preserving correct per-addon icon and color before install. Installed consumer packages are excluded from the Editor picker, direct edit URLs require an editor draft, and addon details only show Edit files for an editable draft. File context menu adds Copy path. Signed-in settings hide credential fields until signed out; Page scripts spacing is normalized. Removed the shell eyebrow, renamed dashboard heading Home, use root logo.svg in sidebar/popup/home graphic and as favicon, set lowercase '<page> - extensify' tab titles, replace Settings slider symbol with gear and Installed nav symbol with Phosphor puzzle-piece. Catalog card descriptions still use compact summaries; detail shows full addon-description.md.



Catalog bugfix: the extension's small REST client now supports PostgREST in() filtering, used to hydrate any missing/default catalog logo from version config. Regression test exercises the exact REST filter. Root manifest now declares 16/32/48/128 PNG toolbar icons in icons/, rendered to match logo.svg because Chromium manifest icons require raster image files.

Latest documentation/settings update: Settings uses the standard full-width page layout and account controls are signed-out-only; authenticated users see their account and sign-out. Root `docs.md` is the canonical comprehensive guide, rendered on the Documentation page by the local Markdown renderer. Its left navigation is generated from section headings; code fences receive copy buttons. Keep `docs.md` accurate in every product change (see root `AGENTS.md`). Do not fetch a CDN Markdown parser because extension CSP requires executable code to remain local.


Password-manager follow-up: Settings sign-in is a labeled POST login form with named username/password fields and standard autocomplete=username/current-password hints. docs.md notes browser password-manager support may vary for extension pages.


Auth session hardening: password is never persisted by Extensify. Supabase access/refresh tokens are stored under a separate Chrome storage.local key restricted to TRUSTED_CONTEXTS, omitted from Extensify state export, and cleared on reset/sign-out. Legacy state tokens migrate out on next load. Session refresh happens proactively within 60 seconds of expiry and retries authenticated 401 requests. See docs.md for the storage security limitation; extension profile/developer-tools access is not cryptographically protected.


Settings auth visibility follow-up: cached signed-in identity stays visible during temporary Supabase/network check failures, while confirmed sign-out reveals the login form. Added explicit display:none!important for hidden login/sign-out controls because shared setting-field display rules can override the HTML hidden state.

