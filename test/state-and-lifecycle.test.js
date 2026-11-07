import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, getState, setTheme, setEditorEngine, setEditorToolbar, setOpenAddonAfterPublish, updateState } from '../src/storage/state.js';
import { exportData, importData, validateImport } from '../src/data/data.js';
import { installAddon, refreshAddon, uninstallAddon, updateAddonSettings } from '../src/addons/install.js';
import { createAddonTemplate } from '../src/editor/template.js';
import { upgradeAddonPackage } from '../src/addons/metadata.js';
import { AUTH_SESSION_KEY, saveAuthSession } from '../src/auth/session.js';

const store=new Map();
globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};

test('state migration restores safe defaults and known namespace shapes', () => {
  const state=migrateState({schemaVersion:0,preferences:{theme:'sepia'},addons:[]});
  assert.equal(state.schemaVersion,3);
  assert.equal(state.preferences.theme,'dark');
  assert.equal(state.preferences.editorEngine,'vscode');
  assert.equal(state.preferences.editorToolbar,'icons');
  assert.equal(state.preferences.openAddonAfterPublish,true);
  assert.deepEqual(state.addons,{});
  assert.deepEqual(state.editorDrafts,{});
});

test('state migration validates editor preferences and preserves supported selections', () => {
  const state=migrateState({preferences:{editorEngine:'classic',editorToolbar:'buttons'}});
  assert.equal(state.preferences.editorEngine,'classic');
  assert.equal(state.preferences.editorToolbar,'buttons');
  const invalid=migrateState({preferences:{editorEngine:'remote',editorToolbar:'compact'}});
  assert.equal(invalid.preferences.editorEngine,'vscode');
  assert.equal(invalid.preferences.editorToolbar,'icons');
  assert.equal(invalid.preferences.openAddonAfterPublish,true);
});

test('editor preferences persist and reject unsupported values', async () => {
  store.clear();
  await setEditorEngine('classic');
  await setEditorToolbar('buttons');
  await setOpenAddonAfterPublish(false);
  const state=await getState();
  assert.equal(state.preferences.editorEngine,'classic');
  assert.equal(state.preferences.editorToolbar,'buttons');
  assert.equal(state.preferences.openAddonAfterPublish,false);
  assert.throws(()=>setEditorEngine('other'),/must be classic or vscode/);
  assert.throws(()=>setEditorToolbar('compact'),/must be icons or buttons/);
});

test('state migration strips credentials from exportable account metadata', () => {
  const state=migrateState({schemaVersion:3,auth:{user:{id:'user-1',email:'creator@example.com'},accessToken:'access',refreshToken:'refresh',expiresAt:123}});
  assert.deepEqual(state.auth,{user:{id:'user-1',email:'creator@example.com'}});
});

test('state migration moves legacy addon descriptions to the current format and uses a Phosphor default logo', () => {
  const oldConfig={manifestVersion:1,id:'legacy-addon',title:'Legacy Addon',description:'A longer old description.',version:'1.0.0',author:{name:'Creator'},icon:'assets/icon.svg',permissions:[],contentScripts:[],env:{}};
  const files={'config.json':JSON.stringify(oldConfig),'assets/icon.svg':'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'};
  const state=migrateState({schemaVersion:2,addons:{'legacy-addon':{config:oldConfig,files}}});
  assert.equal(state.addons['legacy-addon'].files['addon-description.md'],'A longer old description.');
  assert.deepEqual(state.addons['legacy-addon'].config.logo,{type:'icon',name:'PuzzlePiece',color:'#3ecf8e'});
  assert.equal(Object.hasOwn(state.addons['legacy-addon'].config,'description'),false);
});

test('state migration restores draft IDs and selected files from stored metadata', () => {
  const config = { manifestVersion:1,id:'store-addon',title:'Store Addon',version:'1.0.0',author:{name:'Creator'} };
  const state = migrateState({ schemaVersion:2, editorDrafts:{'store-addon':{config,files:{'config.json':JSON.stringify(config)},activeFile:'content.js'}} });
  assert.equal(state.editorDrafts['store-addon'].id,'store-addon');
  assert.equal(state.editorDrafts['store-addon'].activeFile,'content.js');
});

test('legacy README files are removed while the addon description is preserved', () => {
  const config={manifestVersion:1,id:'legacy-addon',title:'Legacy',version:'1.0.0',author:{name:'Creator'}};
  const upgraded=upgradeAddonPackage(config,{'README.md':'old readme','addon-description.md':'# Full description','content.js':'// source'});
  assert.equal(Object.hasOwn(upgraded.files,'README.md'),false);
  assert.equal(upgraded.files['addon-description.md'],'# Full description');
  assert.equal(upgraded.files['content.js'],'// source');
});

test('install, refresh, and uninstall preserve then remove compatible addon settings', async () => {
  store.clear();
  const files=createAddonTemplate();const config=JSON.parse(files['config.json']);
  await installAddon(config,files);
  await updateAddonSettings(config.id,{greeting:'Personal greeting',removedKey:'discard'});
  const updated={...config,version:'1.1.0',env:{...config.env,newOption:{type:'boolean',default:true}}};
  await refreshAddon(config.id,updated,files);
  let addon=await (await import('../src/storage/state.js')).getInstalledAddon(config.id);
  assert.equal(addon.version,'1.1.0');
  assert.equal(addon.settings.greeting,'Personal greeting');
  assert.equal(addon.settings.newOption,true);
  assert.equal(Object.hasOwn(addon.settings,'removedKey'),false);
  await uninstallAddon(config.id);
  addon=await (await import('../src/storage/state.js')).getInstalledAddon(config.id);
  assert.equal(addon,null);
});

test('refresh can update the installed package without waiting for runtime sync', async () => {
  store.clear();
  const files=createAddonTemplate();const config=JSON.parse(files['config.json']);
  await installAddon(config,files);
  const previousChrome=globalThis.chrome;
  let syncStarted=false;
  globalThis.chrome={runtime:{sendMessage(){syncStarted=true;return new Promise(()=>{});}}};
  try {
    const updated={...config,version:'1.1.0'};
    await refreshAddon(config.id,updated,files,{waitForSync:false});
    assert.equal(syncStarted,true);
    assert.equal((await (await import('../src/storage/state.js')).getInstalledAddon(config.id)).version,'1.1.0');
  } finally {
    if(previousChrome===undefined)delete globalThis.chrome;
    else globalThis.chrome=previousChrome;
  }
});

test('data export/import validates and restores one versioned user state', async () => {
  store.clear();
  await setTheme('light');
  const files=createAddonTemplate();const config=JSON.parse(files['config.json']);
  await installAddon(config,files);
  const payload=await exportData();
  await updateState(state=>{state.addons[config.id].storage={lastSeen:'https://example.com/'};return state;});
  const updatedPayload=await exportData();
  assert.deepEqual(updatedPayload.state.addons[config.id].storage,{lastSeen:'https://example.com/'});
  assert.equal(payload.format,'extensify-user-data');
  store.clear();
  await importData(updatedPayload);
  const state=await getState();
  assert.equal(state.preferences.theme,'light');
  assert.equal(state.addons[config.id].config.title,config.title);
  assert.deepEqual(state.addons[config.id].storage,{lastSeen:'https://example.com/'});
  assert.equal(validateImport(updatedPayload).schemaVersion,3);
  assert.throws(()=>validateImport({...updatedPayload,version:999}),/unsupported data version/);
  await assert.rejects(importData({...updatedPayload,state:{...updatedPayload.state,addons:{broken:{id:'mismatch',config,files}}}}),/does not match its ID/);
});

test('data backup exports and restores the separately stored sign-in session', async () => {
  const previousChrome=globalThis.chrome;
  const values=new Map();
  const local={
    async get(key){return values.has(key)?{[key]:values.get(key)}:{};},
    async set(items){for(const [key,value] of Object.entries(items))values.set(key,value);},
    async remove(key){values.delete(key);},
    async setAccessLevel(){}
  };
  globalThis.chrome={storage:{local}};
  try {
    await saveAuthSession({access_token:'access-token',refresh_token:'refresh-token',expires_at:123456});
    const backup=await exportData();
    assert.deepEqual(backup.authSession,{accessToken:'access-token',refreshToken:'refresh-token',expiresAt:123456});
    values.clear();
    await importData(backup);
    assert.deepEqual(values.get(AUTH_SESSION_KEY),backup.authSession);
    assert.throws(()=>validateImport({...backup,authSession:{accessToken:'',refreshToken:'refresh-token',expiresAt:123456}}),/invalid sign-in session/);
  } finally { globalThis.chrome=previousChrome; }
});
