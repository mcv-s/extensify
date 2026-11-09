import { renderShell, icon, toast } from '../components/shell.js';
import { getPublishedCatalogStats, listPublishedAddons } from '../supabase/catalog.js';
import { getInstalledAddons } from '../storage/state.js';
import { renderAddonLogo } from '../components/addon-logo.js';
import { addonSummary } from '../addons/metadata.js';

await renderShell({active:'explorer',title:'Explorer',subtitle:'Small, focused addons to make the web work better for you.',content:`<div class="toolbar"><label class="search-wrap">${icon('magnifying-glass',17)}<input id="search" class="field search-field" placeholder="Search addons" aria-label="Search addons"></label><div class="explorer-stats"><button type="button" class="icon-button explorer-stats-toggle" id="explorer-stats-toggle" aria-label="Catalog information" aria-controls="explorer-stats-popover" aria-expanded="false" data-tooltip="Catalog information"><i class="ph ph-dots-three" aria-hidden="true"></i></button><div class="explorer-stats-popover" id="explorer-stats-popover" role="region" aria-label="Catalog information" hidden><h2>Catalog information</h2><dl><div><dt>Published addons</dt><dd id="explorer-addon-total">Loading</dd></div><div><dt>Current package data</dt><dd id="explorer-package-size">Loading</dd></div></dl><p>UTF-8 file contents only; excludes database overhead and older versions.</p></div></div></div><div id="explorer-results"><div class="loading">Loading addons…</div></div>`});
let timer;
document.querySelector('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,180);});
const statsButton=document.querySelector('#explorer-stats-toggle');
const statsPopover=document.querySelector('#explorer-stats-popover');
statsButton.addEventListener('click',()=>{const open=statsButton.getAttribute('aria-expanded')!=='true';statsButton.setAttribute('aria-expanded',String(open));statsPopover.hidden=!open;});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.explorer-stats')){statsButton.setAttribute('aria-expanded','false');statsPopover.hidden=true;}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){statsButton.setAttribute('aria-expanded','false');statsPopover.hidden=true;}});
loadStats();
await load();
async function loadStats(){
  try{
    const stats=await getPublishedCatalogStats();
    document.querySelector('#explorer-addon-total').textContent=stats?String(stats.addonCount):'Unavailable';
    document.querySelector('#explorer-package-size').textContent=stats?formatBytes(stats.totalBytes):'Unavailable';
  }catch{
    document.querySelector('#explorer-addon-total').textContent='Unavailable';
    document.querySelector('#explorer-package-size').textContent='Unavailable';
  }
}
async function load(){
  const root=document.querySelector('#explorer-results');root.innerHTML='<div class="loading">Loading addons…</div>';
  try{
    const [remote,installed]=await Promise.all([listPublishedAddons(document.querySelector('#search').value),getInstalledAddons()]);
    const installedById=new Map(installed.map(item=>[item.id,item]));
    const results=remote.map(item=>({...item,installed:installedById.get(item.id)}));
    if(!results.length){root.innerHTML=`<div class="empty-state"><div class="empty-icon">${icon('compass-tool',20)}</div><h3>No addons found</h3><p>${document.querySelector('#search').value?'Try another search term.':'The published catalog is empty or not connected. You can still install a package from the editor.'}</p><a class="button" href="editor.html">Open editor</a></div>`;return;}
    root.innerHTML=`<div class="addon-grid">${results.map(item=>`<a class="addon-card card" href="addon.html?id=${encodeURIComponent(item.id)}"><div class="addon-card-top">${renderAddonLogo(item.installed?.config||{logo:item.logo},item.installed?.files||{},40)}<div><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></div></div><div class="card-bottom"><span class="muted">By ${escape(item.author_name||'Extensify creator')}</span><span class="badge ${item.installed?.enabled?'green':''}">${item.installed?(item.installed.enabled?'Enabled':'Installed'):'Details'}</span></div></a>`).join('')}</div>`;
  }catch(error){root.innerHTML=`<div class="empty-state"><div class="empty-icon">${icon('warning',20)}</div><h3>Catalog unavailable</h3><p>${escape(error.message||'Could not reach the addon catalog.')}</p><button class="button" id="retry">Try again</button></div>`;document.querySelector('#retry').addEventListener('click',load);}
}
function escape(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatBytes(bytes){if(bytes<1000)return `${bytes} B`;const units=['kB','MB','GB','TB'];let value=bytes/1000,index=0;while(value>=1000&&index<units.length-1){value/=1000;index++;}return `${value.toFixed(value<10?1:0)} ${units[index]}`;}
