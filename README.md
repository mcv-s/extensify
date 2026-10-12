# Extensify

Extensify is a local-first Chromium Manifest V3 extension for Chrome and Edge. It provides a browser workspace for discovering, installing, and managing small addons, plus tools for creating and publishing your own.

**New here?** Start with the [Extensify quickstart](https://mcv-s.github.io/extensify/quickstart.html) or [download the latest ZIP](https://github.com/mcv-s/extensify/archive/refs/heads/main.zip).

## Install for Chrome or Edge

1. Download and unzip the ZIP linked above.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the extracted `extensify-main` folder containing `manifest.json`.
5. Pin Extensify from the browser’s extensions menu for quick access.

Extensify does not require a build step. To update it, download and extract the latest ZIP, load the new folder, then remove the old copy from the extensions page when you are ready. If you are developing from a local checkout, use **Reload** after changing extension files.

## What you can do

- Browse the public addon catalog and install addons without signing in.
- Review addon descriptions, requested permissions, and supported sites before installing.
- Create, edit, validate, import, export, and locally install addon packages in Editor.
- Sign in with a creator account to manage drafts and publish addons to the shared catalog.
- Configure the extension’s theme, sidebar, and local data in Settings.

Newly installed addons start disabled. To run addon page scripts, enable **Allow User Scripts** for Extensify in the browser’s extension details, then enable the addon. Chromium may ask for access to an addon’s declared websites.

## Guides and privacy

- [Quickstart and download](https://mcv-s.github.io/extensify/quickstart.html)
- [Documentation](https://mcv-s.github.io/extensify/docs.html)
- [Privacy policy](https://mcv-s.github.io/extensify/privacy.html)

The web documentation and privacy pages are available without installing Extensify. The interactive workspace requires the extension and redirects ordinary web visits to quickstart.

## Development and maintainer setup

This repository is itself the unpacked extension directory. Load the repository root (the folder containing `manifest.json`) to work from a local checkout. The extension uses the maintainer-configured Supabase project in root `supabase.json`; end users do not configure Supabase. Never place a service-role key in extension files. A custom Supabase domain must be added to `host_permissions` in `manifest.json`.

One-time maintainer setup: apply `supabase/migrations/202610110001_extensify_schema.sql` in the Supabase SQL editor, create the creator account in Supabase Auth, then run the migration’s final `extensify_admins` insert with that Auth user UUID. Keep Row Level Security enabled. Rerun the migration after extension updates that require schema changes; it is safe to run again.

For addon package conventions, runtime APIs, permissions, settings, publishing, storage, and Supabase details, see the [complete guide](docs.md). Keep `docs.md` current when product behavior changes. `AGENTS.md` contains the contributor documentation rule.

## Checks

Run the included logic checks with Node.js 20 or newer:

```sh
node --test
```
