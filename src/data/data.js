import { CURRENT_SCHEMA_VERSION, getState, migrateState, updateState, STATE_KEY } from '../storage/state.js';
import { validatePackage } from '../addons/validation.js';
import { clearAuthSession } from '../auth/session.js';

export const EXPORT_FORMAT = 'extensify-user-data';
export async function exportData() {
  return { format: EXPORT_FORMAT, version: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), state: await getState() };
}
export function validateImport(payload) {
  if (!payload || payload.format !== EXPORT_FORMAT || !payload.state || typeof payload.state !== 'object') throw new Error('This file is not a valid Extensify data export.');
  if (!Number.isInteger(payload.version) || payload.version < 1 || payload.version > CURRENT_SCHEMA_VERSION) throw new Error('This export uses an unsupported data version.');
  const restored=migrateState(payload.state);
  for(const [id,addon] of Object.entries(restored.addons)){
    if(!addon||addon.id!==id)throw new Error(`Installed addon record does not match its ID: ${id}`);
    const checked=validatePackage(addon.config,addon.files);
    if(!checked.valid)throw new Error(`Addon ${id} could not be restored:\n${checked.errors.join('\n')}`);
    addon.files=checked.files;
    addon.settings=Object.fromEntries(Object.entries(addon.settings??{}).filter(([key])=>Object.hasOwn(addon.config.env??{},key)));
  }
  return restored;
}
export async function importData(payload) {
  const restored = validateImport(payload);
  await updateState(() => restored);
  return restored;
}
export async function resetData() {
  await clearAuthSession();
  const empty = migrateState({ schemaVersion: CURRENT_SCHEMA_VERSION });
  if (globalThis.chrome?.storage?.local) await chrome.storage.local.remove(STATE_KEY);
  else globalThis.localStorage?.removeItem(STATE_KEY);
  await updateState(() => empty);
}
