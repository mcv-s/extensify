import { addonResourceMimeTypes, bundleAddonCss } from './resources.js';

export function buildUserScript(addon, source, cssPaths = [], instanceId = addon.id) {
  const id = JSON.stringify(addon.id);
  const instance = JSON.stringify(instanceId);
  const settings = JSON.stringify(addon.settings ?? {});
  const version = JSON.stringify(addon.version);
  const permissions = JSON.stringify(addon.config.permissions ?? []);
  const css = JSON.stringify(bundleAddonCss(addon.files ?? {}, cssPaths));
  const files = JSON.stringify(addon.files ?? {});
  const mimeTypes = JSON.stringify(addonResourceMimeTypes());
  const addonStylesheets = JSON.stringify(Object.fromEntries(Object.keys(addon.files ?? {})
    .filter(path => path.toLowerCase().endsWith('.css'))
    .map(path => [path, bundleAddonCss(addon.files, [path])])));
  return `(() => {
  const addonId = ${id};
  const instanceId = ${instance};
  try { globalThis.__extensifyDisposers?.[instanceId]?.(); } catch (error) { console.warn('[Extensify cleanup]', error); }
  document.getElementById('extensify-style-' + instanceId)?.remove();
  const styleText = ${css};
  if (styleText) { const style = document.createElement('style'); style.id = 'extensify-style-' + instanceId; style.textContent = styleText; (document.head || document.documentElement).append(style); }
  const addonFiles = ${files};
  const addonMimeTypes = ${mimeTypes};
  const addonStylesheets = ${addonStylesheets};
  const addonStylePrefix = 'extensify-style-' + instanceId;
  document.querySelectorAll('[id^="' + addonStylePrefix + '-resource-"]').forEach(style => style.remove());
  const resourceState = globalThis.__extensifyAddonResourceState ??= { patched:false, linkPaths:new WeakMap(), linkStyles:new WeakMap(), linkStyleNumber:0 };
  resourceState.files = addonFiles;
  resourceState.mimeTypes = addonMimeTypes;
  resourceState.stylesheets = addonStylesheets;
  resourceState.stylePrefix = addonStylePrefix;
  if (!resourceState.patched) {
    resourceState.nativeFetch = globalThis.fetch.bind(globalThis);
    resourceState.resolveFile = input => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
      if (typeof raw !== 'string' || /^(?:data:|blob:|\\/\\/|#)/i.test(raw)) return null;
      let localReference = raw;
      if (/^[a-z][a-z\\d+.-]*:/i.test(raw)) {
        try {
          const requestedUrl = new URL(raw);
          if (requestedUrl.origin !== globalThis.location?.origin) return null;
          localReference = requestedUrl.pathname;
        } catch { return null; }
      }
      let path = localReference.trim().split(/[?#]/, 1)[0];
      try { path = decodeURIComponent(path); } catch { return null; }
      path = path.replaceAll('\\\\', '/');
      const parts = [];
      for (const part of path.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') { if (!parts.length) return null; parts.pop(); }
        else parts.push(part);
      }
      const candidate = parts.join('/');
      return Object.hasOwn(resourceState.files, candidate) ? candidate : null;
    };
    const hrefDescriptor = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href');
    const relDescriptor = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'rel');
    resourceState.mountLink = link => {
      const path = resourceState.linkPaths.get(link);
      const cssText = path && resourceState.stylesheets[path];
      if (cssText == null) return false;
      relDescriptor?.set?.call(link, 'extensify-addon-style');
      hrefDescriptor?.set?.call(link, 'about:blank');
      if (!link.isConnected) return true;
      let style = resourceState.linkStyles.get(link);
      if (!style) {
        style = document.createElement('style');
        style.id = resourceState.stylePrefix + '-resource-' + (++resourceState.linkStyleNumber);
        resourceState.linkStyles.set(link, style);
        (document.head || document.documentElement).append(style);
      }
      style.textContent = cssText;
      if (link.media) style.media = link.media;
      queueMicrotask(() => link.dispatchEvent(new Event('load')));
      return true;
    };
    resourceState.removeLinkStyle = link => {
      resourceState.linkStyles.get(link)?.remove();
      resourceState.linkStyles.delete(link);
    };
    const isAddonLink = node => node?.tagName === 'LINK' && resourceState.linkPaths.has(node);
    const mountAddedAddonLinks = nodes => { for (const node of nodes) if (isAddonLink(node)) resourceState.mountLink(node); };
    const nativeAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function(node) { const result = nativeAppendChild.call(this, node); mountAddedAddonLinks([node]); return result; };
    const nativeInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(node, reference) { const result = nativeInsertBefore.call(this, node, reference); mountAddedAddonLinks([node]); return result; };
    const nativeReplaceChild = Node.prototype.replaceChild;
    Node.prototype.replaceChild = function(node, oldNode) { const result = nativeReplaceChild.call(this, node, oldNode); resourceState.removeLinkStyle(oldNode); mountAddedAddonLinks([node]); return result; };
    const nativeRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function(node) { resourceState.removeLinkStyle(node); return nativeRemoveChild.call(this, node); };
    const nativeAppend = Element.prototype.append;
    if (nativeAppend) Element.prototype.append = function(...nodes) { const result = nativeAppend.apply(this, nodes); mountAddedAddonLinks(nodes); return result; };
    const nativePrepend = Element.prototype.prepend;
    if (nativePrepend) Element.prototype.prepend = function(...nodes) { const result = nativePrepend.apply(this, nodes); mountAddedAddonLinks(nodes); return result; };
    const nativeSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (this.tagName === 'LINK' && String(name).toLowerCase() === 'href') {
        const path = resourceState.resolveFile(value);
        if (path && Object.hasOwn(resourceState.stylesheets, path)) {
          resourceState.linkPaths.set(this, path);
          resourceState.mountLink(this);
          return;
        }
      }
      if (this.tagName === 'LINK' && String(name).toLowerCase() === 'rel' && resourceState.linkPaths.has(this) && /(?:^|\\s)stylesheet(?:\\s|$)/i.test(String(value))) value = 'extensify-addon-style';
      return nativeSetAttribute.call(this, name, value);
    };
    if (hrefDescriptor?.get && hrefDescriptor?.set) Object.defineProperty(HTMLLinkElement.prototype, 'href', {
      configurable:hrefDescriptor.configurable, enumerable:hrefDescriptor.enumerable, get:hrefDescriptor.get,
      set(value) {
        const path = resourceState.resolveFile(value);
        if (path && Object.hasOwn(resourceState.stylesheets, path)) {
          resourceState.linkPaths.set(this, path);
          resourceState.mountLink(this);
          return;
        }
        resourceState.removeLinkStyle(this);
        resourceState.linkPaths.delete(this);
        hrefDescriptor.set.call(this, value);
      }
    });
    if (relDescriptor?.get && relDescriptor?.set) Object.defineProperty(HTMLLinkElement.prototype, 'rel', {
      configurable:relDescriptor.configurable, enumerable:relDescriptor.enumerable, get:relDescriptor.get,
      set(value) { relDescriptor.set.call(this, resourceState.linkPaths.has(this) && /(?:^|\\s)stylesheet(?:\\s|$)/i.test(String(value)) ? 'extensify-addon-style' : value); }
    });
    globalThis.fetch = (input, init) => {
      const path = resourceState.resolveFile(input);
      if (!path) return resourceState.nativeFetch(input, init);
      const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') return Promise.resolve(new Response(null, { status:405, headers:{ 'Allow':'GET, HEAD' } }));
      const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
      const contentType = resourceState.mimeTypes[extension] ?? 'application/octet-stream';
      return Promise.resolve(new Response(method === 'HEAD' ? null : resourceState.files[path], { status:200, headers:{ 'Content-Type':contentType, 'X-Extensify-Addon-File':path } }));
    };
    resourceState.patched = true;
  }
  const declaredPermissions = Object.freeze(${permissions});
  let dispose = null;
  const request = async (method, key, value) => {
    const response = await chrome.runtime.sendMessage({ type: 'EXTENSIFY_ADDON_STORAGE', addonId, method, key, value });
    if (response?.error) throw new Error(response.error);
    return response?.value;
  };
  const runtime = Object.freeze({
    apiVersion: 1,
    addon: Object.freeze({ id: addonId, version: ${version} }),
    permissions: declaredPermissions,
    settings: Object.freeze(${settings}),
    storage: Object.freeze({ get: (key, fallback = null) => request('get', key).then(value => value == null ? fallback : value), set: (key, value) => request('set', key, value), remove: key => request('remove', key) }),
    log: Object.freeze({ info: (...args) => console.info('[Extensify:' + addonId + ']', ...args), warn: (...args) => console.warn('[Extensify:' + addonId + ']', ...args), error: (...args) => console.error('[Extensify:' + addonId + ']', ...args) }),
    hasPermission: permission => declaredPermissions.includes(permission),
    onDispose: callback => { if (typeof callback === 'function') dispose = callback; }
  });
  Object.defineProperty(globalThis, 'extensify', { configurable: true, value: runtime });
  globalThis.__extensifyDisposers ??= {};
  globalThis.__extensifyDisposers[instanceId] = () => dispose?.();
  try { (() => {
${source.split('\n').map(line => `    ${line}`).join('\n')}
  })(); } catch (error) { runtime.log.error('Addon code failed', error); }
})();`;
}
