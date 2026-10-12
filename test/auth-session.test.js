import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_SESSION_KEY, authenticatedFetch, getValidAccessToken, saveAuthSession } from '../src/auth/session.js';

function fakeStorage() {
  const values=new Map();
  return {
    values,
    async get(key){return values.has(key)?{[key]:values.get(key)}:{};},
    async set(items){for(const [key,value] of Object.entries(items))values.set(key,value);},
    async remove(key){values.delete(key);},
    async setAccessLevel({accessLevel}){this.accessLevel=accessLevel;}
  };
}

test('expired Supabase session proactively rotates its refresh token in trusted storage', async () => {
  const oldChrome=globalThis.chrome,oldFetch=globalThis.fetch;
  const local=fakeStorage();globalThis.chrome={storage:{local}};
  globalThis.fetch=async url=>{
    assert.match(String(url),/grant_type=refresh_token/);
    return new Response(JSON.stringify({access_token:'fresh-access',refresh_token:'rotated-refresh',expires_in:3600}),{status:200});
  };
  try {
    await saveAuthSession({access_token:'expired-access',refresh_token:'old-refresh',expires_at:1});
    assert.equal(await getValidAccessToken({url:'https://example.supabase.co',anonKey:'public'}),'fresh-access');
    assert.equal(local.accessLevel,'TRUSTED_CONTEXTS');
    const saved=local.values.get(AUTH_SESSION_KEY);
    assert.equal(saved.accessToken,'fresh-access');
    assert.equal(saved.refreshToken,'rotated-refresh');
    assert.ok(saved.expiresAt>Math.floor(Date.now()/1000)+3500);
  } finally { globalThis.chrome=oldChrome;globalThis.fetch=oldFetch; }
});

test('an authenticated 401 refreshes and retries the request once', async () => {
  const oldChrome=globalThis.chrome,oldFetch=globalThis.fetch;
  const local=fakeStorage();globalThis.chrome={storage:{local}};
  const sent=[];
  globalThis.fetch=async (url,options={})=>{
    if(String(url).includes('grant_type=refresh_token'))return new Response(JSON.stringify({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600}),{status:200});
    sent.push(options.headers.Authorization);
    return sent.length===1?new Response('expired',{status:401}):new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}});
  };
  try {
    await saveAuthSession({access_token:'old-access',refresh_token:'old-refresh',expires_at:Math.floor(Date.now()/1000)+3600});
    const response=await authenticatedFetch({url:'https://example.supabase.co',anonKey:'public'},'https://example.supabase.co/rest/v1/addons');
    assert.equal(response.status,200);
    assert.deepEqual(sent,['Bearer old-access','Bearer new-access']);
  } finally { globalThis.chrome=oldChrome;globalThis.fetch=oldFetch; }
});
