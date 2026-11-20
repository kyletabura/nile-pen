import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://kfnjlsxtocwhkuyhjtiw.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_blZrqupJjsRWeez6xwlOtw_dEHm9P9s';

export const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const SITE_URL = 'https://thenilepen.com';

/** Throws a readable Error when a Supabase call fails. */
export function must({ data, error }) {
  if (error) throw new Error(friendly(error));
  return data;
}

export function friendly(error) {
  const m = (error && (error.message || error.error_description)) || String(error);
  if (/duplicate key.*slug/i.test(m)) return 'Another story already uses that web address. Change the address (slug) and try again.';
  if (/duplicate key/i.test(m)) return 'That already exists.';
  if (/JWT expired|invalid JWT/i.test(m)) return 'Your session expired. Please sign in again.';
  if (/Invalid login credentials/i.test(m)) return 'That email and password do not match.';
  if (/violates row-level security|Not allowed|permission denied/i.test(m)) return 'Your account does not have permission to do that.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
  return m;
}

/** Ask Vercel to rebuild the public site with the latest published content. */
export async function requestPublish(note) {
  return must(await supabase.rpc('request_publish', { note: note || null }));
}

export function mediaUrl(path) {
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
