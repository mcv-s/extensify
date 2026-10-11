import { getState, updateState } from '../storage/state.js';
import { matchesUrl } from '../addons/validation.js';
import { buildUserScript } from '../runtime/user-script.js';

chrome.runtime.onInstalled.addListener(() => rebuildRegisteredScripts().catch(report));
chrome.runtime.onStartup.addListener(() => rebuildRegisteredScripts().catch(report));
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EXTENSIFY_SYNC_ADDON') {
    syncAddon(message.addonId, message.removedAddon ?? null).then(sendResponse).catch(error => sendResponse({ error: error.message }));
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
  return { registered: scripts.length };
}

async function syncAddon(addonId, removedAddon) {
  await rebuildRegisteredScripts();
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
      if (!addon.enabled || removedAddon) {
        for (const [index, entry] of (addon.config.contentScripts ?? []).entries()) if (entry.matches?.some(pattern => matchesUrl(pattern, tab.url))) {
          const instanceId = runtimeInstanceId(addonId, index);
          await chrome.userScripts.execute({ target: { tabId: tab.id, allFrames: Boolean(entry.allFrames) }, world: 'USER_SCRIPT', worldId: worldIdFor(addonId), js: [{ code: `globalThis.__extensifyDisposers?.[${JSON.stringify(instanceId)}]?.(); delete globalThis.__extensifyDisposers?.[${JSON.stringify(instanceId)}]; document.getElementById(${JSON.stringify(`extensify-style-${instanceId}`)})?.remove();` }] });
        }
      } else {
        for (const [index, entry] of (addon.config.contentScripts ?? []).entries()) if (entry.matches?.some(pattern => matchesUrl(pattern, tab.url))) {
          const sources = (entry.js ?? []).map(path => addon.files[path]).filter(source => typeof source === 'string');
          if (sources.length || entry.css?.length) await chrome.userScripts.execute({ target: { tabId: tab.id, allFrames: Boolean(entry.allFrames) }, world: 'USER_SCRIPT', worldId: worldIdFor(addonId), js: [{ code: buildUserScript(addon, sources.join('\n'), entry.css ?? [], runtimeInstanceId(addonId, index)) }] });
        }
      }
      synced++;
    } catch (error) { console.warn(`[Extensify] Could not update open tab ${tab.id}:`, error); }
  }
  return { synced };
}

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
function report(error) { console.warn('[Extensify] User script registration failed:', error); }
