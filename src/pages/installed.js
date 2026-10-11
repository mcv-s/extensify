import { renderShell, icon } from '../components/shell.js';
import { getInstalledAddons } from '../storage/state.js';
import { renderAddonLogo } from '../components/addon-logo.js';
import { addonSummary } from '../addons/metadata.js';

const addons = await getInstalledAddons();
const content = addons.length
  ? `<div class="addon-grid">${addons.map(addon => `<a class="addon-card card" href="addon.html?id=${encodeURIComponent(addon.id)}"><div class="addon-card-top">${renderAddonLogo(addon.config,addon.files,40)}<div><h3>${escapeHtml(addon.config.title)}</h3><p>${escapeHtml(addonSummary(addon.config,addon.files))}</p></div></div><div class="card-bottom"><span class="badge ${addon.enabled?'green':''}">${addon.enabled?'Enabled':'Disabled'}</span><span class="muted mono">v${escapeHtml(addon.version)}</span></div></a>`).join('')}</div>`
  : `<div class="empty-state"><div class="empty-icon">${icon('puzzle-piece',20)}</div><h3>No addons installed</h3><p>Browse the catalog or load an addon ZIP to start your toolkit.</p><a class="button primary" href="explorer.html">Browse Explorer</a> <a class="button" href="editor.html">Open editor</a></div>`;

await renderShell({ active: 'installed', title: 'Installed addons', subtitle: `${addons.length} addon${addons.length === 1 ? '' : 's'} on this device.`, content });

function escapeHtml(text = '') {
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
