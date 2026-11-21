// Owner-only team management for the Nile Pen newsroom (app.thenilepen.com).
// Actions: create | reset | reset_mfa | remove | role. Uses the service role, so every call
// re-checks (as the caller) that they are an owner who passed every sign-in check.
// Deployed to the Supabase project "nile-pen" (verify_jwt = true).
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const ORIGINS = ['https://app.thenilepen.com', 'http://localhost:5173', 'http://localhost:4173'];

function cors(req: Request) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(token);
  if (!who?.user) return json(req, { error: 'Please sign in again.' }, 401);
  // Ask the database as the caller, so the same rules apply as everywhere else:
  // owner role, own password already chosen, and two-step verification passed if set up.
  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false }, global: { headers: { Authorization: 'Bearer ' + token } },
  });
  const { data: isOwner } = await asCaller.rpc('am_i_owner');
  if (isOwner !== true) return json(req, { error: 'Only the site owner can manage the team (and you may need to complete two-step verification first).' }, 403);

  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json(req, { error: 'Bad request' }, 400); }

  const owners = async () => (await admin.from('editors').select('user_id').eq('role', 'owner')).data?.length || 0;
  const pwOk = (p: string) => typeof p === 'string' && p.length >= 10 && p.length <= 72;

  try {
    if (b.action === 'create') {
      const email = String(b.email || '').trim().toLowerCase();
      const name = String(b.name || '').trim().slice(0, 80);
      const role = b.role === 'owner' ? 'owner' : 'editor';
      if (!EMAIL.test(email) || !name) return json(req, { error: 'Add a name and a valid email address.' }, 400);
      if (!pwOk(b.password)) return json(req, { error: 'The temporary password must be at least 10 characters.' }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email, password: b.password, email_confirm: true, user_metadata: { name } });
      if (error) return json(req, { error: /already/i.test(error.message) ? 'Someone with that email already has an account.' : error.message }, 400);
      const { error: e2 } = await admin.from('editors').insert({ user_id: data.user.id, email, name, role, must_change_password: true });
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); throw e2; }
      return json(req, { ok: true, user_id: data.user.id });
    }
    if (b.action === 'reset') {
      if (!pwOk(b.password)) return json(req, { error: 'The temporary password must be at least 10 characters.' }, 400);
      const { data: t } = await admin.from('editors').select('user_id').eq('user_id', b.user_id).maybeSingle();
      if (!t) return json(req, { error: 'That person is not on the team.' }, 404);
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { password: b.password });
      if (error) throw error;
      // the temporary password only lets them choose a new one
      await admin.from('editors').update({ must_change_password: true }).eq('user_id', b.user_id);
      return json(req, { ok: true });
    }
    if (b.action === 'reset_mfa') {
      // for someone who lost the phone with their authenticator app
      const { data: t } = await admin.from('editors').select('user_id').eq('user_id', b.user_id).maybeSingle();
      if (!t) return json(req, { error: 'That person is not on the team.' }, 404);
      const { data: f, error } = await admin.auth.admin.mfa.listFactors({ userId: b.user_id });
      if (error) throw error;
      for (const x of f?.factors || []) await admin.auth.admin.mfa.deleteFactor({ userId: b.user_id, id: x.id });
      return json(req, { ok: true, removed: (f?.factors || []).length });
    }
    if (b.action === 'role') {
      const role = b.role === 'owner' ? 'owner' : 'editor';
      if (role === 'editor' && (await owners()) <= 1) {
        const { data: t } = await admin.from('editors').select('role').eq('user_id', b.user_id).maybeSingle();
        if (t?.role === 'owner') return json(req, { error: 'The team needs at least one owner.' }, 400);
      }
      const { error } = await admin.from('editors').update({ role }).eq('user_id', b.user_id);
      if (error) throw error;
      return json(req, { ok: true });
    }
    if (b.action === 'remove') {
      if (b.user_id === who.user.id) return json(req, { error: 'You cannot remove yourself.' }, 400);
      const { data: t } = await admin.from('editors').select('role').eq('user_id', b.user_id).maybeSingle();
      if (!t) return json(req, { error: 'That person is not on the team.' }, 404);
      if (t.role === 'owner' && (await owners()) <= 1) return json(req, { error: 'The team needs at least one owner.' }, 400);
      const { error } = await admin.auth.admin.deleteUser(b.user_id);
      if (error) throw error;
      return json(req, { ok: true });
    }
    return json(req, { error: 'Unknown action' }, 400);
  } catch (e) {
    return json(req, { error: (e as Error).message || 'Something went wrong' }, 500);
  }
});
