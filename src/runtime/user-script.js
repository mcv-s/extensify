export function buildUserScript(addon, source, cssPaths = [], instanceId = addon.id) {
  const id = JSON.stringify(addon.id);
  const instance = JSON.stringify(instanceId);
  const settings = JSON.stringify(addon.settings ?? {});
  const version = JSON.stringify(addon.version);
  const permissions = JSON.stringify(addon.config.permissions ?? []);
  const css = JSON.stringify(cssPaths.map(path => addon.files[path]).filter(Boolean).join('\n'));
  return `(() => {
  const addonId = ${id};
  const instanceId = ${instance};
  try { globalThis.__extensifyDisposers?.[instanceId]?.(); } catch (error) { console.warn('[Extensify cleanup]', error); }
  document.getElementById('extensify-style-' + instanceId)?.remove();
  const styleText = ${css};
  if (styleText) { const style = document.createElement('style'); style.id = 'extensify-style-' + instanceId; style.textContent = styleText; (document.head || document.documentElement).append(style); }
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
