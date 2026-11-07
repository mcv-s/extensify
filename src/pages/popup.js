import { getInstalledAddons, getEffectiveTheme, getState } from '../storage/state.js';
import { fetchAddonPackage } from '../supabase/catalog.js';
import { refreshAddon, setAddonEnabled } from '../addons/install.js';
import { icon } from '../components/shell.js';
import { renderAddonLogo } from '../components/addon-logo.js';
import { renderSettingsForm } from '../components/settings-form.js';
const root = document.querySelector('#popup');
document.documentElement.dataset.theme = await getEffectiveTheme();
document.title = 'popup - extensify';
root.innerHTML = `<header class="popup-head"><a class="popup-brand" href="index.html" target="_blank"><span class="popup-mark"><img src="logo.svg" alt=""></span>extensify</a><a class="popup-settings" href="settings.html" target="_blank" data-tooltip="Settings" aria-label="Settings">${icon('gear')}</a></header><a class="popup-open" href="index.html" target="_blank"><span>${icon('arrow-up-right')}</span><div><b>Open Extensify</b><small>Explore and manage addons</small></div>${icon('arrow-up-right')}</a><div class="popup-section"><div class="popup-label"><span>INSTALLED ADDONS <button type="button" id="refresh-addons" aria-label="Refresh addons" data-tooltip="Refresh addons" style="display:inline-grid;place-items:center;width:17px;height:17px;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;vertical-align:middle">${icon('arrow-clockwise', 13)}</button></span><span id="addon-count">0</span></div><div id="addon-list"><div class="popup-empty">Loading…</div></div></div><footer class="popup-footer"><a href="docs.html" target="_blank">Documentation</a><a href="privacy.html" target="_blank">Privacy</a></footer>`;
const addons = await getInstalledAddons(); document.querySelector('#addon-count').textContent = addons.length;
const refreshButton = document.querySelector('#refresh-addons');
const refreshStatus = document.createElement('small');
refreshStatus.className = 'popup-refresh-status';
refreshStatus.setAttribute('aria-live', 'polite');
refreshStatus.hidden = true;
document.querySelector('.popup-section').append(refreshStatus);
refreshButton.addEventListener('click', async () => {
  refreshButton.disabled = true;
  refreshStatus.hidden = false;
  refreshStatus.textContent = 'Refreshing addons…';
  let state;
  try {
    state = await getState();
  } catch (error) {
    refreshStatus.textContent = error instanceof Error ? error.message : String(error);
    refreshButton.disabled = false;
    return;
  }
  let refreshed = 0;
  let skipped = 0;
  const errors = [];
  for (const addon of Object.values(state.addons)) {
    try {
      if (addon.source === 'local') {
        const draft = state.editorDrafts[addon.id];
        if (!draft) { skipped += 1; continue; }
        await refreshAddon(addon.id, draft.config, draft.files, { waitForSync: false });
      } else {
        const packageData = await fetchAddonPackage(addon.id);
        await refreshAddon(addon.id, packageData.config, packageData.files, { waitForSync: false });
      }
      refreshed += 1;
    } catch (error) {
      errors.push(`${addon.config?.title || addon.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (errors.length) {
    refreshStatus.textContent = `Refreshed ${refreshed}; failed: ${errors.join('; ')}`;
    refreshButton.disabled = false;
  } else if (!refreshed) {
    refreshStatus.textContent = skipped
      ? 'No saved Editor drafts available to refresh local addons.'
      : 'No addons to refresh.';
    refreshButton.disabled = false;
  } else {
    location.reload();
  }
});
const list = document.querySelector('#addon-list');
if (!addons.length) list.innerHTML = '<div class="popup-empty">No addons installed yet.<br><a href="explorer.html" target="_blank">Browse Explorer</a></div>';
else list.innerHTML = addons.map(addon => { const hasSettings = Object.values(addon.config.env ?? {}).some(schema => schema.visibility !== false); return `<div class="popup-addon" style="display:flex;flex-direction:column;align-items:stretch"><div style="display:flex;align-items:center;gap:9px;width:100%">${renderAddonLogo(addon.config, addon.files, 30)}<a class="popup-addon-name" href="addon.html?id=${encodeURIComponent(addon.id)}" target="_blank"><b>${escape(addon.config.title)}</b><small>${addon.enabled ? 'Enabled' : 'Disabled'}</small></a>${hasSettings ? `<button type="button" data-expand-id="${escape(addon.id)}" aria-expanded="false" aria-controls="settings-${escape(addon.id)}" aria-label="Expand settings for ${escape(addon.config.title)}" style="display:grid;place-items:center;width:26px;height:26px;padding:0;border:0;background:transparent;color:var(--muted);cursor:pointer">${icon('caret-down', 20)}</button>` : ''}<label class="popup-switch" title="${addon.enabled ? 'Disable' : 'Enable'} ${escape(addon.config.title)}"><input type="checkbox" data-id="${escape(addon.id)}" ${addon.enabled ? 'checked' : ''} aria-label="${addon.enabled ? 'Disable' : 'Enable'} ${escape(addon.config.title)}"><span></span></label></div>${hasSettings ? `<div id="settings-${escape(addon.id)}" class="popup-addon-settings" hidden style="min-height:70px;margin-top:4px;padding:10px 8px;border-radius:5px"></div>` : ''}</div>`; }).join('');
list.addEventListener('click', event => { const button = event.target.closest('[data-expand-id]'); if (!button) return; const dropdown = document.getElementById(button.getAttribute('aria-controls')); const addon = addons.find(item => item.id === button.dataset.expandId); const expanded = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!expanded)); button.style.transform = expanded ? '' : 'rotate(180deg)'; dropdown.hidden = expanded; if (!expanded && !dropdown.hasChildNodes()) renderSettingsForm(addon, dropdown); });
list.addEventListener('change', async e => { const input = e.target.closest('[data-id]'); if (!input) return; const id = input.dataset.id; const addon = addons.find(item => item.id === id); const wasEnabled = addon.enabled; try { await setAddonEnabled(id, input.checked, addon.config); addon.enabled = input.checked; input.closest('.popup-addon').querySelector('small').textContent = input.checked ? 'Enabled' : 'Disabled'; } catch (error) { input.checked = wasEnabled; const status = input.closest('.popup-addon').querySelector('small'); status.textContent = 'Not changed'; status.title = error.message; } });
function escape(v = '') { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
