import { getSupabase } from '../supabase/client.js';
import { updateState } from '../storage/state.js';

export async function getCurrentUser() {
  const client = await getSupabase();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  await updateState(state => ({ ...state, auth: { ...state.auth, user: user ? { id: user.id, email: user.email } : null } }));
  return user;
}
export async function signInWithPassword(email, password) {
  const client = await getSupabase();
  if (!client) throw new Error('Add Supabase credentials to supabase.json first.');
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  const client = await getSupabase();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
  await updateState(state => ({ ...state, auth: { user: null } }));
}

