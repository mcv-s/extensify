const instances = new Map();
const pendingRequests = new Map();
let nextRequestId = 0;

window.addEventListener('message', event => {
  if (event.source !== parent) return;
  const message = event.data;
  if (message?.type === 'EXTENSIFY_BACKGROUND_LOAD') {
    startAddon(message.addon)
      .then(() => acknowledge(message.requestId))
      .catch(error => acknowledge(message.requestId, null, error.message));
  } else if (message?.type === 'EXTENSIFY_BACKGROUND_EVENT') {
    dispatchEvent(message.event).then(() => acknowledge(message.requestId)).catch(error => acknowledge(message.requestId, null, error.message));
  } else if (message?.type === 'EXTENSIFY_BACKGROUND_API_RESULT') {
    const pending = pendingRequests.get(message.requestId);
    if (!pending) return;
    pendingRequests.delete(message.requestId);
    clearTimeout(pending.timeout);
    if (message.response?.error) pending.reject(new Error(message.response.error));
    else pending.resolve(message.response?.value);
  }
});

async function startAddon(addon) {
  stopAddon(addon.id);
  const listeners = new Map();
  const permissions = Object.freeze([...addon.permissions]);
  const request = (method, args) => new Promise((resolve, reject) => {
    const requestId = ++nextRequestId;
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Background API request timed out.'));
    }, 30000);
    pendingRequests.set(requestId, { resolve, reject, timeout });
    parent.postMessage({ type: 'EXTENSIFY_BACKGROUND_API', requestId, method, args }, '*');
  });
  const api = Object.freeze({
    apiVersion: 1,
    addon: Object.freeze({ id: addon.id, version: addon.version }),
    permissions,
    settings: Object.freeze(structuredClone(addon.settings ?? {})),
    on(name, callback) {
      if (!['start', 'browserStartup', 'extensionInstalled', 'tabCreated', 'tabUpdated', 'tabRemoved', 'alarm'].includes(name) || typeof callback !== 'function') throw new Error('Unsupported background event listener.');
      const callbacks = listeners.get(name) ?? new Set();
      callbacks.add(callback);
      listeners.set(name, callbacks);
      return () => callbacks.delete(callback);
    },
    storage: Object.freeze({
      get: (key, fallback = null) => request('storage.get', [key]).then(value => value == null ? fallback : value),
      set: (key, value) => request('storage.set', [key, value]),
      remove: key => request('storage.remove', [key])
    }),
    tabs: Object.freeze({
      query: queryInfo => request('tabs.query', [queryInfo ?? {}]),
      update: (tabId, properties) => request('tabs.update', [tabId, properties ?? {}]),
      create: properties => request('tabs.create', [properties ?? {}])
    }),
    alarms: Object.freeze({
      create: (name, alarmInfo) => request('alarms.create', [name, alarmInfo ?? {}]),
      clear: name => request('alarms.clear', [name])
    }),
    log: Object.freeze({
      info: (...args) => console.info(`[Extensify:${addon.id}:background]`, ...args),
      warn: (...args) => console.warn(`[Extensify:${addon.id}:background]`, ...args),
      error: (...args) => console.error(`[Extensify:${addon.id}:background]`, ...args)
    })
  });
  instances.set(addon.id, { listeners, api });
  try {
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    await new AsyncFunction('extensify', `"use strict";\n${addon.source}`)(api);
  }
  catch (error) { stopAddon(addon.id); throw error; }
  await dispatchToAddon(addon.id, { name: 'start', detail: {} });
}

function stopAddon(addonId) {
  const instance = instances.get(addonId);
  if (!instance) return;
  instances.delete(addonId);
  for (const callbacks of instance.listeners.values()) callbacks.clear();
  for (const [requestId, pending] of pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Background addon was stopped.'));
    pendingRequests.delete(requestId);
  }
}

async function dispatchEvent(event) {
  if (!event?.name) return;
  if (event.name === 'start') return;
  const instanceIds = event.targetAddonId ? [event.targetAddonId] : [...instances.keys()];
  await Promise.all(instanceIds.map(addonId => dispatchToAddon(addonId, event)));
}

async function dispatchToAddon(addonId, event) {
  const callbacks = instances.get(addonId)?.listeners.get(event.name);
  if (!callbacks) return;
  await Promise.all([...callbacks].map(async callback => {
    try { await callback(event.detail); }
    catch (error) { console.error(`[Extensify:${addonId}:background] Event handler failed:`, error); }
  }));
}

function acknowledge(requestId, value = null, error = null) {
  parent.postMessage({ type: 'EXTENSIFY_BACKGROUND_ACK', requestId, value, error }, '*');
}