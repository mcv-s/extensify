import { renderShell, icon, toast } from '../components/shell.js';
import { renderAddonLogo } from '../components/addon-logo.js';
import { getState } from '../storage/state.js';
import { installAddon, refreshAddon, setAddonEnabled, uninstallAddon } from '../addons/install.js';
import { addonDescription } from '../addons/metadata.js';
import { fetchAddonPackage } from '../supabase/catalog.js';
import { renderMarkdown } from '../utils/markdown.js';
import { renderSettingsForm } from '../components/settings-form.js';

const permissionText = {
  contentScript: 'Runs the declared scripts on matching sites.', storage: 'Stores addon-specific data on this device.',
  settings: 'Defines visible user-configurable settings.', tabs: 'May request tab information through the runtime.',
  activeTab: 'Can interact with the current tab when granted.', clipboardRead: 'Can read clipboard data when used.',
  clipboardWrite: 'Can write clipboard data when used.'
};
const id = new URLSearchParams(location.search).get('id');

await renderShell({ active: 'explorer', title: 'Addon details', subtitle: 'Review capabilities and manage this addon.', content: '<div class="loading">Loading addon…</div>' });
if (!id) showError('Choose an addon to view its details.');
else await load();

async function load() {
  try {
    const state = await getState();
    let addon = state.addons[id] ?? null;
    let remote = null;
    if (!addon) {
      remote = await fetchAddonPackage(id);
      addon = { id, config: remote.config, files: remote.files, version: remote.version.version, enabled: false, settings: {} };
    } else if (addon.source !== 'local') {
      try { remote = await fetchAddonPackage(id); } catch { /* Keep installed addon details available offline. */ }
    }
    render(addon, remote, state.editorDrafts[id] ?? null);
  } catch (error) { showError(error.message); }
}

function render(addon, remote, localDraft) {
  const config = addon.config;
  const latestVersion = remote?.version.version;
  const hasUpdate = latestVersion && latestVersion !== addon.version;
  const supportedSites = (config.contentScripts ?? []).flatMap(entry => entry.matches ?? []);
  const permissions = (config.permissions ?? []).map(permission => `<div class="permission-item">${icon('shield-check', 15)}<span><b>${escapeHtml(permission)}</b><small>${escapeHtml(permissionText[permission] ?? 'Declared capability available to this addon.')}</small></span></div>`).join('');
  const refreshText = addon.source === 'local' ? 'Refresh local copy' : 'Refresh addon';
  const markdownDescription = renderMarkdown(addonDescription(config, addon.files));

  document.querySelector('.page-content').innerHTML = `
    <div class="back-link"><a href="explorer.html">${icon('arrow-left', 14)} Back to Explorer</a></div>
    <div class="detail-layout">
      <article class="card detail-main">
        <div class="detail-title">${renderAddonLogo(config, addon.files, 54)}<div><h2>${escapeHtml(config.title)}</h2><p class="muted">By ${escapeHtml(config.author?.name || 'Unknown creator')} · v${escapeHtml(config.version)}</p></div></div>
        <div class="detail-description markdown-body">${markdownDescription || '<p class="muted">No description provided.</p>'}</div>
        <hr class="divider"><h3 class="section-title">Permissions</h3><p class="muted small-copy">This addon declares the following capabilities.</p>
        <div class="permission-list">${permissions || '<p class="muted">No permissions declared.</p>'}</div>
        <div class="section-heading"><h3 class="section-title">Supported sites</h3></div>
        <div class="pattern-list">${supportedSites.map(pattern => `<code>${escapeHtml(pattern)}</code>`).join('') || '<span class="muted">No content scripts declared.</span>'}</div>
        ${remote?.version.changelog ? `<hr class="divider"><h3 class="section-title">Latest changelog</h3><div class="markdown-body">${renderMarkdown(remote.version.changelog)}</div>` : ''}
      </article>
      <aside class="card detail-side">
        <div class="side-label">${addon.installedAt ? 'INSTALLED' : 'ADDON'}</div>
        <div class="side-info"><span>Version</span><b>${escapeHtml(addon.version)}</b></div>
        ${addon.installedAt ? `<div class="side-info"><span>Installed</span><b>${new Date(addon.installedAt).toLocaleDateString()}</b></div>` : ''}
        ${addon.updatedAt ? `<div class="side-info"><span>Refreshed</span><b>${new Date(addon.updatedAt).toLocaleDateString()}</b></div>` : ''}
        ${hasUpdate ? `<div class="callout update-callout">A newer version (${escapeHtml(latestVersion)}) is available. Your settings are preserved when refreshed.</div>` : ''}
        <div id="addon-actions">
          ${addon.installedAt ? `<label class="enable-control"><span>${addon.enabled ? 'Enabled' : 'Disabled'}</span><input id="enable-addon" type="checkbox" ${addon.enabled ? 'checked' : ''}><span class="toggle"></span></label><button class="button ${hasUpdate ? 'primary' : ''}" id="refresh-addon">${icon('arrow-clockwise', 15)} ${refreshText}</button>${localDraft ? `<a class="button" href="editor.html?id=${encodeURIComponent(id)}">${icon('code', 15)} Edit files</a>` : ''}<button class="button danger" id="remove-addon">${icon('trash', 15)} Uninstall</button>` : `<button class="button primary" id="install-addon">${icon('plus', 15)} Install addon</button>`}
        </div>
      </aside>
    </div>
    ${addon.installedAt && Object.keys(config.env ?? {}).length ? `<section class="settings-section"><div class="section-heading"><div><h3 class="section-title">Addon settings</h3><p class="muted small-copy">Changes are stored locally for this addon.</p></div><span class="badge">${Object.values(config.env).filter(setting => setting.visibility !== false).length} fields</span></div><div class="card settings-panel" id="settings-form"></div></section>` : ''}`;

  if (addon.installedAt) renderSettingsForm(addon, document.querySelector('#settings-form'));
  document.querySelector('#enable-addon')?.addEventListener('change', async event => {
    const input = event.target;
    try { await setAddonEnabled(id, input.checked, config); toast(`Addon ${input.checked ? 'enabled' : 'disabled'}.`); await load(); }
    catch (error) { input.checked = false; toast(error.message, 'error'); }
  });
  document.querySelector('#remove-addon')?.addEventListener('click', async () => { await uninstallAddon(id); toast('Addon uninstalled.'); location.href = 'installed.html'; });
  document.querySelector('#install-addon')?.addEventListener('click', async () => {
    try { const pack = remote ?? await fetchAddonPackage(id); await installAddon(pack.config, pack.files, { source: 'supabase' }); toast('Addon installed. You can enable it when ready.'); await load(); }
    catch (error) { toast(error.message, 'error'); }
  });
  document.querySelector('#refresh-addon')?.addEventListener('click', async () => {
    try {
      if (addon.source === 'local') {
        const source = localDraft ?? { config, files: addon.files };
        await refreshAddon(id, source.config, source.files);
        toast(localDraft ? 'Installed files refreshed from your saved editor draft.' : 'Local addon refreshed.');
      } else {
        const pack = await fetchAddonPackage(id);
        await refreshAddon(id, pack.config, pack.files);
        toast(`Updated to version ${pack.version.version}.`);
      }
      await load();
    } catch (error) { toast(error.message, 'error'); }
  });
}

function showError(message) {
  document.querySelector('.page-content').innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('warning', 20)}</div><h3>Could not load addon</h3><p>${escapeHtml(message)}</p><a class="button" href="explorer.html">Back to Explorer</a></div>`;
}
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]); }
