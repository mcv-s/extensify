export const AUTH_SESSION_KEY = 'extensify.auth.session.v1';

let storageProtection;
let refreshInFlight;

async function protectStorage() {
  const area = globalThis.chrome?.storage?.local;
  if (!area?.setAccessLevel) return;
  if (!storageProtection) storageProtection = area.setAccessLevel({ accessLevel:'TRUSTED_CONTEXTS' });
  await storageProtection;
}

export async function readAuthSession() {
  const area = globalThis.chrome?.storage?.local;
  if (!area) return null;
  await protectStorage();
  const stored = await area.get(AUTH_SESSION_KEY);
  return stored[AUTH_SESSION_KEY] ?? null;
}

export async function saveAuthSession(session) {
  const area = globalThis.chrome?.storage?.local;
  if (!area) throw new Error('Persistent sign-in is available in the installed extension only.');
  await protectStorage();
  const expiresAt = Number(session.expires_at ?? session.expiresAt) || Math.floor(Date.now() / 1000) + (Number(session.expires_in) || 3600);
  const next = { accessToken:session.access_token ?? session.accessToken, refreshToken:session.refresh_token ?? session.refreshToken, expiresAt };
  if (!next.accessToken || !next.refreshToken) throw new Error('Supabase did not return a refreshable sign-in session.');
  await area.set({ [AUTH_SESSION_KEY]:next });
  return next;
}

export async function clearAuthSession() {
  const area = globalThis.chrome?.storage?.local;
  if (!area) return;
  await protectStorage();
  await area.remove(AUTH_SESSION_KEY);
}

export async function refreshAuthSession(config) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = await readAuthSession();
    if (!current?.refreshToken) { await clearAuthSession(); return null; }
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method:'POST',
      headers:{ apikey:config.anonKey, 'Content-Type':'application/json' },
      body:JSON.stringify({ refresh_token:current.refreshToken })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await clearAuthSession();
      throw new Error(result.msg || result.message || 'Your Supabase session expired. Sign in again.');
    }
    return saveAuthSession(result);
  })();
  try { return await refreshInFlight; }
  finally { refreshInFlight = null; }
}

export async function getValidAccessToken(config, { forceRefresh = false } = {}) {
  const session = await readAuthSession();
  if (!session?.accessToken) return null;
  if (!forceRefresh && Number(session.expiresAt) > Math.floor(Date.now() / 1000) + 60) return session.accessToken;
  return (await refreshAuthSession(config))?.accessToken ?? null;
}

export async function authenticatedFetch(config, url, options = {}) {
  let token = await getValidAccessToken(config);
  const send = accessToken => fetch(url, {
    ...options,
    headers:{ ...options.headers, ...(accessToken ? { Authorization:`Bearer ${accessToken}` } : {}) }
  });
  let response = await send(token);
  if (response.status === 401 && token) {
    token = (await refreshAuthSession(config))?.accessToken ?? null;
    if (token) response = await send(token);
  }
  return response;
}
