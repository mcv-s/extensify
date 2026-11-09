import { renderShell, updateBreadcrumb, icon, toast } from '../components/shell.js';
import { createCodeEditor } from '../editor/code-editor.js';
import { getState, saveDraft, updateState } from '../storage/state.js';
import { createAddonTemplate } from '../editor/template.js';
import { exportAddonZip, importAddonZip } from '../editor/zip.js';
import { importAddonFolder } from '../editor/folder.js';
import { normalizePath, validatePackage } from '../addons/validation.js';
import { addonSummary, upgradeAddonPackage } from '../addons/metadata.js';
import { installAddon, refreshAddon, uninstallAddon } from '../addons/install.js';
import { publishAddon } from '../editor/publish.js';
import { getCurrentUser } from '../auth/auth.js';
import { getSupabase } from '../supabase/client.js';
import { renderAddonLogo } from '../components/addon-logo.js';

window.addEventListener('popstate', () => location.reload());

async function main() {
  const state = await getState();
  const toolbarAsText = state.preferences.editorToolbar === 'buttons';
  const requestedId = new URLSearchParams(location.search).get('id');
  if (!requestedId) return renderProjectPicker(state);

  const draft = state.editorDrafts[requestedId] ?? null;
  if (!draft) { location.replace('editor.html'); return; }
  let selected = { config: draft.config, files: draft.files };
  if (!selected.config) selected.config = JSON.parse(selected.files['config.json']);
  let project = { ...upgradeAddonPackage(selected.config, selected.files), publishedAt:draft.publishedAt, publishedVersion:draft.publishedVersion };
  let activeFile = Object.hasOwn(project.files, draft.activeFile) ? draft.activeFile : 'config.json';
  project.activeFile = activeFile;
  let openFiles = [activeFile];
  let activeFileSave = Promise.resolve();
  let editorView;
  let dirty = false;
  let contextPath = '';

  await renderShell({
    active: 'editor', title: 'Addon editor', subtitle: 'Edit addon files and publish when ready.', breadcrumb: project.config.title || project.config.id, flush: true,
    content: `<div class="editor-toolbar">
      <div class="editor-project-name"><span class="editor-project-logo" id="project-logo">${renderAddonLogo(project.config, project.files, 24)}</span><b id="project-title"></b><span id="dirty-mark" class="dirty-mark" hidden>Unsaved changes</span></div>
      <div class="editor-actions ${toolbarAsText ? 'text-toolbar' : ''}">${editorActionButton('validate-btn','Validate','check-circle',toolbarAsText)}${editorActionButton('import-btn','Load ZIP','upload-simple',toolbarAsText)}${editorActionButton('folder-btn','Load folder','folder-open',toolbarAsText)}${editorActionButton('export-btn','Save ZIP','download-simple',toolbarAsText)}${editorActionButton('install-btn','Install locally','arrow-square-out',toolbarAsText)}${editorActionButton('save-btn','Save draft','floppy-disk',toolbarAsText)}<button type="button" class="button primary liquid-button editor-action-label" id="publish-btn" aria-label="Publish" hidden>${icon('cloud-arrow-up',15)}<span>Publish</span></button><input type="file" id="zip-input" accept=".zip,application/zip" hidden><input type="file" id="folder-input" webkitdirectory directory multiple hidden></div>
    </div>
    <div class="editor-workspace">
      <aside class="file-panel"><div class="panel-heading">FILES <button class="icon-button" id="new-file" aria-label="Add a file" data-tooltip="Add a file">${icon('plus',15)}</button></div><input id="file-search" class="field file-search" placeholder="Filter files"><div id="file-tree" class="file-tree"></div><div class="file-panel-foot"><span id="file-count"></span><span>Right-click a file for actions</span></div></aside>
      <section class="code-panel"><div id="editor-tabs" class="editor-tabs" role="tablist"></div><div id="code-editor" class="code-editor"></div><div class="editor-status"><span id="language-label">JSON</span><span id="cursor-label">Ln 1, Col 1</span><span class="status-right">Plain text · UTF-8</span></div></section>
    </div>
    <div id="file-context-menu" class="file-context-menu" role="menu" hidden><button type="button" role="menuitem" data-menu-action="copy">${icon('copy',14)} Copy path</button><button type="button" role="menuitem" data-menu-action="rename">${icon('file-code',14)} Rename file</button><button type="button" role="menuitem" class="danger-item" data-menu-action="delete">${icon('trash',14)} Delete file</button></div>
    <dialog id="rename-dialog" class="editor-dialog"><form method="dialog" id="rename-form"><h2>Rename file</h2><label class="setting-field"><span class="setting-label">File path</span><input id="rename-input" class="field" autocomplete="off" required></label><div class="dialog-actions"><button class="button" value="cancel">Cancel</button><button class="button primary" id="rename-save" value="save">Rename</button></div></form></dialog>
    <dialog id="validation-dialog" class="editor-dialog"><div class="validation-box" id="validation-box"></div><div class="dialog-actions"><button class="button" id="close-validation">Close</button></div></dialog>
    `
  });

  const $ = selector => document.querySelector(selector);
  const menu = $('#file-context-menu');
  const renameDialog = $('#rename-dialog');
  const validationDialog = $('#validation-dialog');

  function syncActiveFile() { if (editorView) project.files[activeFile] = editorView.getValue(); }
  function rememberActiveFile(path) {
    project.activeFile = path;
    const addonId = project.config.id;
    activeFileSave = activeFileSave.then(() => updateState(next => {
      if (next.editorDrafts[addonId]) next.editorDrafts[addonId].activeFile = path;
      return next;
    })).catch(error => console.warn('Could not remember the selected addon file.', error));
  }
  function markDirty() { dirty = true; $('#dirty-mark').hidden = false; }
  function refreshTitle() {
    $('#project-title').textContent = project.config.title || project.config.id;
    $('#project-logo').innerHTML = renderAddonLogo(project.config, project.files, 24);
    updateBreadcrumb('editor', project.config.title || project.config.id);
  }
  function updateInstallAction() {
    const published=Boolean(project.publishedAt);
    const button=$('#install-btn');
    const label=published?'Extension page':'Install locally';
    button.className=toolbarAsText?'button editor-action-label':'icon-button editor-action';
    button.innerHTML=`${icon('arrow-square-out',18)}${toolbarAsText?`<span>${label}</span>`:''}`;
    button.setAttribute('aria-label',label);
    if(toolbarAsText)button.removeAttribute('data-tooltip');
    else button.dataset.tooltip=label;
  }
  function setPublishLoading(loading) {
    const button = $('#publish-btn');
    button.disabled = loading;
    button.setAttribute('aria-label', loading ? 'Publishing' : 'Publish');
    if (loading) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
    button.innerHTML = loading
      ? '<i class="ph ph-circle-notch publish-spinner" aria-hidden="true"></i><span>Publishing</span>'
      : `${icon('cloud-arrow-up',15)}<span>Publish</span>`;
  }
  function writeConfigFile() {
    project.files['config.json'] = JSON.stringify(project.config, null, 2);
    refreshTitle();
    if (activeFile === 'config.json') showFile(activeFile);
  }
  function showFile(path) {
    if (!Object.hasOwn(project.files, path)) return;
    activeFile = path;
    rememberActiveFile(path);
    if (!openFiles.includes(path)) openFiles.push(path);
    $('#editor-tabs').innerHTML = openFiles.map(file => `<button class="editor-tab ${file === path ? 'active' : ''}" role="tab" aria-selected="${file === path}" data-file="${escapeHtml(file)}">${icon(file.endsWith('.svg') ? 'image' : 'file-code',13)}<span class="tab-name">${escapeHtml(file)}</span><span class="tab-close" data-close="${escapeHtml(file)}" aria-label="Close ${escapeHtml(file)}">${icon('x',12)}</span></button>`).join('');
    editorView?.destroy();
    editorView = createCodeEditor($('#code-editor'), project.files[path], { language: languageForPath(path), fileName: path, engine: state.preferences.editorEngine, onChange: value => {
      project.files[path] = value;
      if (path === 'config.json') {
        try { project.config = JSON.parse(value); } catch { /* Invalid JSON remains editable until validation. */ }
      }
      refreshTitle();
      markDirty();
    }, onCursor: ({ line, column }) => { $('#cursor-label').textContent = `Ln ${line}, Col ${column}`; } });
    $('#language-label').textContent = path.split('.').pop().toUpperCase();
    $('#editor-tabs').querySelectorAll('.editor-tab').forEach(tab => tab.addEventListener('click', event => {
      syncActiveFile();
      const close = event.target.closest('[data-close]');
      if (close) {
        event.preventDefault(); event.stopPropagation();
        const closed = close.dataset.close;
        openFiles = openFiles.filter(file => file !== closed);
        if (!openFiles.length) openFiles = ['config.json'];
        if (activeFile === closed) showFile(openFiles.at(-1)); else showFile(activeFile);
      } else showFile(tab.dataset.file);
    }));
  }
  function renderTree() {
    const filter = $('#file-search').value.toLowerCase();
    const paths = Object.keys(project.files).filter(path => path.toLowerCase().includes(filter)).sort();
    $('#file-tree').innerHTML = paths.map(path => `<button class="tree-file ${path === activeFile ? 'active' : ''}" data-path="${escapeHtml(path)}"><span class="file-ext">${path.endsWith('.svg') ? 'SVG' : path.split('.').pop().toUpperCase().slice(0,3)}</span><span class="tree-file-name">${escapeHtml(path)}</span></button>`).join('') || '<p class="muted tree-empty">No files match.</p>';
    $('#file-count').textContent = `${Object.keys(project.files).length} files`;
    $('#file-tree').querySelectorAll('[data-path]').forEach(button => button.addEventListener('click', () => { syncActiveFile(); showFile(button.dataset.path); renderTree(); }));
  }
  function ensureConfig() {
    try { project.config = JSON.parse(project.files['config.json'] ?? ''); return true; }
    catch (error) { showValidation([`config.json: ${error.message}`]); return false; }
  }
  function showValidation(errors) {
    $('#validation-box').innerHTML = `<div class="validation-head">VALIDATION <span>${errors.length ? `${errors.length} issue${errors.length === 1 ? '' : 's'}` : 'All checks passed'}</span></div>${errors.length ? `<ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : '<p class="validation-ok">Config, files, logo, description, permissions, and entry points look good.</p>'}`;
    validationDialog.showModal();
  }
  function updateManifestFileReferences(previousPath, nextPath) {
    if (project.config.logo?.type === 'svg' && project.config.logo.path === previousPath) project.config.logo.path = nextPath;
    for (const declaration of project.config.contentScripts ?? []) {
      declaration.js = (declaration.js ?? []).map(path => path === previousPath ? nextPath : path);
      declaration.css = (declaration.css ?? []).map(path => path === previousPath ? nextPath : path);
    }
    writeConfigFile();
  }
  function removeManifestFileReferences(path) {
    if (project.config.logo?.type === 'svg' && project.config.logo.path === path) project.config.logo = { type: 'icon', name: 'PuzzlePiece', color: '#3ecf8e' };
    for (const declaration of project.config.contentScripts ?? []) {
      declaration.js = (declaration.js ?? []).filter(entry => entry !== path);
      declaration.css = (declaration.css ?? []).filter(entry => entry !== path);
    }
    writeConfigFile();
  }
  function renameFile(previousPath, proposedPath) {
    const nextPath = normalizePath(proposedPath);
    if (previousPath === 'config.json' || previousPath === 'addon-description.md') throw new Error('The config and addon description files have fixed names.');
    if (Object.hasOwn(project.files, nextPath)) throw new Error('A file with that name already exists.');
    const contents = project.files[previousPath];
    delete project.files[previousPath]; project.files[nextPath] = contents;
    openFiles = openFiles.map(file => file === previousPath ? nextPath : file);
    if (activeFile === previousPath) activeFile = nextPath;
    updateManifestFileReferences(previousPath, nextPath);
    markDirty(); renderTree(); showFile(activeFile);
  }
  function deleteFile(path) {
    if (path === 'config.json' || path === 'addon-description.md') throw new Error('The config and addon description files are required.');
    delete project.files[path];
    openFiles = openFiles.filter(file => file !== path);
    if (!openFiles.length) openFiles = ['config.json'];
    removeManifestFileReferences(path);
    if (activeFile === path) activeFile = openFiles.at(-1);
    markDirty(); renderTree(); showFile(activeFile);
  }
  async function saveLocalDraft() {
    syncActiveFile();
    const normalized = upgradeAddonPackage(project.config, project.files);
    project = { ...normalized, activeFile, publishedAt:project.publishedAt, publishedVersion:project.publishedVersion };
    if (!ensureConfig()) return false;
    const validation = validatePackage(project.config, project.files);
    if (!validation.valid) { showValidation(validation.errors); return false; }
    const id = project.config.id;
    project.id = id;
    await saveDraft(id, structuredClone(project));
    dirty = false; $('#dirty-mark').hidden = true;
    toast('Draft saved on this device.');
    return true;
  }

  refreshTitle(); showFile(activeFile); renderTree(); updateInstallAction();
  try { if (await getCurrentUser()) $('#publish-btn').hidden = false; } catch { /* Publishing remains hidden if auth is unavailable. */ }
  $('#file-search').addEventListener('input', renderTree);
  $('#new-file').addEventListener('click', () => {
    const proposed = prompt('New file path (for example scripts/extra.js):');
    if (!proposed) return;
    try { const path = normalizePath(proposed); if (Object.hasOwn(project.files, path)) throw new Error('That file already exists.'); project.files[path] = ''; openFiles.push(path); showFile(path); renderTree(); markDirty(); }
    catch (error) { toast(error.message, 'error'); }
  });
  $('#file-tree').addEventListener('contextmenu', event => {
    const file = event.target.closest('[data-path]');
    if (!file) return;
    event.preventDefault(); contextPath = file.dataset.path;
    menu.querySelector('[data-menu-action="copy"]').dataset.tooltip = `Copy path: ${contextPath}`;
    menu.hidden = false;
    const left = Math.min(event.clientX, innerWidth - menu.offsetWidth - 10);
    const top = Math.min(event.clientY, innerHeight - menu.offsetHeight - 10);
    menu.style.left = `${Math.max(8,left)}px`; menu.style.top = `${Math.max(8,top)}px`;
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('#file-context-menu')) menu.hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') menu.hidden = true; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); $('#save-btn').click(); } });
  menu.querySelector('[data-menu-action="rename"]').addEventListener('click', () => {
    menu.hidden = true;
    if (contextPath === 'config.json' || contextPath === 'addon-description.md') { toast('The config and addon description files have fixed names.', 'error'); return; }
    $('#rename-input').value = contextPath; renameDialog.showModal(); $('#rename-input').focus(); $('#rename-input').select();
  });
  menu.querySelector('[data-menu-action="copy"]').addEventListener('click', async () => {
    menu.hidden = true;
    try { await navigator.clipboard.writeText(contextPath); toast(`Copied ${contextPath}`); }
    catch { toast('Could not copy the file path. Check clipboard permission.', 'error'); }
  });
  menu.querySelector('[data-menu-action="delete"]').addEventListener('click', () => {
    menu.hidden = true;
    if (contextPath === 'config.json' || contextPath === 'addon-description.md') { toast('The config and addon description files are required.', 'error'); return; }
    if (confirm(`Delete ${contextPath}?`)) { syncActiveFile(); deleteFile(contextPath); toast('File deleted.'); }
  });
  $('#rename-form').addEventListener('submit', event => {
    event.preventDefault();
    try { syncActiveFile(); renameFile(contextPath, $('#rename-input').value); renameDialog.close(); toast('File renamed.'); }
    catch (error) { toast(error.message, 'error'); }
  });
  $('#rename-form').querySelector('[value="cancel"]').addEventListener('click', () => renameDialog.close());
  $('#save-btn').addEventListener('click', saveLocalDraft);
  $('#validate-btn').addEventListener('click', () => { syncActiveFile(); if (ensureConfig()) showValidation(validatePackage(project.config, project.files).errors); });
  $('#close-validation').addEventListener('click', () => validationDialog.close());
  $('#import-btn').addEventListener('click', () => $('#zip-input').click());
  $('#zip-input').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const pack = await importAddonZip(file); project = upgradeAddonPackage(pack.config, pack.files); openFiles = ['config.json']; activeFile = 'config.json'; showFile(activeFile); renderTree(); updateInstallAction(); markDirty(); toast('ZIP imported. Review and save the draft.'); }
    catch (error) { toast(error.message, 'error'); }
    finally { event.target.value = ''; }
  });
  $('#folder-btn').addEventListener('click', () => $('#folder-input').click());
  $('#folder-input').addEventListener('change', async event => {
    if (!event.target.files?.length) return;
    try { project = await importAddonFolder(event.target.files); openFiles = ['config.json']; activeFile = 'config.json'; showFile(activeFile); renderTree(); updateInstallAction(); markDirty(); toast('Folder imported. Review and save the draft.'); }
    catch (error) { toast(error.message, 'error'); }
    finally { event.target.value = ''; }
  });
  $('#export-btn').addEventListener('click', async () => {
    syncActiveFile();
    if (!ensureConfig()) return;
    try { const validation = validatePackage(project.config, project.files); if (!validation.valid) { showValidation(validation.errors); return; } const blob = await exportAddonZip(project.config, project.files); download(`${project.config.id}.zip`, blob); toast('Addon ZIP exported.'); }
    catch (error) { toast(error.message, 'error'); }
  });
  $('#install-btn').addEventListener('click', async () => {
    if (project.publishedAt) { await transitionToPublishedAddon(project.config.id); return; }
    syncActiveFile();
    if (!ensureConfig()) return;
    const validation = validatePackage(project.config, project.files);
    if (!validation.valid) { showValidation(validation.errors); return; }
    try {
      project.id = project.config.id;
      await saveDraft(project.id, structuredClone(project));
      const current = (await getState()).addons[project.id];
      if (current) {
        await refreshAddon(project.id, project.config, project.files);
        await updateState(state => { if (state.addons[project.id]) state.addons[project.id].source = 'local'; return state; });
      }
      else await installAddon(project.config, project.files, { source: 'local' });
      location.href = `addon.html?id=${encodeURIComponent(project.id)}`;
    } catch (error) { toast(error.message, 'error'); }
  });
  $('#publish-btn').addEventListener('click', async () => {
    syncActiveFile();
    if (!ensureConfig()) return;
    const validation = validatePackage(project.config, project.files);
    if (!validation.valid) { showValidation(validation.errors); return; }
    if (!confirm(`Publish ${project.config.title} v${project.config.version} to Explorer?`)) return;
    try {
      setPublishLoading(true);
      try { await publishAddon(project.config, project.files); }
      finally { setPublishLoading(false); }
      let installedRefreshed = false;
      let refreshError = null;
      try {
        if ((await getState()).addons[project.config.id]) {
          await refreshAddon(project.config.id, project.config, project.files, { waitForSync:false });
          installedRefreshed = true;
        }
      } catch (error) { refreshError = error; }
      project.publishedAt = new Date().toISOString();
      project.publishedVersion = project.config.version;
      await saveDraft(project.config.id, structuredClone(project));
      dirty = false;
      $('#dirty-mark').hidden = true;
      updateInstallAction();
      await launchPublishArrow($('#publish-btn'));
      toast(refreshError ? `Addon published, but refresh failed: ${refreshError.message}` : installedRefreshed ? 'Addon published and refreshed.' : 'Addon published to Explorer.');
      if (state.preferences.openAddonAfterPublish) await transitionToPublishedAddon(project.config.id);
    }
    catch (error) { toast(error.message, 'error'); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
}

await main();

async function renderProjectPicker(state) {
  await renderShell({ active: 'editor', title: 'Addon editor', subtitle: 'Choose an addon to edit, or start another project.', content: `
    <div class="project-picker-toolbar"><button type="button" id="create-addon" class="button primary liquid-button" aria-label="New addon">${icon('plus',16)} <span>New addon</span></button><button type="button" id="picker-zip-btn" class="icon-button editor-action" aria-label="Load addon ZIP" data-tooltip="Load addon ZIP">${icon('upload-simple',18)}</button><button type="button" id="picker-folder-btn" class="icon-button editor-action" aria-label="Load folder" data-tooltip="Load folder">${icon('folder-open',18)}</button><input id="picker-zip" type="file" accept=".zip,application/zip" hidden><input id="picker-folder" type="file" webkitdirectory directory multiple hidden></div>
    <div class="project-picker-grid" id="project-list"></div>
    <div class="empty-state picker-empty" id="project-empty" hidden><div class="empty-icon">${icon('file-code',20)}</div><h3>No addon projects yet</h3><p>Create your first addon or load an existing package ZIP.</p></div>
    <div id="addon-project-menu" class="file-context-menu" role="menu" hidden><button type="button" role="menuitem" data-project-action="rename">${icon('pencil-simple',14)} Rename title</button><button type="button" role="menuitem" class="danger-item" data-project-action="delete">${icon('trash',14)} Delete addon</button></div>
    <dialog id="addon-project-rename" class="editor-dialog"><form id="addon-project-rename-form"><h2>Rename addon</h2><label class="setting-field"><span class="setting-label">Addon title</span><input id="addon-project-title" class="field" maxlength="80" required></label><p id="published-rename-warning" class="muted small-copy" hidden>This addon is published. The Explorer title stays unchanged until you publish the renamed draft.</p><div class="dialog-actions"><button type="button" id="cancel-project-rename" class="button">Cancel</button><button class="button primary">Save title</button></div></form></dialog>` });
  const root = document.querySelector('#project-list');
  const drafts = Object.values(state.editorDrafts);
  const projects = drafts.map(draft => ({ id:draft.id, config:draft.config, files:draft.files, title:draft.config?.title || draft.id, description:addonSummary(draft.config,draft.files) || 'Local editor draft', source:'draft', published:Boolean(draft.publishedAt), installed:Boolean(state.addons[draft.id]) }));
  root.innerHTML = projects.map(item => `<a class="project-picker-card card" data-addon-id="${escapeHtml(item.id)}" data-addon-title="${escapeHtml(item.title)}" data-published="${item.published}" href="editor.html?id=${encodeURIComponent(item.id)}&source=${item.source}">${renderAddonLogo(item.config,item.files,38)}<div class="project-picker-copy"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.description)}</span></div><span class="project-picker-status" title="${item.published ? 'Published' : 'Draft'}${item.installed ? ' · Installed' : ''}">${item.published ? '<span class="project-status-icon published" role="img" aria-label="Published" title="Published"><i class="ph ph-cloud-check" aria-hidden="true"></i></span>' : '<span class="badge">Draft</span>'}${item.installed ? `<span class="project-status-icon installed" role="img" aria-label="Installed" title="Installed">${icon('check-circle',16)}</span>` : ''}</span></a>`).join('');
  document.querySelector('#project-empty').hidden = projects.length > 0;
  const menu=document.querySelector('#addon-project-menu');
  const renameDialog=document.querySelector('#addon-project-rename');
  let selectedProject=null;
  root.addEventListener('contextmenu', event => {
    const card=event.target.closest('[data-addon-id]');
    if(!card)return;
    event.preventDefault(); selectedProject=projects.find(item=>item.id===card.dataset.addonId);
    menu.hidden=false;
    menu.style.left=`${Math.max(8,Math.min(event.clientX,innerWidth-menu.offsetWidth-10))}px`;
    menu.style.top=`${Math.max(8,Math.min(event.clientY,innerHeight-menu.offsetHeight-10))}px`;
  });
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#addon-project-menu'))menu.hidden=true;});
  menu.querySelector('[data-project-action="rename"]').addEventListener('click',()=>{
    if(!selectedProject)return;
    menu.hidden=true;
    document.querySelector('#addon-project-title').value=selectedProject.title;
    document.querySelector('#published-rename-warning').hidden=!selectedProject.published;
    renameDialog.showModal(); document.querySelector('#addon-project-title').focus(); document.querySelector('#addon-project-title').select();
  });
  document.querySelector('#cancel-project-rename').addEventListener('click',()=>renameDialog.close());
  document.querySelector('#addon-project-rename-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const title=document.querySelector('#addon-project-title').value.trim();
    if(!title)return;
    try {
      await updateState(next=>{
        const updatePackage=record=>{if(!record)return;record.config={...record.config,title};record.files={...record.files,'config.json':JSON.stringify(record.config,null,2)};};
        const existingDraft=next.editorDrafts[selectedProject.id];
        if(existingDraft)updatePackage(existingDraft);
        else {const installedPackage=next.addons[selectedProject.id];if(installedPackage)next.editorDrafts[selectedProject.id]={id:selectedProject.id,config:structuredClone(installedPackage.config),files:structuredClone(installedPackage.files),publishedAt:selectedProject.published?new Date().toISOString():null};}
        updatePackage(next.addons[selectedProject.id]);
        return next;
      });
      renameDialog.close(); toast(selectedProject.published?'Title changed locally. Publish the draft to update Explorer.':'Addon renamed.'); location.reload();
    } catch(error) { toast(error.message,'error'); }
  });
  menu.querySelector('[data-project-action="delete"]').addEventListener('click',async()=>{
    if(!selectedProject)return;
    menu.hidden=true;
    const message=selectedProject.published
      ? `“${selectedProject.title}” is published. Deleting it permanently removes its public Explorer listing and all local files/settings. Continue?`
      : `Delete “${selectedProject.title}” and its local draft, installation, and settings?`;
    if(!confirm(message))return;
    try {
      if(selectedProject.published){
        const client=await getSupabase();
        if(!client)throw new Error('Sign in to remove a published addon.');
        const {data:{user},error:userError}=await client.auth.getUser();
        if(userError||!user)throw new Error('Sign in to remove a published addon.');
        const {data,error}=await client.from('addons').delete().eq('id',selectedProject.id);
        if(error)throw error;
        if(Array.isArray(data)&&!data.length)throw new Error('Supabase did not remove the published record. Check that this account owns the addon or is an Extensify admin.');
      }
      if(state.addons[selectedProject.id])await uninstallAddon(selectedProject.id);
      await updateState(next=>{delete next.editorDrafts[selectedProject.id];return next;});
      toast(selectedProject.published?'Published addon deleted.':'Addon deleted.'); location.reload();
    } catch(error) { toast(error.message,'error'); }
  });
  document.querySelector('#create-addon').addEventListener('click', async () => {
    const used = new Set([...Object.keys(state.addons), ...Object.keys(state.editorDrafts)]);
    let id = 'my-addon'; let suffix = 2; while (used.has(id)) id = `my-addon-${suffix++}`;
    const files = createAddonTemplate(); const config = JSON.parse(files['config.json']); config.id = id; config.title = 'New Addon'; files['config.json'] = JSON.stringify(config, null, 2);
    await saveDraft(id, { id, config, files }); location.href = `editor.html?id=${encodeURIComponent(id)}&source=draft`;
  });
  document.querySelector('#picker-zip-btn').addEventListener('click',()=>document.querySelector('#picker-zip').click());
  document.querySelector('#picker-zip').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const pack = await importAddonZip(file); await saveDraft(pack.config.id, { id:pack.config.id, config:pack.config, files:pack.files }); location.href = `editor.html?id=${encodeURIComponent(pack.config.id)}&source=draft`; }
    catch (error) { toast(error.message, 'error'); }
    finally { event.target.value = ''; }
  });
  document.querySelector('#picker-folder-btn').addEventListener('click',()=>document.querySelector('#picker-folder').click());
  document.querySelector('#picker-folder').addEventListener('change',async event=>{
    if(!event.target.files?.length)return;
    try { const pack=await importAddonFolder(event.target.files); await saveDraft(pack.config.id,{id:pack.config.id,config:pack.config,files:pack.files}); location.href=`editor.html?id=${encodeURIComponent(pack.config.id)}&source=draft`; }
    catch(error) { toast(error.message,'error'); }
    finally { event.target.value=''; }
  });
}

function download(name, blob) { const anchor = document.createElement('a'); const url = URL.createObjectURL(blob); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function languageForPath(path) {
  const extension = path.split('.').pop().toLowerCase();
  return ({ js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', json: 'json', css: 'css', scss: 'scss', less: 'less', html: 'html', htm: 'html', svg: 'xml', md: 'markdown', txt: 'plaintext' })[extension] ?? 'plaintext';
}

function editorActionButton(id, label, iconName, textToolbar) {
  const className = textToolbar ? 'button editor-action-label' : 'icon-button editor-action';
  const text = textToolbar ? `<span>${label}</span>` : '';
  const tooltip = textToolbar ? '' : ` data-tooltip="${label}"`;
  return `<button type="button" class="${className}" id="${id}" aria-label="${label}"${tooltip}>${icon(iconName,18)}${text}</button>`;
}

async function transitionToPublishedAddon(id) {
  const host = document.querySelector('.page-scroll');
  const editorContent = host?.querySelector(':scope > .page-content');
  const target = `addon.html?id=${encodeURIComponent(id)}`;
  if (!host || !editorContent) { location.href = target; return; }

  const frame = document.createElement('iframe');
  frame.className = 'publish-addon-frame';
  frame.title = 'Addon details';
  host.scrollTop = 0;
  host.classList.add('publish-transition-host');

  const ready = new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Addon details did not finish loading.')); }, 20000);
    const onMessage = event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'extensify:addon-toast') {
        toast(event.data.message, event.data.kind);
        return;
      }
      if (event.data?.type === 'extensify:addon-ready' && event.data.id === id) {
        window.clearTimeout(timeout);
        resolve();
      }
    };
    window.addEventListener('message', onMessage);
    frame.addEventListener('error', () => { cleanup(); reject(new Error('Addon details could not be loaded.')); }, { once: true });
  });

  frame.src = `addon.html?id=${encodeURIComponent(id)}&embed=1&theme=${encodeURIComponent(document.documentElement.dataset.theme || 'dark')}`;
  host.append(frame);
  try { await ready; }
  catch { location.href = target; return; }

  history.pushState({ addonId: id }, '', target);
  document.title = 'addon details - extensify';
  updateBreadcrumb('explorer', document.querySelector('#project-title')?.textContent || id);
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === 'explorer.html'));

  requestAnimationFrame(() => host.classList.add('is-transitioning'));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    editorContent.inert = true;
    return;
  }
  await new Promise(resolve => frame.addEventListener('transitionend', resolve, { once: true }));
  editorContent.inert = true;
}

function launchPublishArrow(button) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const bounds = button.getBoundingClientRect();
  const arrow = document.createElement('span');
  arrow.className = 'publish-launch-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = '<i class="ph ph-file-archive"></i>';
  arrow.style.left = `${bounds.left + bounds.width / 2}px`;
  arrow.style.top = `${bounds.top - 2}px`;
  const animation = new Promise(resolve => arrow.addEventListener('animationend', resolve, { once:true }));
  arrow.addEventListener('animationend', () => arrow.remove(), { once:true });
  document.body.append(arrow);
  return animation;
}
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]); }
