Extensify is one Chromium Manifest V3 extension for Chrome and Edge. It provides a local home for small, trusted addons that enhance web pages. The same extension contains the popup, Explorer, addon details, Installed, Editor, Settings, and this guide. It does not require a separate application server.

Browsing and installing addons does not require an account. Creator sign-in uses the maintainer-configured Supabase project and is only needed for publishing and managing creator projects.

## Overview

Extensify works without a user account or a build step. Browsing and installing addons is available to everyone; a creator signs in only when managing or publishing creator projects.

## Install and open Extensify

1. [Download the Extensify ZIP](https://github.com/mcv-s/extensify/archive/refs/heads/main.zip) and unzip it.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on Developer mode.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. Pin Extensify from the browser’s extensions menu to open its popup quickly.

The [quickstart page](quickstart.html) has the download button, a live showcase of published addons, and a visual walk-through of these steps. It follows the browser's light or dark appearance preference. The showcase is read-only and may be empty when the public catalog is unavailable. The public [documentation](https://mcv-s.github.io/extensify/docs.html) and [privacy policy](https://mcv-s.github.io/extensify/privacy.html) pages work outside the extension; the interactive workspace requires the extension's browser storage and APIs and redirects web visitors to quickstart.

After extension source or manifest changes, return to the extensions page and click **Reload** on Extensify. The popup opens a new full-page Extensify tab. The sidebar links to Home, Explorer, Installed, Editor, Settings, and Documentation. The top bar shows the current section and, on detail pages, the selected addon; click the section name to return to its landing page. The sidebar checks the GitHub `HEAD` manifest for a newer version when a workspace page opens and shows a quiet update banner when one is available; network failures do not interrupt the page. The sidebar button or Ctrl+B toggles it; Settings chooses whether it collapses to icons or hides completely. The top-bar theme button cycles through Light, Dark, and System, and its icon shows the selected mode.

### Minimal standalone extension

The repository also includes `grayscale-extension/`, a complete two-file Chromium Manifest V3 extension that applies `filter: grayscale(1)` to every supported webpage. To try it, open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder. Browser-internal pages such as `chrome://extensions` cannot be modified by extensions.

The toolbar popup shows installed addons and lets you enable or disable each one. Its refresh button fetches the latest catalog versions and refreshes local addons from their saved Editor drafts. Addons with visible settings have a caret to expand those controls in place. Boolean settings use compact same-row switches; other controls remain stacked, and setting explanations appear when you hover their display names. It also links to the full interface and Settings.

## Browse and install addons

Explorer searches only the published server catalog by addon title; locally installed addons that are not published are listed on Installed instead. Each compact listing shows its icon, title, a short description, author, and install/enabled state. Catalog information shows the published addon count and total UTF-8 file-content size of current published packages. This size excludes database overhead and older versions. Open a listing for its full `addon-description.md`, requested permissions, supported site patterns, version, and available changelog.

Review the declared permissions and sites before installation. Install stores the validated package in this browser and initializes its visible setting values from defaults. A newly installed addon starts disabled. To run its page scripts, enable **Allow User Scripts** for Extensify in the browser’s extension details, then enable the addon. The Home page shows an amber notice with an **Open extension settings** button when the permission is off. If you enable it while Home is open, returning to that tab shows a brief green confirmation; when the permission is already on at page load, no banner is shown. Userscripts are browser-specific code included in addon packages, not in Extensify itself; they run inside a compatible browser only on matching websites and are not shared across browsers. Chromium may also ask for access to the addon’s declared websites.

Installed lists packages stored on this device. Addons installed from a local package or Editor project carry a **Local** indicator. Installed does not mean editable: only an Editor project or saved creator draft appears in Editor. Installing a public addon never grants permission to edit or publish its source. Addon settings remain available from its detail page.

Enable and disable changes whether Extensify registers and executes that addon. Refresh indicates progress while retrieving the latest published package and updates the installed addon without reloading the current page. Values for setting keys that still exist are kept, new keys use their defaults, and removed keys are discarded. After 2 seconds, the button stops waiting without a timeout error; refresh may still complete in the background. Uninstall removes the addon’s source, configuration, settings, registration, and addon-scoped local data. Installing again starts with defaults.

## Create and edit a project

Open Editor to create a new addon project, choose an existing saved project, or load a ZIP or source folder. Each project has its own stable addon ID. Editor projects and saved creator drafts are editable; an installed consumer copy by itself is not. Right-click a file in the file tree to copy its path, rename it, or delete it. `config.json` and `addon-description.md` are required and cannot be renamed or deleted.

Editor opens supported source files in Monaco with VS Code Dark+/Light+ themes and language services for JavaScript, TypeScript, JSON, CSS, HTML, and Markdown. Monaco provides language-aware completions, parameter hints, hover documentation, and code folding; suggestions are based on the language and local source, not AI. Settings lets you switch to the classic editor, choose icon-only or labeled toolbar actions, and decide whether successful publishing opens the addon page. Multiple files can be opened in tabs, and Editor remembers the selected file separately for each addon. **Save draft** saves on this device. **Save ZIP** exports the package. **Load ZIP** imports a package; **Load folder** imports supported files from a selected source folder. **Validate** checks config, paths, file types, logo, permissions, settings, and declared entry points. Unpublished projects have an **Install locally** action; published projects instead have an **Extension page** action that opens their addon detail page.

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

## config.json file

The configuration describes the addon and its runtime declarations. It is the source of truth for title, optional `short-description`, version, author, icon, permissions, an optional background script, content scripts, and settings. Keep the full user-facing explanation in `addon-description.md`. When present, `short-description` is used for compact Explorer listings; addons without it use the beginning of `addon-description.md` instead.

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
    "internalMode": { "type": "string", "default": "standard", "visibility": false },
    "sideBarKeybind": {
      "type": "string",
      "default": "Ctrl+B",
      "displayName": "Keybind to open sidebar:",
      "info": "The keyboard shortcut used to toggle the sidebar."
    }
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

Permissions are declared in the top-level `permissions` array and shown on the addon detail page before installation. Current declarations include `contentScript`, `background`, `storage`, `settings`, `tabs`, `alarms`, `activeTab`, `clipboardRead`, `clipboardWrite`, and `contextMenus`. Declarations document the capabilities the addon expects; they are not a sandbox or a guarantee that malicious code cannot access a page.

Use the optional `background` field to name one JavaScript entry file that runs once for the addon at browser level, rather than once in every matching tab. Add the `background` permission when using this field. Add `tabs` to receive tab events or use the background `tabs` API, and `alarms` to schedule alarms. These declarations are checked by Extensify's background API broker.

```json
{
  "permissions": ["background", "storage", "tabs", "alarms"],
  "background": "background.js"
}
```

The background entry must be a `.js` file included in the addon package. It runs in its own sandboxed frame inside one hidden Extensify offscreen document. It has no direct `chrome.*` extension APIs; use the `extensify` API below. The frame is separate from site pages and is not created per tab.



### Pinnability

You can add  ` "pinnable": false,` to the config.json to make it so that the addon cannot be in the popup. 

Users won't be able to pin the addon to the popup :D



### Context menu actions

Declare `contextMenus` and add actions with unique IDs, titles, and packaged JavaScript files. Optional `matches` limits where an action appears and can run; when omitted, it applies to all supported websites and enabling the addon requests broad site access. Clicking an action runs its file in the page's isolated user-script world.

```json
{
  "permissions": ["contextMenus"],
  "contextMenus": [{
    "id": "copy-selection",
    "title": "Copy selected text",
    "js": "copy-selection.js",
    "matches": ["https://example.com/*"]
  }]
}
```

Chrome and Edge do not support custom icons on context menu items, so addon logos and Phosphor icons cannot be shown in these native menu rows.

Content script `matches` use browser-style patterns such as `https://example.com/*`, `https://*.example.com/*`, or `<all_urls>`. Keep patterns narrow. Supported `runAt` values are `document_start`, `document_end`, and `document_idle`. Every file listed in `js` or `css` must exist in the package. `allFrames` controls whether matching frames are targeted.






### Settings and environment values

Each key in `env` describes a default runtime value and, unless hidden, a generated control on the installed addon’s detail page. Supported field types include boolean, string, textarea, number, slider, select, color, URL, password, and JSON. Fields can define `displayName`, `info`, `placeholder`, `default`, `visibility`, `min`, `max`, `step`, `choices`, `group`, and `order` where appropriate. `displayName` changes the title shown above the control; when omitted, the internal key is shown. `info` adds a small grey explanation below the title. The older `label` and `description` names remain supported as fallbacks. Select settings require choices. Values are validated and saved per addon on this device.

Set `visibility` to `false` to omit a value from the user-facing settings form. This only hides the control: configuration and runtime values delivered to a browser can be inspected. Do not store passwords, API secrets, or other credentials in addon settings.

















## Methods

After using 

```js
const { addon, settings, storage, log } = window.extensify;

```

at the top of your script, you'll probably want to use some methods to actually DO stuff.



### Settings values

Use `settings.value` to get the value for the corresponding key.

```js
if key_clicked(settings.keybind) { // example with pseudocode
  // do something
}
```




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

Storage methods are scoped to the addon ID. Use the runtime API rather than reaching into Extensify’s storage namespace directly. Declared permissions are available for capability checks and user-facing transparency; the current trusted-creator runtime does not fully sandbox addon JavaScript. `onDispose` hooks allow a script to clean up when the addon is disabled or refreshed. Extensify also tracks standard DOM event listeners, intervals, timeouts, and animation frames created by an addon instance so they can be stopped when that instance is refreshed or replaced.

Addon files are available to runtime code by package path. For example, `fetch('/123.css')` or `fetch('assets/data.json')` reads that file from the installed addon when it exists. These package-local GET and HEAD requests return a normal `Response` with a useful content type. A stylesheet link such as `<link rel="stylesheet" href="/123.css">` is also resolved from the package and applied as an injected style, rather than requesting that path from the current website. Other URLs continue through the browser's native `fetch`, with the page's usual CORS and permission rules. In declared CSS files, local `@import` references are inlined and local `url(...)` assets are embedded, so they do not resolve against the website's origin.

Page script execution requires the browser’s **Allow User Scripts** permission for Extensify. The Settings page checks this permission and provides a shortcut to the extension details page. Host access prompts and availability can differ by Chromium version.








### Background scripts

An addon with `"background": "background.js"` and the `background` permission gets one browser-level background instance while enabled. It starts when Extensify starts the background host; it does not start again for each website or tab. The script runs in a sandboxed frame without direct extension APIs. Its supported API is:

```js
const { addon, settings, storage, tabs, alarms, log } = extensify;

extensify.on('start', () => log.info('Background started', addon.id));
extensify.on('browserStartup', () => log.info('Browser started'));
extensify.on('tabCreated', tab => log.info('New tab', tab.id));
extensify.on('tabUpdated', ({ tabId, changeInfo, tab }) => {
  if (changeInfo.status === 'complete') log.info('Loaded', tab.url);
});

const activeTabs = await tabs.query({ active: true, currentWindow: true });
await storage.set('lastActiveTab', activeTabs[0]?.id ?? null);
await alarms.create('refresh', { periodInMinutes: 5 });
extensify.on('alarm', alarm => log.info('Alarm', alarm.name));
```

Supported events are `start`, `browserStartup`, `extensionInstalled`, `tabCreated`, `tabUpdated`, `tabRemoved`, and `alarm`. Register handlers with `extensify.on(name, callback)`; it returns an unsubscribe function. `storage.get`, `storage.set`, and `storage.remove` use the same addon-scoped 1 MB storage as page scripts. `tabs` supports `query`, `update`, and `create`; `alarms` supports `create` and `clear`, with alarm names scoped to the addon. These APIs require the matching `storage`, `tabs`, or `alarms` permission.

This is a background execution context, not a promise of an immortal thread. Chromium may suspend or discard background contexts, and the browser or operating system may shut down. Extensify restores enabled scripts when its background host starts again; global variables and timers are lost when that happens, so persist important state with `storage`. Alarm events are suitable for periodic work, but can be delayed by the browser. Do not rely on a tight interval or continuous loop for guaranteed execution.








## Publish and Supabase

Browsing and installing public addons work without signing in. The maintainer configures one Supabase project in the extension’s root `supabase.json` with the Project URL and public anon/publishable key. Never place a service-role key in extension files. End users do not configure Supabase or run migrations.

The maintainer applies `supabase/migrations/202610110001_extensify_schema.sql` in the Supabase SQL editor. Create the creator account in Supabase Auth, then add that user’s UUID to `public.extensify_admins` using the SQL comment at the end of the migration. Apply later migrations too, including `202611090001_prune_superseded_addon_versions.sql`, to enable owner-only cleanup of superseded published packages. Row Level Security restricts writes and publishing; public users can read published addon metadata, versions, and files.

Creator sign-in is available from Settings when signed out. Its labeled email/password form uses standard username and current-password autocomplete metadata so Chrome and Edge can recognize credentials and offer password save/autofill when supported. Browser password managers may vary in whether they save credentials for extension pages. When signed in, Settings shows the account identity and sign-out action instead of sign-in fields. In Editor, **Publish** validates and uploads the current package, showing a spinning progress icon during upload. After upload confirmation, an already-installed copy is updated immediately and its runtime sync begins; Editor then transitions to the add-on details page. A published version is immutable; publish a new version number for changes. After publish, Extensify attempts to remove superseded published versions owned by the signed-in creator. Settings also has a confirmed cleanup action for existing history; it retains each addon’s current published version and active draft, and only removes that creator’s older published versions and their files. Its byte report counts file contents, not exact physical database storage. Explorer retrieves a compact addon listing, with a lightweight version-config lookup for missing/default logo metadata. Full addon files are retrieved when a user opens details or installs/refreshes an addon.

The schema is compact and separates `addons`, `addon_versions`, and `addon_files`, with profiles/admin records for access control. The `addons.logo` field stores listing metadata; migration backfill copies the logo from existing current version configs. If an existing project has the older catalog table shape, the maintainer reruns the migration to add/backfill the column. The extension has a compatibility path for older schemas, but the catalog’s listing icon is most reliable after migration.









## Extensify Settings and Data

Settings controls Extensify itself, separately from addon settings:

- **Appearance:** Light, Dark, or System theme. System follows the operating system preference.
- **Sidebar:** choose collapse-to-icons or hide-completely behavior; Ctrl+B and the sidebar button use this preference.
- **Account:** creator sign-in/sign-out and current account identity.
- **Page scripts:** check User Scripts permission and open browser extension settings.
- **Backup & restore:** export/import all local Extensify data as one versioned JSON file, including installed addon source, settings and addon storage, editor drafts, preferences, and the saved sign-in session.
- **Reset Cloud Cache:** while signed in, remove superseded published versions and their files from Supabase. The current published versions and active drafts are kept, and cleanup is limited to addons owned by the signed-in account.
- **Reset local data:** clear installed addon source/settings, editor drafts, UI preferences, and cached account metadata in this browser.

Local state is namespaced and schema-versioned. Backup includes preferences, installed addon packages, addon settings and namespaced runtime storage, saved editor drafts, account identity metadata, and the separately stored sign-in session. Import validates and migrates supported older formats before restoring; older exports without a session restore signed-out. Backup files contain access and refresh tokens as well as addon source and storage, so keep them private and delete them securely when no longer needed. Reset removes local data and the saved sign-in session, not published Supabase records.

Extensify does not store the account password. The browser password manager may offer to save it from the sign-in form. To keep the user signed in between browser restarts, Extensify stores Supabase access/refresh tokens separately from exportable state in Chrome’s extension local storage, restricted to trusted extension contexts so page scripts cannot read them. Expiring sessions are refreshed automatically, including a retry after a request receives an authorization failure. Browser extension storage is not a promise of cryptographic secrecy against someone with access to the browser profile or extension developer tools.

## Security and limitations

Addon JavaScript executes on matching pages with access to that page’s DOM. Only install addons from creators you trust, review their source and permissions, and enable them only on sites where you accept their behavior. Validation rejects malformed configs, path traversal, unsupported files, invalid URL patterns, missing entry points, and unsafe SVG constructs, but it does not make arbitrary JavaScript safe.

Anything delivered to a browser can be inspected by a sufficiently capable user. Hidden environment values are not secrets. Extensify uses a public Supabase client credential and relies on Row Level Security; client code must never contain a service-role key.

Extensify targets Chromium Manifest V3 in Chrome and Edge. Firefox is not supported. There is no separate server or build step. Publishing is restricted to the configured trusted creator/admin workflow; payments, public social features, reviews, ratings, and moderation are not part of the current product.
