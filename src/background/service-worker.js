import { getState, updateState } from '../storage/state.js';
import { matchesUrl } from '../addons/validation.js';
import { buildUserScript } from '../runtime/user-script.js';

const BACKGROUND_HOST_URL = 'src/background/offscreen.html';
const BACKGROUND_ALARM_PREFIX = 'extensify-addon:';
let backgroundHostCreation = null;
let backgroundHostReady = false;
let activeBackgroundAddonCount = 0;
let contextMenuClickListenerAttached = false;

chrome.runtime.onInstalled.addListener(() => {
  rebuildRegisteredScripts().catch(report);
  syncBackgroundAddons({ name: 'extensionInstalled' }).catch(report);
});
chrome.runtime.onStartup.addListener(() => {
  rebuildRegisteredScripts().catch(report);
  syncBackgroundAddons({ name: 'browserStartup' }).catch(report);
});
chrome.tabs.onCreated.addListener(tab => dispatchBackgroundEvent('tabCreated', pickTab(tab)).catch(report));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => dispatchBackgroundEvent('tabUpdated', { tabId, changeInfo, tab: pickTab(tab) }).catch(report));
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => dispatchBackgroundEvent('tabRemoved', { tabId, removeInfo }).catch(report));
chrome.alarms.onAlarm.addListener(alarm => dispatchAlarm(alarm).catch(report));
attachContextMenuClickListener();
chrome.permissions.onAdded.addListener(() => {
  attachContextMenuClickListener();
  rebuildContextMenus().catch(report);
});
chrome.permissions.onRemoved.addListener(() => rebuildContextMenus().catch(report));
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EXTENSIFY_SYNC_ADDON') {
    syncAddon(message.addonId, message.removedAddon ?? null).then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === 'EXTENSIFY_SYNC_BACKGROUND_ADDON') {
    syncBackgroundAddons().then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === 'EXTENSIFY_BACKGROUND_API') {
    if (_sender.url !== chrome.runtime.getURL(BACKGROUND_HOST_URL)) {
      sendResponse({ error: 'Background API requests must come from Extensify’s background host.' });
      return false;
    }
    handleBackgroundApi(message).then(value => sendResponse({ value })).catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

chrome.runtime.onUserScriptMessage.addListener((message, _sender, sendResponse) => {
  handleUserScriptMessage(message).then(value => sendResponse({ value })).catch(error => sendResponse({ error: error.message }));
  return true;
});

async function requireUserScripts() {
  if (!chrome.userScripts) throw new Error('Enable “Allow User Scripts” in this extension’s Chrome details page to run addons.');
  try { await chrome.userScripts.getScripts(); }
  catch { throw new Error('Enable “Allow User Scripts” in this extension’s Chrome details page, then reload the extension.'); }
}

async function rebuildRegisteredScripts() {
  await requireUserScripts();
  const registered = await chrome.userScripts.getScripts();
  if (registered.length) await chrome.userScripts.unregister({ ids: registered.map(script => script.id) });
  const state = await getState();
  const scripts = [];
  for (const addon of Object.values(state.addons)) {
    if (!addon.enabled) continue;
    const worldId = worldIdFor(addon.id);
    await chrome.userScripts.configureWorld({ worldId, messaging: true });
    for (const [index, entry] of (addon.config.contentScripts ?? []).entries()) {
      const origins = requestedOrigins(entry.matches ?? []);
      if (!origins.length || !await chrome.permissions.contains({ origins })) continue;
      const sources = (entry.js ?? []).map(path => addon.files[path]).filter(source => typeof source === 'string');
      if (sources.length || (entry.css ?? []).length) scripts.push({ id: scriptId(addon.id, index, 'runtime'), matches: entry.matches, allFrames: Boolean(entry.allFrames), runAt: entry.runAt ?? 'document_idle', world: 'USER_SCRIPT', worldId, js: [{ code: buildUserScript(addon, sources.join('\n'), entry.css ?? [], runtimeInstanceId(addon.id, index)) }] });
    }
  }
  if (scripts.length) await chrome.userScripts.register(scripts);
  await rebuildContextMenus();
  return { registered: scripts.length };
}

async function rebuildContextMenus() {
  if (!await chrome.permissions.contains({ permissions: ['contextMenus'] })) return;
  await chrome.contextMenus.removeAll();
  const state = await getState();
  for (const addon of Object.values(state.addons)) {
    if (!addon.enabled || !addon.config.permissions?.includes('contextMenus')) continue;
    for (const [index, action] of (addon.config.contextMenus ?? []).entries()) {
      const matches = action.matches ?? ['<all_urls>'];
      const origins = requestedOrigins(matches);
      if (!origins.length || !await chrome.permissions.contains({ origins })) continue;
      const properties = { id: contextMenuId(addon.id, index), title: action.title, contexts: ['all'] };
      if (action.matches) properties.documentUrlPatterns = action.matches;
      chrome.contextMenus.create(properties, () => {
        if (chrome.runtime.lastError) console.warn('[Extensify] Could not register context menu:', chrome.runtime.lastError.message);
      });
    }
  }
}

function attachContextMenuClickListener() {
  if (contextMenuClickListenerAttached || !chrome.contextMenus?.onClicked) return;
  chrome.contextMenus.onClicked.addListener((info, tab) => runContextMenuAction(info.menuItemId, tab).catch(report));
  contextMenuClickListenerAttached = true;
}

async function runContextMenuAction(menuItemId, tab) {
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) return;
  const state = await getState();
  for (const addon of Object.values(state.addons)) {
    if (!addon.enabled || !addon.config.permissions?.includes('contextMenus')) continue;
    for (const [index, action] of (addon.config.contextMenus ?? []).entries()) {
      if (contextMenuId(addon.id, index) !== menuItemId) continue;
      const matches = action.matches ?? ['<all_urls>'];
      if (!matches.some(pattern => matchesUrl(pattern, tab.url))) return;
      const origins = requestedOrigins(matches);
      if (!await chrome.permissions.contains({ origins })) return;
      const source = addon.files[action.js];
      if (typeof source !== 'string') return;
      await chrome.userScripts.execute({ target: { tabId: tab.id }, world: 'USER_SCRIPT', worldId: worldIdFor(addon.id), js: [{ code: buildUserScript(addon, source, [], `menu-${action.id}`) }] });
      return;
    }
  }
}

async function syncAddon(addonId, removedAddon) {
  await rebuildRegisteredScripts();
  await syncBackgroundAddons();
  const state = await getState();
  const addon = state.addons[addonId] ?? removedAddon;
  if (!addon) return { synced: 0 };
  const tabs = await chrome.tabs.query({});
  let synced = 0;
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !/^https?:/.test(tab.url)) continue;
    const entries = (addon.config.contentScripts ?? []).filter(entry => entry.matches?.some(pattern => matchesUrl(pattern, tab.url)));
    if (!entries.length) continue;
    try {
      for (const [index, entry] of (addon.config.contentScripts ?? []).entries()) if (entry.matches?.some(pattern => matchesUrl(pattern, tab.url))) {
        const instanceId = runtimeInstanceId(addonId, index);
        const instanceJson = JSON.stringify(instanceId);
        const stylePrefixJson = JSON.stringify(`extensify-style-${instanceId}`);
        const cleanupCode = `globalThis.__extensifyDisposers?.[${instanceJson}]?.(); delete globalThis.__extensifyDisposers?.[${instanceJson}]; document.querySelectorAll('[id^=' + ${stylePrefixJson} + ']').forEach(style => style.remove());`;
        await chrome.userScripts.execute({ target: { tabId: tab.id, allFrames: Boolean(entry.allFrames) }, world: 'USER_SCRIPT', worldId: worldIdFor(addonId), js: [{ code: cleanupCode }] });
        if (addon.enabled && !removedAddon) {
          const sources = (entry.js ?? []).map(path => addon.files[path]).filter(source => typeof source === 'string');
          if (sources.length || entry.css?.length) await chrome.userScripts.execute({ target: { tabId: tab.id, allFrames: Boolean(entry.allFrames) }, world: 'USER_SCRIPT', worldId: worldIdFor(addonId), js: [{ code: buildUserScript(addon, sources.join('\n'), entry.css ?? [], instanceId) }] });
        }
      }
      synced++;
    } catch (error) { console.warn(`[Extensify] Could not update open tab ${tab.id}:`, error); }
  }
  return { synced };
}

async function dispatchBackgroundEvent(name, detail, targetAddonId = null) {
  if (backgroundHostReady && !activeBackgroundAddonCount) return;
  const event = { name, detail, targetAddonId };
  if (backgroundHostReady) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'EXTENSIFY_BACKGROUND_EVENT', event });
      if (!response?.error) return response;
    } catch { backgroundHostReady = false; }
  }
  return syncBackgroundAddons(event);
}

async function dispatchAlarm(alarm) {
  if (!alarm?.name?.startsWith(BACKGROUND_ALARM_PREFIX)) return;
  const state = await getState();
  const addonId = Object.keys(state.addons).find(id => alarm.name.startsWith(backgroundAlarmPrefix(id)));
  if (!addonId) return;
  return dispatchBackgroundEvent('alarm', {
    name: alarm.name.slice(backgroundAlarmPrefix(addonId).length),
    scheduledTime: alarm.scheduledTime,
    periodInMinutes: alarm.periodInMinutes
  }, addonId);
}

async function syncBackgroundAddons(event = null) {
  const state = await getState();
  const addons = Object.values(state.addons).filter(addon => addon.enabled && addon.config?.permissions?.includes('background') && addon.config.background)
    .map(addon => ({
      id: addon.id,
      version: addon.version,
      source: addon.files[addon.config.background],
      settings: addon.settings ?? {},
      permissions: addon.config.permissions
    })).filter(addon => typeof addon.source === 'string');
  activeBackgroundAddonCount = addons.length;

  const enabledIds = new Set(addons.map(addon => addon.id));
  for (const alarm of await chrome.alarms.getAll()) {
    if (!alarm.name.startsWith(BACKGROUND_ALARM_PREFIX)) continue;
    const addonId = Object.keys(state.addons).find(id => alarm.name.startsWith(backgroundAlarmPrefix(id)));
    if (!addonId || !enabledIds.has(addonId)) await chrome.alarms.clear(alarm.name);
  }

  if (!addons.length) {
    await closeBackgroundHost();
    backgroundHostReady = true;
    return { started: 0 };
  }

  await ensureBackgroundHost();
  const response = await chrome.runtime.sendMessage({ type: 'EXTENSIFY_BACKGROUND_RECONCILE', addons, event });
  if (response?.error) throw new Error(response.error);
  backgroundHostReady = true;
  return response ?? { started: 0 };
}

async function ensureBackgroundHost() {
  if (backgroundHostCreation) return backgroundHostCreation;
  backgroundHostCreation = (async () => {
    const documentUrl = chrome.runtime.getURL(BACKGROUND_HOST_URL);
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [documentUrl] });
    if (!contexts.length) await chrome.offscreen.createDocument({
      url: BACKGROUND_HOST_URL,
      reasons: ['IFRAME_SCRIPTING'],
      justification: 'Host one isolated background context for enabled Extensify addons and broker browser events.'
    });
  })();
  try { await backgroundHostCreation; }
  finally { backgroundHostCreation = null; }
}

async function closeBackgroundHost() {
  const documentUrl = chrome.runtime.getURL(BACKGROUND_HOST_URL);
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [documentUrl] });
  if (contexts.length) await chrome.offscreen.closeDocument();
}

async function handleBackgroundApi(message) {
  const { addonId, method, args = [] } = message ?? {};
  const state = await getState();
  const addon = state.addons[addonId];
  if (!addon?.enabled || !addon.config?.background || !addon.config.permissions?.includes('background')) throw new Error('Addon background runtime is unavailable.');
  if (!Array.isArray(args)) throw new Error('Invalid background API arguments.');

  if (method?.startsWith('storage.')) {
    if (!addon.config.permissions.includes('storage')) throw new Error('Addon storage permission is unavailable.');
    const [key, value] = args;
    return handleUserScriptMessage({ addonId, method: method.slice('storage.'.length), key, value });
  }
  if (method?.startsWith('tabs.')) {
    if (!addon.config.permissions.includes('tabs')) throw new Error('Addon tabs permission is unavailable.');
    if (method === 'tabs.query') return chrome.tabs.query(args[0] ?? {});
    if (method === 'tabs.update') return chrome.tabs.update(args[0], args[1] ?? {});
    if (method === 'tabs.create') return chrome.tabs.create(args[0] ?? {});
  }
  if (method?.startsWith('alarms.')) {
    if (!addon.config.permissions.includes('alarms')) throw new Error('Addon alarms permission is unavailable.');
    const [name, alarmInfo] = args;
    if (typeof name !== 'string' || !/^[\w.-]{1,80}$/.test(name)) throw new Error('Alarm names must be 1 to 80 letters, numbers, dots, underscores, or hyphens.');
    if (method === 'alarms.create') return chrome.alarms.create(backgroundAlarmPrefix(addonId) + name, alarmInfo ?? {});
    if (method === 'alarms.clear') return chrome.alarms.clear(backgroundAlarmPrefix(addonId) + name);
  }
  throw new Error('Unsupported background API operation.');
}

function backgroundAlarmPrefix(addonId) { return `${BACKGROUND_ALARM_PREFIX}${addonId}:`; }
function pickTab(tab) { return Object.fromEntries(Object.entries(tab ?? {}).filter(([, value]) => value !== undefined)); }

async function handleUserScriptMessage(message) {
  const { addonId, method, key, value } = message ?? {};
  if (!addonId || typeof key !== 'string' || key.length > 200) throw new Error('Invalid addon storage request.');
  const state = await getState();
  const addon = state.addons[addonId];
  if (!addon?.enabled || !addon.config.permissions.includes('storage')) throw new Error('Addon storage permission is unavailable.');
  if (method === 'get') return addon.storage?.[key] ?? null;
  if (!['set', 'remove'].includes(method)) throw new Error('Unsupported storage operation.');
  const storage = { ...(addon.storage ?? {}) };
  if (method === 'set') storage[key] = value;
  else delete storage[key];
  if (new TextEncoder().encode(JSON.stringify(storage)).byteLength > 1024 * 1024) throw new Error('Addon storage is limited to 1 MB per addon.');
  await updateState(next => { if (next.addons[addonId]) next.addons[addonId].storage = storage; return next; });
  return method === 'set' ? value : null;
}

function requestedOrigins(matches) { return [...new Set(matches.flatMap(pattern => pattern === '<all_urls>' ? ['http://*/*','https://*/*'] : [pattern]).filter(pattern => /^https?:\/\//.test(pattern) || pattern.startsWith('*://')))]; }
function scriptId(addonId, index, file) { return `ext-${addonId}-${index}-${file.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 32)}`.slice(0, 100); }
function worldIdFor(addonId) { return `extensify-${addonId}`; }
function runtimeInstanceId(addonId, index) { return `${addonId}-${index}`; }
function contextMenuId(addonId, index) { return `ext-menu-${addonId}-${index}`.slice(0, 100); }
function report(error) { console.warn('[Extensify] User script registration failed:', error); }
