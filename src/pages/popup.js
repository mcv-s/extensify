import { getInstalledAddons, getEffectiveTheme } from '../storage/state.js';
import { setAddonEnabled } from '../addons/install.js';
import { icon } from '../components/shell.js';
import { renderAddonLogo } from '../components/addon-logo.js';
const root=document.querySelector('#popup');
document.documentElement.dataset.theme=await getEffectiveTheme();
document.title='popup - extensify';
root.innerHTML=`<header class="popup-head"><a class="popup-brand" href="index.html" target="_blank"><span class="popup-mark"><img src="logo.svg" alt=""></span>extensify</a><a class="popup-settings" href="settings.html" target="_blank" title="Settings" aria-label="Settings">${icon('gear')}</a></header><a class="popup-open" href="index.html" target="_blank"><span>${icon('arrow-up-right')}</span><div><b>Open Extensify</b><small>Explore and manage addons</small></div>${icon('arrow-up-right')}</a><div class="popup-section"><div class="popup-label">INSTALLED ADDONS <span id="addon-count">0</span></div><div id="addon-list"><div class="popup-empty">Loading…</div></div></div>`;
const addons=await getInstalledAddons();document.querySelector('#addon-count').textContent=addons.length;
const list=document.querySelector('#addon-list');
if(!addons.length)list.innerHTML='<div class="popup-empty">No addons installed yet.<br><a href="explorer.html" target="_blank">Browse Explorer</a></div>';
else list.innerHTML=addons.map(addon=>`<div class="popup-addon">${renderAddonLogo(addon.config,addon.files,30)}<a class="popup-addon-name" href="addon.html?id=${encodeURIComponent(addon.id)}" target="_blank"><b>${escape(addon.config.title)}</b><small>${addon.enabled?'Enabled':'Disabled'}</small></a><label class="popup-switch" title="${addon.enabled?'Disable':'Enable'} ${escape(addon.config.title)}"><input type="checkbox" data-id="${escape(addon.id)}" ${addon.enabled?'checked':''} aria-label="${addon.enabled?'Disable':'Enable'} ${escape(addon.config.title)}"><span></span></label></div>`).join('');
list.addEventListener('change',async e=>{const input=e.target.closest('[data-id]');if(!input)return;const id=input.dataset.id;const addon=addons.find(item=>item.id===id);const wasEnabled=addon.enabled;try{await setAddonEnabled(id,input.checked,addon.config);addon.enabled=input.checked;input.closest('.popup-addon').querySelector('small').textContent=input.checked?'Enabled':'Disabled';}catch(error){input.checked=wasEnabled;const status=input.closest('.popup-addon').querySelector('small');status.textContent='Not changed';status.title=error.message;}});
function escape(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
