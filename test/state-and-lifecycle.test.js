import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, getState, setTheme } from '../src/storage/state.js';
import { exportData, importData, validateImport } from '../src/data/data.js';
import { installAddon, refreshAddon, uninstallAddon, updateAddonSettings } from '../src/addons/install.js';
import { createAddonTemplate } from '../src/editor/template.js';
import { upgradeAddonPackage } from '../src/addons/metadata.js';

const store=new Map();
globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};

test('state migration restores safe defaults and known namespace shapes', () => {
  const state=migrateState({schemaVersion:0,preferences:{theme:'sepia'},addons:[]});
  assert.equal(state.schemaVersion,3);
  assert.equal(state.preferences.theme,'dark');
  assert.deepEqual(state.addons,{});
  assert.deepEqual(state.editorDrafts,{});
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

test('data export/import validates and restores one versioned user state', async () => {
  store.clear();
  await setTheme('light');
  const files=createAddonTemplate();const config=JSON.parse(files['config.json']);
  await installAddon(config,files);
  const payload=await exportData();
  assert.equal(payload.format,'extensify-user-data');
  store.clear();
  await importData(payload);
  const state=await getState();
  assert.equal(state.preferences.theme,'light');
  assert.equal(state.addons[config.id].config.title,config.title);
  assert.equal(validateImport(payload).schemaVersion,3);
  assert.throws(()=>validateImport({...payload,version:999}),/unsupported data version/);
  await assert.rejects(importData({...payload,state:{...payload.state,addons:{broken:{id:'mismatch',config,files}}}}),/does not match its ID/);
});
