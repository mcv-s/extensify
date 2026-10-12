import { upgradeAddonPackage } from '../addons/metadata.js';
import { saveAuthSession } from '../auth/session.js';

export const STATE_KEY = 'extensify.state.v1';
export const CURRENT_SCHEMA_VERSION = 3;

const defaults = () => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  preferences: { theme: 'dark', sidebarCollapsed: false, sidebarBehavior: 'collapse' },
  addons: {},
  editorDrafts: {},
  auth: { user: null }
});

async function readRaw() {
  if (globalThis.chrome?.storage?.local) {
    const value = await chrome.storage.local.get(STATE_KEY);
    return value[STATE_KEY] ?? null;
  }
  try { return JSON.parse(globalThis.localStorage?.getItem(STATE_KEY) ?? 'null'); }
  catch { return null; }
}

async function writeRaw(value) {
  if (globalThis.chrome?.storage?.local) return chrome.storage.local.set({ [STATE_KEY]: value });
  globalThis.localStorage?.setItem(STATE_KEY, JSON.stringify(value));
}

export function migrateState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults();
  const state = { ...defaults(), ...value };
  state.schemaVersion = CURRENT_SCHEMA_VERSION;
  state.preferences = { ...defaults().preferences, ...(value.preferences ?? {}) };
  if (!['dark','light','system'].includes(state.preferences.theme)) state.preferences.theme = 'dark';
  state.preferences.sidebarCollapsed = Boolean(state.preferences.sidebarCollapsed);
  if (!['collapse','hide'].includes(state.preferences.sidebarBehavior)) state.preferences.sidebarBehavior = 'collapse';
  state.addons = value.addons && typeof value.addons === 'object' && !Array.isArray(value.addons) ? value.addons : {};
  state.editorDrafts = value.editorDrafts && typeof value.editorDrafts === 'object' && !Array.isArray(value.editorDrafts) ? value.editorDrafts : {};
  for (const [id, addon] of Object.entries(state.addons)) {
    if (!addon?.config || !addon?.files) continue;
    const upgraded = upgradeAddonPackage(addon.config, addon.files);
    state.addons[id] = { ...addon, config: upgraded.config, files: upgraded.files };
  }
  for (const [id, draft] of Object.entries(state.editorDrafts)) {
    if (!draft?.config || !draft?.files) continue;
    const upgraded = upgradeAddonPackage(draft.config, draft.files);
    state.editorDrafts[id] = { ...draft, config: upgraded.config, files: upgraded.files };
  }
  state.auth = { user:value.auth?.user ? { id:value.auth.user.id, email:value.auth.user.email } : null };
  return state;
}

export async function getState() {
  const raw = await readRaw();
  const migrated = migrateState(raw);
  const hasLegacySession = Boolean(raw?.auth?.accessToken || raw?.auth?.refreshToken);
  if (hasLegacySession) {
    try { await saveAuthSession(raw.auth); } catch { /* Drop legacy credentials rather than keep them in exportable state. */ }
  }
  if (!raw || raw.schemaVersion !== migrated.schemaVersion || hasLegacySession) await writeRaw(migrated);
  return migrated;
}

export async function updateState(updater) {
  const current = await getState();
  const next = migrateState(typeof updater === 'function' ? updater(structuredClone(current)) : { ...current, ...updater });
  await writeRaw(next);
  return next;
}

export const getTheme = async () => (await getState()).preferences.theme;
export const setTheme = theme => {
  if (!['dark','light','system'].includes(theme)) throw new Error('Theme must be dark, light, or system.');
  return updateState(s => ({ ...s, preferences: { ...s.preferences, theme } }));
};
export const getSidebarCollapsed = async () => Boolean((await getState()).preferences.sidebarCollapsed);
export const setSidebarCollapsed = collapsed => updateState(s => ({ ...s, preferences: { ...s.preferences, sidebarCollapsed: Boolean(collapsed) } }));
export const getSidebarBehavior = async () => (await getState()).preferences.sidebarBehavior;
export const setSidebarBehavior = behavior => {
  if (!['collapse','hide'].includes(behavior)) throw new Error('Sidebar behavior must be collapse or hide.');
  return updateState(s => ({ ...s, preferences: { ...s.preferences, sidebarBehavior: behavior } }));
};
export async function getEffectiveTheme() {
  const theme = await getTheme();
  return theme === 'system' ? (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
}
export const getInstalledAddons = async () => Object.values((await getState()).addons);
export const getInstalledAddon = async id => (await getState()).addons[id] ?? null;
export const saveDraft = (id, draft) => updateState(s => ({ ...s, editorDrafts: { ...s.editorDrafts, [id]: draft } }));
