Extensify is one Chromium Manifest V3 extension for Chrome and Edge. It provides a local home for small, trusted addons that enhance web pages. The same extension contains the popup, Explorer, addon details, Installed, Editor, Settings, and this guide. It does not require a separate application server.

Browsing and installing addons does not require an account. Creator sign-in uses the maintainer-configured Supabase project and is only needed for publishing and managing creator projects.

## Overview

Extensify works without a user account or a build step. Browsing and installing addons is available to everyone; a creator signs in only when managing or publishing creator projects.

## Install and open Extensify

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on Developer mode.
3. Choose **Load unpacked** and select the workspace folder containing `manifest.json`.
4. Pin Extensify from the browser’s extensions menu to open its popup quickly.

After extension source or manifest changes, return to the extensions page and click **Reload** on Extensify. The popup opens a new full-page Extensify tab. The sidebar links to Home, Explorer, Installed, Editor, Settings, and Documentation. The sidebar button or Ctrl+B toggles it; Settings chooses whether it collapses to icons or hides completely.

The toolbar popup shows installed addons and lets you enable or disable each one. It also links to the full interface and Settings.

## Browse and install addons

Explorer searches the published catalog by addon title. Each compact listing shows its icon, title, a short description, author, and install/enabled state. Open a listing for its full `addon-description.md`, requested permissions, supported site patterns, version, and available changelog.

Review the declared permissions and sites before installation. Install stores the validated package in this browser and initializes its visible setting values from defaults. A newly installed addon starts disabled. To run its page scripts, enable **Allow User Scripts** for Extensify in the browser’s extension details, then enable the addon. Chromium may ask for access to the addon’s declared websites.

Installed lists packages stored on this device. Installed does not mean editable: only an Editor project or saved creator draft appears in Editor. Installing a public addon never grants permission to edit or publish its source. Addon settings remain available from its detail page.

Enable and disable changes whether Extensify registers and executes that addon. Refresh retrieves the latest published package and keeps values for setting keys that still exist, while initializing new keys from defaults. Removed keys are discarded. Uninstall removes the addon’s source, configuration, settings, registration, and addon-scoped local data. Installing again starts with defaults.

## Create and edit a project

Open Editor to create a new addon project, choose an existing saved project, or load a ZIP. Each project has its own stable addon ID. Editor projects and saved creator drafts are editable; an installed consumer copy by itself is not. Right-click a file in the file tree to copy its path, rename it, or delete it. `config.json` and `addon-description.md` are required and cannot be renamed or deleted.

Editor treats supported source files as readable text, including JavaScript, CSS, HTML, JSON, Markdown, text, and SVG. Multiple files can be opened in tabs. **Save draft** saves on this device. **Save ZIP** exports the package. **Load ZIP** imports a package into a project. **Validate** checks config, paths, file types, logo, permissions, settings, and declared entry points. **Preview** renders the Markdown description. **Install locally** installs or refreshes the local copy and opens its detail page; it does not publish it.

Right-click a project to rename its title or delete it. A title rename preserves its ID; for a published addon, Explorer’s title changes only after publishing the new draft. Deleting a published project warns that its public listing and local files/settings will be removed. Deleting the local draft of an addon is distinct from uninstalling its installed copy.

### Package files

A package is a ZIP or a set of relative file paths with `config.json` at its root. A typical project looks like this:

```text
example-addon/
  config.json
  addon-description.md
  content.js
  content.css
  settings.html
  assets/
    icon.svg
```

Allowed extensions are `.html`, `.css`, `.js`, `.json`, `.md`, `.txt`, and `.svg`. SVG is the only supported image format. Each file is limited to 2 MiB. Paths must be relative, use forward slashes, and cannot contain `.` or `..` path segments. Duplicate paths and unknown extensions are rejected. Legacy root `README.md` files are removed during package normalization; put the complete addon description in `addon-description.md` instead.

ZIP import checks the archive and preserves filenames and text contents. ZIP export keeps source readable; Extensify does not minify or obfuscate addon files.

## `config.json` reference

The configuration describes the addon and its runtime declarations. It is the source of truth for title, version, author, icon, permissions, content scripts, and settings. Keep the full user-facing explanation in `addon-description.md`.

```json
{
  "manifestVersion": 1,
  "id": "example-addon",
  "title": "Example Addon",
  "version": "1.0.0",
  "author": { "name": "Example Creator" },
  "logo": { "type": "icon", "name": "Sparkle", "color": "#3ecf8e" },
  "permissions": ["contentScript", "storage", "settings"],
  "contentScripts": [{
    "matches": ["https://example.com/*"],
    "js": ["content.js"],
    "css": ["content.css"],
    "runAt": "document_idle",
    "allFrames": false
  }],
  "env": {
    "enabled": { "type": "boolean", "label": "Enabled", "default": true },
    "maxItems": { "type": "number", "label": "Maximum items", "default": 10, "min": 1, "max": 100 },
    "selector": { "type": "textarea", "label": "Custom selector", "default": ".item" },
    "internalMode": { "type": "string", "default": "standard", "visibility": false }
  }
}
```

Required fields are `manifestVersion` (currently `1`), a stable lowercase hyphenated `id`, `title`, semantic `version` (`major.minor.patch` with an optional prerelease suffix), `author.name`, `logo`, `permissions`, `contentScripts`, and `env`. An ID identifies an addon across versions; changing a title does not change its ID.

### Logo

Use either an icon and six-digit hexadecimal color, or an SVG file included in the package:

```json
{ "type": "icon", "name": "ph-sparkle", "color": "#8b5cf6" }
```

```json
{ "type": "svg", "path": "assets/icon.svg" }
```

Icon names/classes are passed through to the Phosphor Web stylesheet without a registry check. Use the class/name supported by the imported Phosphor regular weight stylesheet; an unknown name may render as an empty icon. SVG files are checked for scripts and remote embedded content. SVG image data is not treated as executable addon JavaScript.

### Permissions and URL matches

Permissions are declared in the top-level `permissions` array and shown on the addon detail page before installation. Current declarations include `contentScript`, `storage`, `settings`, `tabs`, `activeTab`, `clipboardRead`, and `clipboardWrite`. Declarations document the capabilities the addon expects; they are not a sandbox or a guarantee that malicious code cannot access a page.

Content script `matches` use browser-style patterns such as `https://example.com/*`, `https://*.example.com/*`, or `<all_urls>`. Keep patterns narrow. Supported `runAt` values are `document_start`, `document_end`, and `document_idle`. Every file listed in `js` or `css` must exist in the package. `allFrames` controls whether matching frames are targeted.

### Settings and environment values

Each key in `env` describes a default runtime value and, unless hidden, a generated control on the installed addon’s detail page. Supported field types include boolean, string, textarea, number, slider, select, color, URL, password, and JSON. Fields can define `displayName`, `info`, `placeholder`, `default`, `visibility`, `min`, `max`, `step`, `choices`, `group`, and `order` where appropriate. `displayName` changes the title shown above the control; when omitted, the internal key is shown. `info` adds a small grey explanation below the title. The older `label` and `description` names remain supported as fallbacks. Select settings require choices. Values are validated and saved per addon on this device.

Set `visibility` to `false` to omit a value from the user-facing settings form. This only hides the control: configuration and runtime values delivered to a browser can be inspected. Do not store passwords, API secrets, or other credentials in addon settings.

## Content scripts and runtime API

Extensify runs declared scripts through Chromium’s Manifest V3 `userScripts` API in an isolated user-script world. A content script receives `window.extensify`, a versioned runtime object containing addon metadata, its declared permissions, a settings snapshot, namespaced storage, logging, and lifecycle hooks.

```js
const { addon, settings, storage, log } = window.extensify;

log.info('Starting addon', addon.id, addon.version);
if (settings.enabled) {
  const seen = await storage.get('seen', []);
  await storage.set('seen', seen.concat(location.href));
}
```

Storage methods are scoped to the addon ID. Use the runtime API rather than reaching into Extensify’s storage namespace directly. Declared permissions are available for capability checks and user-facing transparency; the current trusted-creator runtime does not fully sandbox addon JavaScript. `onDispose` hooks allow a script to clean up when the addon is disabled or refreshed.

Page script execution requires the browser’s **Allow User Scripts** permission for Extensify. The Settings page checks this permission and provides a shortcut to the extension details page. Host access prompts and availability can differ by Chromium version.

## Publish and Supabase

Browsing and installing public addons work without signing in. The maintainer configures one Supabase project in the extension’s root `supabase.json` with the Project URL and public anon/publishable key. Never place a service-role key in extension files. End users do not configure Supabase or run migrations.

The maintainer applies `supabase/migrations/202610110001_extensify_schema.sql` in the Supabase SQL editor. Create the creator account in Supabase Auth, then add that user’s UUID to `public.extensify_admins` using the SQL comment at the end of the migration. Row Level Security restricts writes and publishing; public users can read published addon metadata, versions, and files.

Creator sign-in is available from Settings when signed out. Its labeled email/password form uses standard username and current-password autocomplete metadata so Chrome and Edge can recognize credentials and offer password save/autofill when supported. Browser password managers may vary in whether they save credentials for extension pages. When signed in, Settings shows the account identity and sign-out action instead of sign-in fields. In Editor, **Publish** validates and uploads the current package. A published version is immutable; publish a new version number for changes. Explorer retrieves a compact addon listing, with a lightweight version-config lookup for missing/default logo metadata. Full addon files are retrieved when a user opens details or installs/refreshes an addon.

The schema is compact and separates `addons`, `addon_versions`, and `addon_files`, with profiles/admin records for access control. The `addons.logo` field stores listing metadata; migration backfill copies the logo from existing current version configs. If an existing project has the older catalog table shape, the maintainer reruns the migration to add/backfill the column. The extension has a compatibility path for older schemas, but the catalog’s listing icon is most reliable after migration.

## Extensify Settings and local data

Settings controls Extensify itself, separately from addon settings:

- **Appearance:** Light, Dark, or System theme. System follows the operating system preference.
- **Sidebar:** choose collapse-to-icons or hide-completely behavior; Ctrl+B and the sidebar button use this preference.
- **Account:** creator sign-in/sign-out and current account identity.
- **Page scripts:** check User Scripts permission and open browser extension settings.
- **Your data:** export/import the complete versioned local Extensify state as one JSON file.
- **Reset local data:** clear installed addon source/settings, editor drafts, UI preferences, and cached account metadata in this browser.

Local state is namespaced and schema-versioned. Export includes preferences, installed addon packages and settings, saved editor drafts, and account identity metadata; it excludes access and refresh tokens. Import validates and migrates supported older formats before restoring. Treat exports as private because they can contain addon source. Reset removes local data and the saved sign-in session, not published Supabase records.

Extensify does not store the account password. The browser password manager may offer to save it from the sign-in form. To keep the user signed in between browser restarts, Extensify stores Supabase access/refresh tokens separately from exportable state in Chrome’s extension local storage, restricted to trusted extension contexts so page scripts cannot read them. Expiring sessions are refreshed automatically, including a retry after a request receives an authorization failure. Browser extension storage is not a promise of cryptographic secrecy against someone with access to the browser profile or extension developer tools.

## Security and limitations

Addon JavaScript executes on matching pages with access to that page’s DOM. Only install addons from creators you trust, review their source and permissions, and enable them only on sites where you accept their behavior. Validation rejects malformed configs, path traversal, unsupported files, invalid URL patterns, missing entry points, and unsafe SVG constructs, but it does not make arbitrary JavaScript safe.

Anything delivered to a browser can be inspected by a sufficiently capable user. Hidden environment values are not secrets. Extensify uses a public Supabase client credential and relies on Row Level Security; client code must never contain a service-role key.

Extensify targets Chromium Manifest V3 in Chrome and Edge. Firefox is not supported. There is no separate server or build step. Publishing is restricted to the configured trusted creator/admin workflow; payments, public social features, reviews, ratings, and moderation are not part of the current product.
