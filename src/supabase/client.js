import { updateState } from '../storage/state.js';
import { authenticatedFetch, clearAuthSession, getValidAccessToken, readAuthSession, saveAuthSession } from '../auth/session.js';

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
        await saveAuthSession(session);
        await updateState(state => ({ ...state, auth: { user: session.user ? { id: session.user.id, email: session.user.email } : null } }));
        return { data: session, error: null };
      } catch (error) { return { data: null, error }; }
    },
    getUser: async () => {
      try {
        const token = await getValidAccessToken(config);
        if (!token) {
          await updateState(state => ({ ...state, auth:{ user:null } }));
          return { data: { user: null }, error: null };
        }
        const response = await authenticatedFetch(config, `${config.url}/auth/v1/user`, { headers:{ apikey:config.anonKey } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) {
            await clearAuthSession();
            await updateState(state => ({ ...state, auth:{ user:null } }));
            return { data:{ user:null }, error:null };
          }
          return { data:{ user:null }, error:new Error(result.message || 'Could not check your Supabase session.') };
        }
        await updateState(state => ({ ...state, auth:{ user:result ? { id:result.id, email:result.email } : null } }));
        return { data:{ user:result }, error:null };
      } catch (error) {
        // Keep the local identity/session through temporary network errors; an
        // invalid refresh token is already cleared by refreshAuthSession.
        if (!await readAuthSession()) await updateState(state => ({ ...state, auth:{ user:null } }));
        return { data:{ user:null }, error };
      }
    },
    signOut: async () => {
      try {
        const token = await getValidAccessToken(config);
        if (token) await fetch(`${config.url}/auth/v1/logout`, { method:'POST', headers:{ apikey:config.anonKey, Authorization:`Bearer ${token}` } });
        await clearAuthSession();
        return { error: null };
      } catch { await clearAuthSession(); return { error:null }; }
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
    const response = await authenticatedFetch(this.config, `${this.config.url}/rest/v1/${this.table}?${this.params}`, { method:this.method, headers:{ apikey:this.config.anonKey, 'Content-Type':'application/json', ...this.headers }, body:this.body === undefined ? undefined : JSON.stringify(this.body) });
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
  const response = await authenticatedFetch(config, `${config.url}/auth/v1/${action}`, { method:'POST', headers:{ apikey:config.anonKey, 'Content-Type':'application/json' }, body:JSON.stringify(payload ?? {}) });
  const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.msg || data?.message || `Supabase auth failed (${response.status}).`);
  return data;
}

export async function supabaseUser() {
  const config = await getSupabaseConfig(); const token = await getValidAccessToken(config);
  if (!token) return null;
  const response = await authenticatedFetch(config, `${config.url}/auth/v1/user`, { headers:{ apikey:config.anonKey } });
  if (!response.ok) return null;
  return response.json();
}

export async function supabaseRequest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const config = await getSupabaseConfig();
  const response = await authenticatedFetch(config, `${config.url}/rest/v1/${path}`, { method, headers:{ apikey:config.anonKey, 'Content-Type':'application/json', Prefer:prefer }, body:body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || `Supabase request failed (${response.status}).`);
  return data;
}
