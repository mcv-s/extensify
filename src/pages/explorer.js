import { renderShell, icon, toast } from '../components/shell.js';
import { listPublishedAddons } from '../supabase/catalog.js';
import { getInstalledAddons } from '../storage/state.js';
import { renderAddonLogo } from '../components/addon-logo.js';
import { addonSummary } from '../addons/metadata.js';

await renderShell({active:'explorer',title:'Explorer',subtitle:'Small, focused addons to make the web work better for you.',content:`<div class="toolbar"><label class="search-wrap">${icon('magnifying-glass',17)}<input id="search" class="field search-field" placeholder="Search addons" aria-label="Search addons"></label><span class="muted" id="result-count"></span></div><div id="explorer-results"><div class="loading">Loading addons…</div></div>`});
let timer;
document.querySelector('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,180);});
await load();
async function load(){
  const root=document.querySelector('#explorer-results');root.innerHTML='<div class="loading">Loading addons…</div>';
  try{
    const [remote,installed]=await Promise.all([listPublishedAddons(document.querySelector('#search').value),getInstalledAddons()]);
    const installedById=new Map(installed.map(item=>[item.id,item]));
    const results=[...remote.map(item=>({...item,installed:installedById.get(item.id)})),...installed.filter(item=>!remote.some(row=>row.id===item.id)).map(item=>({id:item.id,title:item.config.title,description:addonSummary(item.config,item.files),author_name:item.config.author.name,logo:item.config.logo,installed:item,local:true}))];
    document.querySelector('#result-count').textContent=`${results.length} ${results.length===1?'addon':'addons'}`;
    if(!results.length){root.innerHTML=`<div class="empty-state"><div class="empty-icon">${icon('compass-tool',20)}</div><h3>No addons found</h3><p>${document.querySelector('#search').value?'Try another search term.':'The published catalog is empty or not connected. You can still install a package from the editor.'}</p><a class="button" href="editor.html">Open editor</a></div>`;return;}
    root.innerHTML=`<div class="addon-grid">${results.map(item=>`<a class="addon-card card" href="addon.html?id=${encodeURIComponent(item.id)}"><div class="addon-card-top">${renderAddonLogo(item.installed?.config||{logo:item.logo},item.installed?.files||{},40)}<div><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></div></div><div class="card-bottom"><span class="muted">By ${escape(item.author_name||'Extensify creator')}</span><span class="badge ${item.installed?.enabled?'green':''}">${item.installed?(item.installed.enabled?'Enabled':'Installed'):'Details'}</span></div></a>`).join('')}</div>`;
  }catch(error){root.innerHTML=`<div class="empty-state"><div class="empty-icon">${icon('warning',20)}</div><h3>Catalog unavailable</h3><p>${escape(error.message||'Could not reach the addon catalog.')}</p><button class="button" id="retry">Try again</button></div>`;document.querySelector('#retry').addEventListener('click',load);}
}
function escape(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
