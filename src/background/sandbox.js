const instances = new Map();
const pendingRequests = new Map();
let nextRequestId = 0;
let activePagePath = null;
let activePageFiles = null;

window.addEventListener('message', event => {
  if (event.source !== parent) return;

  const message = event.data;

  if (message?.type === 'EXTENSIFY_BACKGROUND_LOAD') {
    startAddon(message.addon)
      .then(() => acknowledge(message.requestId))
      .catch(error => acknowledge(message.requestId, null, error.message));

  } else if (message?.type === 'EXTENSIFY_PAGE_LOAD') {
    startAddon(message.addon, message.page)
      .then(() => acknowledge(message.requestId))
      .catch(error => acknowledge(message.requestId, null, error.message));

  } else if (message?.type === 'EXTENSIFY_BACKGROUND_EVENT') {
    dispatchEvent(message.event)
      .then(() => acknowledge(message.requestId))
      .catch(error => acknowledge(message.requestId, null, error.message));

  } else if (message?.type === 'EXTENSIFY_BACKGROUND_API_RESULT') {
    const pending = pendingRequests.get(message.requestId);
    if (!pending) return;

    pendingRequests.delete(message.requestId);
    clearTimeout(pending.timeout);

    if (message.response?.error) pending.reject(new Error(message.response.error));
    else pending.resolve(message.response?.value);
  }
});

async function startAddon(addon, page = null) {
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

  Object.defineProperty(globalThis, 'extensify', {
    configurable: true,
    value: api
  });

  instances.set(addon.id, { listeners, api });
  try {
    if (page) {
      await renderAddonPage(page, api);
    } else {
      const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

      await new AsyncFunction(
        'extensify',
        `"use strict";\n${addon.source}`
      )(api);
    }
  } catch (error) {
    stopAddon(addon.id);
    throw error;
  }

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



async function renderAddonPage(page, api) {
  activePagePath = page.pagePath;
  activePageFiles = page.files;
  const { html, files, pagePath } = page;

  const parsed = new DOMParser().parseFromString(html, 'text/html');

  document.title = parsed.title || api.addon.id;
  document.documentElement.lang = parsed.documentElement.lang || 'en';

  function resolvePath(reference) {
    if (
      !reference ||
      /^[a-z][a-z\d+.-]*:/i.test(reference) ||
      reference.startsWith('//') ||
      reference.startsWith('#')
    ) return null;

    try {
      reference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    } catch {
      return null;
    }

    const parts = reference.startsWith('/')
      ? []
      : pagePath.split('/').slice(0, -1);

    for (const part of reference.replaceAll('\\', '/').split('/')) {
      if (!part || part === '.') continue;

      if (part === '..') {
        if (!parts.length) return null;
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  // Load the addon's stylesheets.
  for (const link of parsed.querySelectorAll('link[rel~="stylesheet"]')) {
    const path = resolvePath(link.getAttribute('href'));
    const css = path && files[path];

    if (typeof css !== 'string') continue;

    const style = document.createElement('style');
    style.textContent = css;

    if (link.media) style.media = link.media;

    document.head.append(style);
  }

  // Preserve inline styles and metadata.
  for (const element of parsed.head.children) {
    if (
      element.tagName === 'SCRIPT' ||
      element.tagName === 'LINK' ||
      element.tagName === 'TITLE'
    ) continue;

    document.head.append(element.cloneNode(true));
  }

  // Collect scripts before removing them from the parsed document.
  const scripts = [...parsed.querySelectorAll('script')];
  const sources = [];

  for (const script of scripts) {
    if (script.type === 'module' || script.type === 'importmap') {
      console.warn('[Extensify] Module scripts are not supported yet.');
      continue;
    }

    let source = script.textContent;

    if (script.hasAttribute('src')) {
      const path = resolvePath(script.getAttribute('src'));

      if (!path || typeof files[path] !== 'string') {
        console.warn('[Extensify] Script not found:', script.getAttribute('src'));
        continue;
      }

      source = files[path];
    }

    sources.push(source);
  }

  scripts.forEach(script => script.remove());

  // Render HTML without executing scripts through innerHTML.
  document.body.innerHTML = parsed.body.innerHTML;

  // Execute all addon scripts using the existing SDK.
  if (sources.length) {
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

    await new AsyncFunction(
      'extensify',
      `"use strict";\n${sources.join('\n;\n')}`
    )(api);
  }
}








document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');

    if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        (link.target && link.target !== '_self') ||
        link.hasAttribute('download')
    ) return;

    const href = link.getAttribute('href');

    if (!href || href.startsWith('#') || !activePagePath) return;

    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return;

    try {
        const base = new URL(activePagePath, 'https://addon.invalid/');
        const target = new URL(href, base);

        if (target.origin !== base.origin) return;

        let targetPath = decodeURIComponent(target.pathname.slice(1));

        if (!targetPath.toLowerCase().endsWith('.html')) {
            targetPath += '.html';
        }

        if (typeof activePageFiles?.[targetPath] !== 'string') {
            console.warn('[Extensify] Addon page not found:', targetPath);
            event.preventDefault();
            return;
        }

        event.preventDefault();

        parent.postMessage({
            type: 'EXTENSIFY_PAGE_NAVIGATE',
            pagePath: targetPath
        }, '*');

    } catch (error) {
        console.warn('[Extensify] Invalid addon page link:', error);
    }
});