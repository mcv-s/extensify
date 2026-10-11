import { getState, updateState } from '../storage/state.js';

let configPromise;
export function getSupabaseConfig() {
  if (!configPromise) configPromise = (async () => {
    const url = globalThis.chrome?.runtime?.getURL ? chrome.runtime.getURL('supabase.json') : new URL('../../supabase.json', import.meta.url);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not read supabase.json from the extension folder.');
    return response.json();
  })();
  return configPromise;
}

export async function getSupabase() {
  const config = await getSupabaseConfig();
  if (!config.url?.startsWith('https://') || !config.anonKey || config.anonKey.startsWith('YOUR_')) return null;
  return { from: table => new RestQuery(config, table), auth: authApi(config) };
}

function authApi(config) {
  return {
    signInWithPassword: async ({ email, password }) => {
      try {
        const session = await authRequest(config, 'token?grant_type=password', { email, password });
        await updateState(state => ({ ...state, auth: { user: session.user ? { id: session.user.id, email: session.user.email } : null, accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600) } }));
        return { data: session, error: null };
      } catch (error) { return { data: null, error }; }
    },
    getUser: async () => {
      const state = await getState();
      if (!state.auth?.accessToken) return { data: { user: null }, error: null };
      const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${state.auth.accessToken}` } });
      if (response.status === 401 && state.auth.refreshToken) {
        const refreshed = await authRequest(config, 'token?grant_type=refresh_token', { refresh_token: state.auth.refreshToken });
        await updateState(s => ({ ...s, auth: { ...s.auth, accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token, expiresAt: refreshed.expires_at } }));
        return { data: { user: refreshed.user }, error: null };
      }
      if (!response.ok) return { data: { user: null }, error: new Error('Your Supabase session expired. Sign in again.') };
      return { data: { user: await response.json() }, error: null };
    },
    signOut: async () => {
      try {
        const state = await getState();
        if (state.auth?.accessToken) await fetch(`${config.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${state.auth.accessToken}` } });
        return { error: null };
      } catch (error) { return { error }; }
    }
  };
}
async function authRequest(config, path, body) {
  const response = await fetch(`${config.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.message || `Supabase auth failed (${response.status}).`);
  return data;
}

export class RestQuery {
  constructor(config, table) { this.config = config; this.table = table; this.method = 'GET'; this.params = new URLSearchParams(); this.headers = {}; }
  select(columns = '*') { this.params.set('select', columns); return this; }
  eq(key, value) { this.params.set(key, `eq.${value}`); return this; }
  ilike(key, value) { this.params.set(key, `ilike.${value}`); return this; }
  in(key, values) {
    if (!Array.isArray(values) || !values.length) throw new Error('Supabase in() filters need at least one value.');
    const escaped = values.map(value => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join(',');
    this.params.set(key, `in.(${escaped})`);
    return this;
  }
  order(value) { this.params.set('order', value); return this; }
  limit(value) { this.params.set('limit', String(value)); return this; }
  single() { this.singleMode = 'required'; return this; }
  maybeSingle() { this.singleMode = 'optional'; return this; }
  upsert(row, options = {}) { this.method = 'POST'; this.body = row; if (options.onConflict) this.params.set('on_conflict', options.onConflict); this.headers.Prefer = 'resolution=merge-duplicates,return=representation'; return this; }
  insert(rows) { this.method = 'POST'; this.body = rows; this.headers.Prefer = 'return=representation'; return this; }
  update(row) { this.method = 'PATCH'; this.body = row; this.headers.Prefer = 'return=representation'; return this; }
  delete() { this.method = 'DELETE'; this.headers.Prefer = 'return=representation'; return this; }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    const state = await getState();
    const response = await fetch(`${this.config.url}/rest/v1/${this.table}?${this.params}`, { method: this.method, headers: { apikey: this.config.anonKey, ...(state.auth?.accessToken ? { Authorization: `Bearer ${state.auth.accessToken}` } : {}), 'Content-Type': 'application/json', ...this.headers }, body: this.body === undefined ? undefined : JSON.stringify(this.body) });
    const text = await response.text(); let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) return { data: null, error: new Error(data?.message || `Supabase request failed (${response.status}).`) };
    if (this.singleMode) {
      const rows = Array.isArray(data) ? data : data == null ? [] : [data];
      if (rows.length > 1) return { data: null, error: new Error('Supabase returned more than one row for a single-row query.') };
      if (rows.length === 0 && this.singleMode === 'required') return { data: null, error: new Error('No matching Supabase record was found.') };
      return { data: rows[0] ?? null, error: null };
    }
    return { data, error: null };
  }
}

export async function supabaseAuth(action, payload) {
  const config = await getSupabaseConfig();
  if (!config.url?.startsWith('https://') || !config.anonKey || config.anonKey.startsWith('YOUR_')) throw new Error('Add your Supabase URL and public anon key to supabase.json first.');
  const state = await getState();
  const response = await fetch(`${config.url}/auth/v1/${action}`, { method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json', ...(state.auth?.accessToken ? { Authorization: `Bearer ${state.auth.accessToken}` } : {}) }, body: JSON.stringify(payload ?? {}) });
  const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.msg || data?.message || `Supabase auth failed (${response.status}).`);
  return data;
}

export async function supabaseUser() {
  const config = await getSupabaseConfig(); const state = await getState();
  if (!state.auth?.accessToken) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${state.auth.accessToken}` } });
  if (!response.ok) return null;
  return response.json();
}

export async function supabaseRequest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const config = await getSupabaseConfig(); const state = await getState();
  const response = await fetch(`${config.url}/rest/v1/${path}`, { method, headers: { apikey: config.anonKey, ...(state.auth?.accessToken ? { Authorization: `Bearer ${state.auth.accessToken}` } : {}), 'Content-Type': 'application/json', Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || `Supabase request failed (${response.status}).`);
  return data;
}
