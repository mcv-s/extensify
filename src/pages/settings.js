import { renderShell, icon, toast, applyTheme, setProfileLabel } from '../components/shell.js';
import { getState, setSidebarBehavior, setTheme, setEditorEngine, setEditorToolbar, setOpenAddonAfterPublish } from '../storage/state.js';
import { exportData, importData, resetData } from '../data/data.js';
import { getCurrentUser, signInWithPassword, signOut } from '../auth/auth.js';
import { readAuthSession } from '../auth/session.js';

const state=await getState();
await renderShell({active:'settings',title:'Settings',subtitle:'Your Extensify preferences and local data.',content:`
 <div class="settings-page">
    <section class="settings-section"><div class="settings-section-heading"><h2>${icon('paint-brush',17)}Appearance</h2><p>Personalize how Extensify looks and navigates.</p></div><div class="settings-rows">
   <div class="settings-row"><div class="settings-row-copy"><h3>Color theme</h3><p>Choose a theme for this browser profile.</p></div><div class="theme-options" id="theme-options" role="group" aria-label="Color theme"><button type="button" data-theme-option="light" aria-pressed="false">${icon('sun',16)} Light</button><button type="button" data-theme-option="dark" aria-pressed="false">${icon('moon',16)} Dark</button><button type="button" data-theme-option="system" aria-pressed="false">${icon('monitor',16)} System</button></div></div>
   <div class="settings-row"><div class="settings-row-copy"><h3>Sidebar behavior</h3><p>Controls the sidebar button and Ctrl+B shortcut.</p></div><div class="theme-options" id="sidebar-options" role="group" aria-label="Sidebar behavior"><button type="button" data-sidebar-option="collapse" aria-pressed="false">${icon('sidebar',16)} Collapse</button><button type="button" data-sidebar-option="hide" aria-pressed="false">${icon('x',16)} Hide</button></div></div>
  </div></section>
    <section class="settings-section"><div class="settings-section-heading"><h2>${icon('code',17)}Editor</h2><p>Choose your editing experience and toolbar layout.</p></div><div class="settings-rows">
   <div class="settings-row"><div class="settings-row-copy"><h3>Editor</h3><p>VS Code provides language-aware highlighting, completions, hover documentation, and folding.</p></div><div class="theme-options" id="editor-engine-options" role="group" aria-label="Code editor"><button type="button" data-editor-engine="classic" aria-pressed="false">Classic</button><button type="button" data-editor-engine="vscode" aria-pressed="false">VS Code</button></div></div>
   <div class="settings-row"><div class="settings-row-copy"><h3>Toolbar</h3><p>Use compact icon controls or labeled buttons.</p></div><div class="theme-options" id="editor-toolbar-options" role="group" aria-label="Editor toolbar"><button type="button" data-editor-toolbar="icons" aria-pressed="false">${icon('squares-four',16)} Icons</button><button type="button" data-editor-toolbar="buttons" aria-pressed="false">${icon('list',16)} Text buttons</button></div></div>
    <div class="settings-row setting-toggle-field"><div class="settings-row-copy"><h3>Open details after publish</h3><p>Open the addon page after a successful publish.</p></div><div class="switch-row"><input id="open-addon-after-publish" type="checkbox" data-setting role="switch" aria-label="Open details after publish"></div></div>
  </div></section>
  <section class="settings-section"><div class="settings-section-heading"><h2>${icon('user-circle',17)}Account</h2><p>Sign in to publish creator projects. Browsing and installing works while signed out.</p></div><div class="settings-section-content"><div id="account-state" class="account-state"><span class="muted">Checking account…</span></div><form id="signin-form" name="extensify-login" class="setting-field signin-form" method="post" autocomplete="on" hidden><label class="setting-label" for="email">Email address</label><input id="email" name="username" type="email" placeholder="you@example.com" autocomplete="username" required><label class="setting-label" for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button class="button primary" type="submit">Sign in</button></form><button class="button ghost" id="signout" hidden>Sign out</button></div></section>
  <section class="settings-section"><div class="settings-section-heading"><h2>${icon('shield-check',17)}Page scripts</h2><p>Extensify uses Chromium’s User Scripts API to run enabled addon code.</p></div><div class="settings-section-content settings-actions"><div id="user-script-state" class="callout">Checking browser permission…</div><button class="button" id="open-extension-details">Open extension settings</button></div></section>
  <section class="settings-section"><div class="settings-section-heading"><h2>${icon('floppy-disk',17)}Local data</h2><p>Manage backups and data stored in this browser profile.</p></div><div class="settings-rows">
   <div class="settings-row"><div class="settings-row-copy"><h3>Backup &amp; restore</h3><p>Includes preferences, addons, editor drafts, and your saved sign-in session. Keep the backup private because it contains sign-in tokens.</p><p class="data-status" id="data-status" aria-live="polite"></p></div><div class="inline-actions"><button class="button" id="export-data">${icon('download-simple',15)} Export</button><label class="button file-button">${icon('upload-simple',15)} Import<input id="import-data" type="file" accept="application/json,.json" hidden></label></div></div>
   <div class="settings-row settings-danger-row"><div class="settings-row-copy"><h3>Reset local data</h3><p>Removes local addon installs, settings, saved editor drafts, theme, and cached account metadata.</p></div><button class="button danger" id="reset-data">Reset data</button></div>
  </div></section>
 </div>`});
function updateThemeOptions(){document.querySelectorAll('[data-theme-option]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeOption===state.preferences.theme)));}
updateThemeOptions();
document.querySelectorAll('[data-theme-option]').forEach(button=>button.addEventListener('click',async()=>{state.preferences.theme=button.dataset.themeOption;await setTheme(state.preferences.theme);await applyTheme();updateThemeOptions();toast('Theme updated.');}));
function updateSidebarOptions(){document.querySelectorAll('[data-sidebar-option]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sidebarOption===state.preferences.sidebarBehavior)));}
updateSidebarOptions();
document.querySelectorAll('[data-sidebar-option]').forEach(button=>button.addEventListener('click',async()=>{state.preferences.sidebarBehavior=button.dataset.sidebarOption;await setSidebarBehavior(state.preferences.sidebarBehavior);const shell=document.querySelector('.app-shell');shell.classList.remove('sidebar-collapsed','sidebar-hidden');if(state.preferences.sidebarCollapsed)shell.classList.add(state.preferences.sidebarBehavior==='hide'?'sidebar-hidden':'sidebar-collapsed');updateSidebarOptions();toast('Sidebar behavior updated.');}));
function updateEditorOptions(){document.querySelectorAll('[data-editor-engine]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.editorEngine===state.preferences.editorEngine)));document.querySelectorAll('[data-editor-toolbar]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.editorToolbar===state.preferences.editorToolbar)));}
updateEditorOptions();
document.querySelectorAll('[data-editor-engine]').forEach(button=>button.addEventListener('click',async()=>{state.preferences.editorEngine=button.dataset.editorEngine;await setEditorEngine(state.preferences.editorEngine);updateEditorOptions();toast('Editor preference updated.');}));
document.querySelectorAll('[data-editor-toolbar]').forEach(button=>button.addEventListener('click',async()=>{state.preferences.editorToolbar=button.dataset.editorToolbar;await setEditorToolbar(state.preferences.editorToolbar);updateEditorOptions();toast('Toolbar preference updated.');}));
const openAddonAfterPublish=document.querySelector('#open-addon-after-publish');
openAddonAfterPublish.checked=state.preferences.openAddonAfterPublish;
openAddonAfterPublish.addEventListener('change',async()=>{state.preferences.openAddonAfterPublish=openAddonAfterPublish.checked;await setOpenAddonAfterPublish(openAddonAfterPublish.checked);toast('Publish behavior updated.');});
document.querySelector('#export-data').addEventListener('click',async()=>{const data=await exportData();const date=new Date();const filename=`extensify_backup_${date.getMonth()+1}_${date.getDate()}_${String(date.getFullYear()).slice(-2)}.json`;download(filename,JSON.stringify(data,null,2),'application/json');toast('Backup downloaded.');});
document.querySelector('#import-data').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());await importData(data);document.querySelector('#data-status').textContent='Data restored. Refreshing settings…';toast('Import complete.');setTimeout(()=>location.reload(),500);}catch(error){toast(error.message,'error');}finally{e.target.value='';}});
document.querySelector('#reset-data').addEventListener('click',async()=>{if(!confirm('Reset all local Extensify data? This removes installed addon source and settings.'))return;await resetData();toast('Local data reset.');setTimeout(()=>location.reload(),500);});
document.querySelector('#signin-form').addEventListener('submit',async e=>{e.preventDefault();try{await signInWithPassword(document.querySelector('#email').value.trim(),document.querySelector('#password').value);toast('Signed in.');await updateAccount();}catch(error){toast(error.message,'error');}});
function showSignedIn(user,status='Supabase account connected'){const email=user?.email||'Signed in';setProfileLabel(email);document.querySelector('#account-state').innerHTML=`<div class="signed-in">${icon('user-circle',20)}<span><b>${escape(email)}</b><small>${escape(status)}</small></span></div>`;document.querySelector('#signin-form').hidden=true;document.querySelector('#signout').hidden=false;}
function showSignedOut(){setProfileLabel('Signed out');document.querySelector('#account-state').innerHTML='<span class="badge">Signed out · local use available</span>';document.querySelector('#signin-form').hidden=false;document.querySelector('#signout').hidden=true;}
async function updateAccount(){
 const form=document.querySelector('#signin-form');
 const signoutButton=document.querySelector('#signout');
 form.hidden=true;
 signoutButton.hidden=true;
 const cachedUser=(await getState()).auth?.user;
 const savedSession=await readAuthSession();
 if(cachedUser||savedSession)showSignedIn(cachedUser,'Checking saved Supabase session…');
 try{
  const user=await getCurrentUser();
  if(user){showSignedIn(user);return;}
  const currentUser=(await getState()).auth?.user;
  const currentSession=await readAuthSession();
  // A profile can be cached without a usable token after an older version or
  // a temporary auth outage. Keep the account controls signed-in until the
  // user explicitly signs out; never flash the password form over that state.
  if(currentUser||currentSession){showSignedIn(currentUser||cachedUser,'Session needs to reconnect.');return;}
  showSignedOut();
 }catch(error){
  if(cachedUser||savedSession)showSignedIn(cachedUser,'Session check unavailable; try again later.');
  else{setProfileLabel('Signed out');document.querySelector('#account-state').innerHTML=`<span class="muted">${escape(error.message)}</span>`;form.hidden=false;}
 }
}
document.querySelector('#signout').addEventListener('click',async()=>{try{await signOut();toast('Signed out.');location.reload();}catch(error){toast(error.message,'error');}});
await updateAccount();
try{await chrome.userScripts.getScripts();document.querySelector('#user-script-state').textContent='User Scripts is enabled. Addons request access to their declared sites when you enable them.';}catch{document.querySelector('#user-script-state').textContent='Enable “Allow User Scripts” on the Extensify details page before running addons. In Chrome 138+, open the extension details and enable Allow User Scripts. Earlier versions require Developer mode.';}
document.querySelector('#open-extension-details').addEventListener('click',()=>{const prefix=/Edg\//.test(navigator.userAgent)?'edge':'chrome';chrome.tabs.create({url:`${prefix}://extensions/?id=${chrome.runtime.id}`});});
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function escape(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
