import { renderShell } from '../components/shell.js';
import { renderMarkdown } from '../utils/markdown.js';

const inExtension = /^(?:chrome-extension|extension):$/i.test(location.protocol);
if (!inExtension) document.body.classList.add('standalone-document');

const policy = `# Extensify Privacy Policy

***Last updated: October 12, 2026***

Extensify is a browser extension for Chrome and Edge. The extension is designed to keep ordinary browsing and addon data on your device. This policy explains what the extension stores, what happens when you choose optional online features, and what control you have.

## Data stored on your device

Extensify stores its settings, installed addon packages and settings, editor projects and drafts, and interface preferences in the browser's extension storage. The browser profile controls this storage. These records are not sent to Extensify maintainers by the extension as part of normal browsing.

When you choose **Export data**, Extensify creates a file on your device containing your preferences, installed addon source and settings, editor drafts, and account identity metadata. It excludes sign-in access and refresh tokens. Keep the export private because it may contain addon source or other personal configuration. Import and reset actions are performed locally.

## Addons and websites

Addon code runs in your browser and may access page content on the websites you allow, according to its declared site patterns and permissions. Addons are provided by their authors; their behavior and any data they transmit are governed by their own code and policies. Review the author, source, requested permissions, and supported websites before installing or enabling an addon. Extensify does not receive the page content an addon can see unless an addon separately sends it to a service.

## Optional creator account and publishing

Browsing the catalog and installing public addons do not require an account. Creator sign-in and publishing use the Supabase project configured for this Extensify release. If you sign in, your email address and authentication data are processed by Supabase to provide the account session and are subject to their privacy policy as well. Extensify stores session tokens in browser extension storage so it can keep you signed in; tokens are excluded from data exports.

When a creator publishes, the addon package and listing information are uploaded to the configured Supabase project and made available through the public catalog. Published addon content can be downloaded by users. Do not include secrets or personal data in addon packages. Supabase processes data under their applicable terms and privacy practices.

## Network requests

Extensify may contact the configured Supabase project to retrieve public addon listings and packages, check for package updates, authenticate creators, and publish creator projects. Its pages also load the Phosphor icon font stylesheet from jsDelivr. The browser makes normal requests needed to load websites you visit and any services called by addons you choose to run. Extensify does not operate a separate analytics or advertising service in the extension.

## Your choices and retention

You can use catalog browsing and installation without signing in. You can sign out in [settings](/settings.html), uninstall addons, or use **Reset local data** to remove Extensify's local state and saved session from this browser profile. Resetting local data does not delete packages already published to Supabase.

Uninstalling the extension or clearing browser data may remove locally stored Extensify information, subject to browser behavior and any exports you have saved. Extensify maintainers do not have access to data that remains only in your browser profile.

## Children's privacy

Extensify is a general-purpose developer and browser utility, and is not designed for children. The extension does not knowingly collect personal information from children and treats them as any other user.

## Changes and contact

This policy may be updated when Extensify's behavior or services change. The current version is published on [github](https://github.com/mcv-s/extensify). For privacy questions, contact us there.

See also the [Extensify documentation](./docs.html) and [quickstart guide.](https://mcv-s.github.io/extensify/quickstart.html).
`;

const article = document.createElement('article');
article.className = 'docs-article markdown-body';
article.innerHTML = renderMarkdown(policy);
const headings = [...article.querySelectorAll('h2, h3')];
headings.forEach(heading => { heading.id = slugify(heading.textContent); });
const navigation = headings.filter(heading => heading.tagName === 'H2')
  .map(heading => `<a href="#${heading.id}">${escapeHtml(heading.textContent)}</a>`).join('');
const content = `<div class="docs-layout"><nav class="docs-toc" aria-label="Policy sections"><span>PRIVACY</span>${navigation}</nav>${article.outerHTML}</div>`;

if (inExtension) {
  await renderShell({ active:'privacy', title:'Privacy Policy', content });
  document.querySelector('.page-content').classList.add('docs-page');
} else {
  document.title = 'Privacy Policy - Extensify';
  document.querySelector('#app').innerHTML = `<main class="standalone-doc-wrap"><a class="standalone-brand" href="./quickstart.html"><img src="./logo.svg" alt=""> extensify</a><header class="standalone-heading"><span>YOUR DATA, YOUR CHOICE</span><h1>Privacy policy</h1><p>How Extensify handles information in the extension and its optional online services.</p><nav><a href="./quickstart.html">Quickstart</a><a href="./docs.html">Documentation</a></nav></header>${content}</main>`;
  document.querySelector('.docs-article').classList.add('standalone-article');
}

function slugify(value) { return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
