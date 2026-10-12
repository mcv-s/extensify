import { renderShell, icon, toast } from '../components/shell.js';
import { renderMarkdown } from '../utils/markdown.js';

const inExtension = /^(?:chrome-extension|extension):$/i.test(location.protocol);
if (!inExtension) document.body.classList.add('standalone-document');

try {
  const docsUrl = globalThis.chrome?.runtime?.getURL
    ? chrome.runtime.getURL('docs.md')
    : new URL('../../docs.md', import.meta.url);
  const response = await fetch(docsUrl);
  if (!response.ok) throw new Error(`Could not load docs.md (${response.status}).`);
  const markdown = await response.text();
  const rendered = renderMarkdown(markdown, { headingOffset:0 });
  const template = document.createElement('template');
  template.innerHTML = rendered;
  const headings = [...template.content.querySelectorAll('h2, h3')];
  headings.forEach((heading, index) => {
    heading.id = slugify(heading.textContent) || `section-${index + 1}`;
  });
  const navigation = headings.filter(heading => heading.tagName === 'H2')
    .map(heading => `<a href="#${heading.id}">${escapeHtml(heading.textContent)}</a>`).join('');
  template.content.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.className = 'docs-copy-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Copy code');
    button.innerHTML = `${icon('copy',14)}<span>Copy</span>`;
    pre.append(button);
  });
  const documentContent = `
    <div class="docs-layout">
      <nav class="docs-toc" aria-label="Documentation sections"><span>ON THIS PAGE</span>${navigation}</nav>
      <article class="docs-article markdown-body">${template.innerHTML}</article>
    </div>`;
  if (inExtension) {
    await renderShell({ active:'docs', title:'Documentation', content:documentContent });
    document.querySelector('.page-content').classList.add('docs-page');
  } else {
    document.title = 'Documentation - Extensify';
    document.querySelector('#app').innerHTML = `<main class="standalone-doc-wrap"><a class="standalone-brand" href="./quickstart.html"><img src="./logo.svg" alt=""> extensify</a><header class="standalone-heading"><span>EXTENSIFY GUIDE</span><h1>Documentation</h1><p>Browse the guide to installing Extensify, using addons, and building your own.</p><nav><a href="./quickstart.html">Quickstart</a><a href="./privacy.html">Privacy policy</a></nav></header>${documentContent}</main>`;
    document.querySelector('.docs-article').classList.add('standalone-article');
  }
  document.querySelectorAll('.docs-copy-button').forEach(button => button.addEventListener('click', async () => {
    const code = button.closest('pre')?.querySelector('code')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(code);
      button.querySelector('span').textContent = 'Copied';
      setTimeout(() => { if (button.isConnected) button.querySelector('span').textContent = 'Copy'; }, 1400);
    } catch { toast('Could not copy this code block. Check clipboard permission.', 'error'); }
  }));
} catch (error) {
  await renderShell({ active:'docs', title:'Documentation', content:`<div class="empty-state"><div class="empty-icon">${icon('warning',20)}</div><h3>Could not load documentation</h3><p>${escapeHtml(error.message)}</p></div>` });
}

function slugify(value) { return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
