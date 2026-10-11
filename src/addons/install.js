import { getState, updateState } from '../storage/state.js';
import { defaultSettings, validatePackage } from './validation.js';

export async function installAddon(config, files, { source = 'local' } = {}) {
  const checked = validatePackage(config, files);
  if (!checked.valid) throw new Error(checked.errors.join('\n'));
  await updateState(state => {
    state.addons[config.id] = { id: config.id, config, files: checked.files, version: config.version, enabled: false, installedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source, settings: defaultSettings(config) };
    return state;
  });
  return config.id;
}

export async function setAddonEnabled(id, enabled, config = null) {
  if (enabled && globalThis.chrome?.permissions?.request) {
    if (!globalThis.chrome.userScripts) throw new Error('Enable “Allow User Scripts” in the Extensify extension details before enabling addons.');
    const origins = [...new Set((config?.contentScripts ?? []).flatMap(entry => entry.matches ?? []).flatMap(pattern => pattern === '<all_urls>' ? ['http://*/*','https://*/*'] : [pattern]))];
    if (origins.length) {
      const permissionRequest = chrome.permissions.request({ origins });
      const granted = await permissionRequest;
      if (!granted) throw new Error('Site access was not granted, so the addon stays disabled.');
    }
  }
  const result = await updateState(state => { if (state.addons[id]) state.addons[id].enabled = Boolean(enabled); return state; });
  try {
    const response=await globalThis.chrome?.runtime?.sendMessage?.({ type:'EXTENSIFY_SYNC_ADDON', addonId:id });
    if(response?.error)throw new Error(response.error);
  } catch(error) {
    if(enabled)await updateState(state=>{if(state.addons[id])state.addons[id].enabled=false;return state;});
    throw error;
  }
  return result;
}

export async function refreshAddon(id, config, files) {
  const state = await getState();
  const old = state.addons[id];
  if (!old) throw new Error('This addon is not installed.');
  if (config.id !== id) throw new Error('The server addon ID does not match the installed addon.');
  const checked = validatePackage(config, files);
  if (!checked.valid) throw new Error(checked.errors.join('\n'));
  await updateState(next => {
    next.addons[id] = { ...old, config, files: checked.files, version: config.version, settings: defaultSettings(config, old.settings), updatedAt: new Date().toISOString() };
    return next;
  });
  globalThis.chrome?.runtime?.sendMessage?.({ type:'EXTENSIFY_SYNC_ADDON', addonId:id }).catch(() => {});
}

export async function uninstallAddon(id) {
  const existing=await (await import('../storage/state.js')).getInstalledAddon(id);
  const result = await updateState(state => { delete state.addons[id]; return state; });
  globalThis.chrome?.runtime?.sendMessage?.({ type:'EXTENSIFY_SYNC_ADDON', addonId:id, removedAddon:existing }).catch(() => {});
  return result;
}

export async function updateAddonSettings(id, settings) {
  return updateState(state => { if (state.addons[id]) state.addons[id].settings = { ...state.addons[id].settings, ...settings }; return state; });
}
