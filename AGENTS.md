# Contributor instructions

## Keep the product documentation current

`docs.md` in the workspace root is the canonical user and addon-author guide. The Docs page (`src/pages/docs.js`) loads and renders that Markdown file with the local `src/utils/markdown.js` renderer; do not duplicate documentation prose in page JavaScript or replace it with a separate hard-coded HTML guide.

Whenever a product, addon format, runtime API, permission, setting, publishing flow, storage behavior, Supabase schema, browser requirement, or user workflow changes, check `docs.md` and update it in the same change if any instructions or claims become inaccurate. Add new user-facing features and limitations to the guide. Keep examples valid against current validation and runtime behavior.

The extension uses Manifest V3 and Chromium extension-page Content Security Policy. Keep scripts and the Markdown renderer local; do not load executable JavaScript from a CDN. The Docs layout and code-copy behavior live in `src/pages/docs.js` and `src/styles/docs.css`.
