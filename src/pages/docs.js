import { renderShell } from '../components/shell.js';

await renderShell({ active:'docs', title:'Documentation', subtitle:'A practical guide to Extensify and addon packages.', content:`
<div class="docs-layout">
  <nav class="docs-toc card"><span>ON THIS PAGE</span><a href="#overview">Overview</a><a href="#install">Install and manage</a><a href="#package">Create a package</a><a href="#config">config.json</a><a href="#runtime">Runtime API</a><a href="#data">Data and ZIPs</a><a href="#security">Security</a></nav>
  <article class="docs-article card">
    <section id="overview"><p class="eyebrow">EXTENSIFY GUIDE</p><h2>Small additions to the web.</h2><p>Extensify is one Chromium Manifest V3 extension for Chrome and Edge. It loads page-behavior addons that you choose. Addons are stored in this browser after installation. An account is optional for browsing and installing; creator sign-in is used to publish to the shared Supabase catalog.</p><p>Extensify provides the platform documentation. Addons do not have separate documentation pages: each addon uses an <code>addon-description.md</code> file for its full description.</p></section>
    <section id="install"><h2>Install and manage addons</h2><ol><li>Open <a href="explorer.html">Explorer</a>, search the catalog, and open an addon detail page.</li><li>Review the description, requested permissions, and supported site patterns.</li><li>Choose Install. New addons start disabled; enable one after reviewing its access.</li><li>Edit visible settings on the addon detail page. Hidden fields are omitted from the form.</li><li>Refresh gets the latest published files and keeps settings for keys that still exist. Uninstall removes code and settings; reinstalling starts fresh.</li></ol><p>The popup provides quick enable and disable controls for installed addons.</p></section>
    <section id="package"><h2>Create an addon package</h2><p>Open <a href="editor.html">Editor</a> and create a project, choose an existing project, or load a ZIP. Files are edited as readable text. Right-click a file to copy its path, rename it, or delete it. Save Draft stores the project in this browser, Save ZIP exports it, and Load ZIP imports a package. Install locally validates and installs the current files, then opens that addon’s detail page. Only editor projects and saved creator drafts are editable. Installing an addon does not add it to the Editor. Signed-in creator accounts can publish validated packages to Explorer.</p><h3>Directory layout</h3><pre><code>my-addon/
  config.json
  addon-description.md
  content.js
  content.css
  assets/
    icon.svg</code></pre><p>Supported files are HTML, CSS, JavaScript, JSON, Markdown, plain text, and SVG. SVG is the only stored image format. Keep paths relative and do not use <code>..</code> path segments. Files are limited to 2 MB each.</p><h3>Addon logo</h3><p>Set <code>logo</code> to either any Phosphor icon name/class and six-digit hex color, or a path to an SVG file included in the package. For example: <code>{"type":"icon","name":"Sparkle","color":"#3ecf8e"}</code> or <code>{"type":"svg","path":"assets/icon.svg"}</code>. Icon names are passed through without checking a registry; unavailable names may simply render without an icon.</p></section>
    <section id="config"><h2>config.json</h2><p>Configuration is kept in the root JSON file. Addon metadata belongs here; the full description belongs in <code>addon-description.md</code>.</p><pre><code>{
  "manifestVersion": 1,
  "id": "example-addon",
  "title": "Example Addon",
  "version": "1.0.0",
  "author": { "name": "Author Name" },
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
}</code></pre><h3>Permissions and URL patterns</h3><p>Top-level permissions are displayed before installation and made available to the runtime. Supported declarations include <code>contentScript</code>, <code>storage</code>, <code>settings</code>, <code>tabs</code>, <code>activeTab</code>, <code>clipboardRead</code>, and <code>clipboardWrite</code>. Match patterns include <code>https://example.com/*</code>, <code>https://*.example.com/*</code>, and <code>&lt;all_urls&gt;</code>. Prefer narrow host patterns. Each declared JS/CSS entry point must exist in the package.</p><h3>Generated settings</h3><p>Environment fields support boolean, string, textarea, number, slider, select, color, URL, password, and JSON types. Fields are visible by default; use <code>visibility: false</code> to omit a field from the user-facing form. Select fields use a <code>choices</code> array. Optional label, description, placeholder, validation bounds, group, and order values help shape the form. Browser-delivered values are inspectable, including hidden fields; they are not secrets.</p></section>
    <section id="runtime"><h2>Runtime API</h2><p>Declared page scripts run through Chromium’s <code>userScripts</code> API in its isolated User Script world and receive the versioned <code>window.extensify</code> object. It exposes the addon ID and version, permission list, settings snapshot, namespaced storage, logging, and an <code>onDispose</code> callback.</p><pre><code>const { settings, storage, log } = window.extensify;
log.info('Addon started', { limit: settings.maxItems });
const seen = await storage.get('seen', []);
await storage.set('seen', seen.concat(location.href));</code></pre><p>The browser’s Allow User Scripts setting must be enabled. A permission declaration is a visible capability contract, not a secret or an independent security boundary.</p></section>
    <section id="data"><h2>Local data, import, and export</h2><p>Extensify stores theme, installed addon code/config/settings, editor drafts, and local auth metadata in versioned browser storage. Settings → Your data exports all user-level data in one versioned JSON file. Import validates the file and upgrades supported older formats. Reset local data clears the Extensify storage namespace.</p><p>ZIP import/export preserves relative paths and readable source. Supabase stores addon summaries separately from version records and source files. Explorer fetches only summary fields; full files are fetched when an addon is opened or installed. The maintainer configures the shared Supabase project once before release. Extension users do not need to configure Supabase or run SQL.</p></section>
    <section id="security"><h2>Security limitations</h2><p>Addon code is executable JavaScript. The initial catalog assumes a trusted creator, so review source, declared permissions, and site matches before enabling an addon. Extensify validates configuration, paths, extensions, sizes, URL patterns, and SVG files, but those checks do not sandbox hostile JavaScript.</p><p>Anything delivered to a browser can be inspected by a sufficiently capable user. Do not put passwords, service-role keys, or privileged credentials in addon code or environment values. Extensify itself uses only Supabase’s public anon/publishable key; Row Level Security controls access to creator and catalog records.</p></section>
  </article>
</div>` });


