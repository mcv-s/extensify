import { listPublishedAddons } from '../supabase/catalog.js';
import { renderAddonLogo } from '../components/addon-logo.js';
import { addonSummary } from '../addons/metadata.js';
import { fetchLatestVersion } from '../update/check.js';

const marquee = document.querySelector('#addon-marquee');
const status = document.querySelector('#catalog-status');
const download = document.querySelector('.quickstart-download');

fetchLatestVersion().then(version => {
  if (download) download.innerHTML = `Download Extensify <span class="download-version">(v${escapeHtml(version)})</span><span aria-hidden="true">↓</span>`;
}).catch(() => {});

try {
  const addons = await listPublishedAddons();
  if (!addons.length) {
    status.textContent = 'The catalog is growing';
    marquee.innerHTML = '<p class="catalog-empty">New addons will appear here as creators publish them.</p>';
  } else {
    status.textContent = `${addons.length} ${addons.length === 1 ? 'addon' : 'addons'} and counting`;
    const cards = addons.map(renderCard).join('');
    marquee.innerHTML = `<div class="addon-marquee-track"><div class="addon-marquee-set">${cards}</div><div class="addon-marquee-set" aria-hidden="true">${cards}</div><div class="addon-marquee-set" aria-hidden="true">${cards}</div></div>`;
  }
} catch {
  status.textContent = 'Catalog unavailable';
  marquee.innerHTML = '<p class="catalog-empty">The latest addons will be available when the catalog is connected.</p>';
}

function renderCard(addon) {
  const description = addonSummary({ 'short-description': addon.description }, {});
  return `<article class="addon-card card"><div class="addon-card-top">${renderAddonLogo({ logo: addon.logo }, {}, 40)}<div><h3>${escapeHtml(addon.title)}</h3><p>${escapeHtml(description)}</p></div></div><div class="card-bottom"><span class="muted">By ${escapeHtml(addon.author_name || 'Extensify creator')}</span><span class="badge">Details</span></div></article>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
