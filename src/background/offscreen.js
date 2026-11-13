const SERVICE_WORKER_URL = chrome.runtime.getURL('src/background/service-worker.js');
const SANDBOX_URL = chrome.runtime.getURL('src/background/sandbox.html');
const frames = new Map();
let nextRequestId = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.url !== SERVICE_WORKER_URL) return;
  if (message?.type === 'EXTENSIFY_BACKGROUND_RECONCILE') {
    reconcile(message.addons ?? []).then(() => message.event ? dispatchEvent(message.event) : null)
      .then(() => sendResponse({ ok: true, active: frames.size }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === 'EXTENSIFY_BACKGROUND_EVENT') {
    dispatchEvent(message.event).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

window.addEventListener('message', event => {
  const record = [...frames.values()].find(item => item.frame.contentWindow === event.source);
  if (!record || event.data?.type !== 'EXTENSIFY_BACKGROUND_API') return;
  const { requestId, method, args } = event.data;
  chrome.runtime.sendMessage({ type: 'EXTENSIFY_BACKGROUND_API', addonId: record.addon.id, method, args })
    .then(response => record.frame.contentWindow?.postMessage({ type: 'EXTENSIFY_BACKGROUND_API_RESULT', requestId, response }, '*'))
    .catch(error => record.frame.contentWindow?.postMessage({ type: 'EXTENSIFY_BACKGROUND_API_RESULT', requestId, response: { error: error.message } }, '*'));
});

async function reconcile(addons) {
  const desired = new Map(addons.filter(addon => addon?.id && typeof addon.source === 'string').map(addon => [addon.id, addon]));
  for (const [id, record] of frames) if (!desired.has(id)) destroyFrame(record);
  for (const [id, addon] of desired) {
    const signature = JSON.stringify([addon.version, addon.source, addon.settings, addon.permissions]);
    const existing = frames.get(id);
    if (existing?.signature === signature) continue;
    if (existing) destroyFrame(existing);
    const record = await createFrame(addon, signature);
    try { await requestFrame(record, { type: 'EXTENSIFY_BACKGROUND_LOAD', addon }); }
    catch (error) {
      destroyFrame(record);
      console.warn(`[Extensify] Background addon ${id} failed to start:`, error);
    }
  }
}

async function createFrame(addon, signature) {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.title = `Extensify background: ${addon.id}`;
  frame.setAttribute('sandbox', 'allow-scripts');
  const record = { addon, frame, signature, pending: new Map() };
  frames.set(addon.id, record);
  const loaded = new Promise((resolve, reject) => {
    frame.addEventListener('load', resolve, { once: true });
    frame.addEventListener('error', () => reject(new Error('Could not load background sandbox.')), { once: true });
  });
  document.body.append(frame);
  frame.src = SANDBOX_URL;
  await loaded;
  return record;
}

function requestFrame(record, message) {
  const requestId = ++nextRequestId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      record.pending.delete(requestId);
      reject(new Error('Background sandbox did not respond.'));
    }, 15000);
    record.pending.set(requestId, { resolve, reject, timeout });
    record.frame.contentWindow.postMessage({ ...message, requestId }, '*');
  });
}

function dispatchEvent(event) {
  if (!event?.name) return Promise.resolve();
  const deliveries = [];
  for (const record of frames.values()) {
    if (event.targetAddonId && record.addon.id !== event.targetAddonId) continue;
    if (['tabCreated', 'tabUpdated', 'tabRemoved'].includes(event.name) && !record.addon.permissions.includes('tabs')) continue;
    if (event.name === 'alarm' && !record.addon.permissions.includes('alarms')) continue;
    deliveries.push(requestFrame(record, { type: 'EXTENSIFY_BACKGROUND_EVENT', event }).catch(error => console.warn(`[Extensify] Background event failed for ${record.addon.id}:`, error)));
  }
  return Promise.all(deliveries);
}

function destroyFrame(record) {
  if (frames.get(record.addon.id) === record) frames.delete(record.addon.id);
  record.frame.remove();
  for (const pending of record.pending.values()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Background sandbox was replaced.'));
  }
  record.pending.clear();
}

window.addEventListener('message', event => {
  const record = [...frames.values()].find(item => item.frame.contentWindow === event.source);
  if (!record || event.data?.type !== 'EXTENSIFY_BACKGROUND_ACK') return;
  const pending = record.pending.get(event.data.requestId);
  if (!pending) return;
  record.pending.delete(event.data.requestId);
  clearTimeout(pending.timeout);
  if (event.data.error) pending.reject(new Error(event.data.error));
  else pending.resolve(event.data.value);
});