import { useEffect, useState } from 'react';
import { UserPlus, KeyRound, Trash2, Copy, ShieldCheck, ShieldOff, Info } from 'lucide-react';
import { supabase, must, friendly } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { Badge, Btn, Dialog, Initials, SkeletonRows, confirmAction, useToast } from '../components/ui.jsx';
import { fmtDate, isEmail } from '../lib/util.js';

const tempPassword = () => {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint32Array(14));
  return 'Np-' + Array.from(b, (x) => a[x % a.length]).join('');
};

async function call(body) {
  const { data, error } = await supabase.functions.invoke('manage-editors', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep */ }
    throw new Error(friendly({ message: msg }));
  }
  return data;
}

export default function Team() {
  const { editor, isOwner } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState(null); // { email, password } to hand over once

  const load = async () => { try { setRows(must(await supabase.from('editors').select('*').order('created_at'))); } catch (e) { toast.error(e); setRows([]); } };
  useEffect(() => { load(); }, []);

  const reset = async (r) => {
    if (!(await confirmAction({ title: 'Reset ' + (r.name || r.email) + '’s password?', body: 'You will get a new temporary password to pass on. Their old password stops working straight away.', confirm: 'Reset password' }))) return;
    const pw = tempPassword();
    try { await call({ action: 'reset', user_id: r.user_id, password: pw }); setShown({ email: r.email, password: pw, reset: true }); } catch (e) { toast.error(e); }
  };
  const resetMfa = async (r) => {
    if (!(await confirmAction({ title: 'Reset two-step verification for ' + (r.name || r.email) + '?', body: 'Use this if they lost the phone with their authenticator app. They can sign in with just their password and should set up two-step verification again straight away.', confirm: 'Reset two-step', danger: true }))) return;
    try { const res = await call({ action: 'reset_mfa', user_id: r.user_id }); toast(res.removed ? 'Two-step verification reset.' : 'They did not have two-step verification set up.'); } catch (e) { toast.error(e); }
  };
  const remove = async (r) => {
    if (!(await confirmAction({ title: 'Remove ' + (r.name || r.email) + '?', body: 'They lose access to the dashboard immediately. Stories they wrote stay published.', confirm: 'Remove from team', danger: true }))) return;
    try { await call({ action: 'remove', user_id: r.user_id }); toast('Removed from the team.'); load(); } catch (e) { toast.error(e); }
  };
  const setRole = async (r, role) => {
    try { await call({ action: 'role', user_id: r.user_id, role }); toast('Role updated.'); load(); } catch (e) { toast.error(e); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Team</h1><p>People who can sign in to this newsroom.</p></div>
        {isOwner && <button className="btn primary" onClick={() => setAdding(true)}><UserPlus />Add a person</button>}
      </div>
      {!isOwner && <div className="note neutral" style={{ marginBottom: 16 }}><Info /><span>Only the site owner can add people or reset passwords.</span></div>}
      <section className="card">
        {rows == null ? <SkeletonRows n={3} h={52} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Person</th><th>Role</th><th className="hide-mobile">Added</th>{isOwner && <th />}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.user_id}>
                <td><div className="row"><Initials name={r.name || r.email} /><div><div style={{ fontWeight: 800 }}>{r.name || '—'}{r.user_id === editor.user_id && <span className="faint"> (you)</span>}</div><div className="faint">{r.email}</div></div></div></td>
                <td>{isOwner && r.user_id !== editor.user_id ? (
                  <select className="select" style={{ width: 130, height: 34, padding: '0 30px 0 10px' }} value={r.role} onChange={(e) => setRole(r, e.target.value)} aria-label="Role">
                    <option value="editor">Editor</option><option value="owner">Owner</option>
                  </select>) : <Badge status={r.role === 'owner' ? 'live' : 'read'}>{r.role === 'owner' ? 'Owner' : 'Editor'}</Badge>}
                </td>
                <td className="small hide-mobile">{fmtDate(r.created_at)}</td>
                {isOwner && <td style={{ textAlign: 'right' }} className="nowrap">
                  <button className="btn sm" onClick={() => reset(r)}><KeyRound />Reset password</button>
                  {r.user_id !== editor.user_id && <button className="btn sm" onClick={() => resetMfa(r)}><ShieldOff />Reset two-step</button>}
                  {r.user_id !== editor.user_id && <button className="btn sm icon ghost" aria-label={'Remove ' + r.email} onClick={() => remove(r)}><Trash2 /></button>}
                </td>}
              </tr>))}
            </tbody></table></div>
        )}
      </section>
      <div className="note neutral" style={{ marginTop: 16 }}><ShieldCheck /><span><b>Owners</b> can manage the team. <b>Editors</b> can do everything else: write, publish, review pitches and manage the site.</span></div>

      <AddPerson open={adding} onClose={() => setAdding(false)} onAdded={(x) => { setAdding(false); setShown(x); load(); }} />
      <Dialog open={!!shown} onClose={() => setShown(null)} title={shown?.reset ? 'New temporary password' : 'Account created'}
        sub="Copy these details now. For security the password is not shown again."
        footer={<button className="btn dark" onClick={() => setShown(null)}>Done</button>}>
        {shown && <>
          <div className="meta-grid"><div><div className="k">Sign in at</div><div className="v">app.thenilepen.com</div></div><div><div className="k">Email</div><div className="v">{shown.email}</div></div></div>
          <div className="spread" style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--sunk)' }}>
            <code style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.02em' }}>{shown.password}</code>
            <button className="btn sm" onClick={async () => { await navigator.clipboard.writeText(`The Nile Pen newsroom\nhttps://app.thenilepen.com\nEmail: ${shown.email}\nTemporary password: ${shown.password}\n\nYou'll be asked to choose your own password when you sign in.`); toast('Copied. Send it privately, for example in a WhatsApp message.'); }}><Copy />Copy sign-in details</button>
          </div>
          <p className="faint" style={{ margin: 0 }}>The temporary password only works to choose a new one: they're asked to set their own password the moment they sign in.</p>
        </>}
      </Dialog>
    </>
  );
}

function AddPerson({ open, onClose, onAdded }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', role: 'editor' }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ name: '', email: '', role: 'editor' }); }, [open]);
  const save = async () => {
    if (!f.name.trim() || !isEmail(f.email)) return toast.error('Add their name and a valid email address.');
    setBusy(true);
    const password = tempPassword();
    try { await call({ action: 'create', ...f, password }); onAdded({ email: f.email.trim().toLowerCase(), password }); }
    catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a person" sub="They get a temporary password that you pass on to them."
      footer={<><button className="btn" onClick={onClose}>Cancel</button><Btn className="primary" busy={busy} onClick={save}>Create account</Btn></>}>
      <label className="field"><span>Full name</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
      <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <div className="field"><span>Role</span>
        <label className="radio"><input type="radio" checked={f.role === 'editor'} onChange={() => setF({ ...f, role: 'editor' })} />Editor: writes, publishes and reviews pitches</label>
        <label className="radio"><input type="radio" checked={f.role === 'owner'} onChange={() => setF({ ...f, role: 'owner' })} />Owner: everything, plus managing the team</label>
      </div>
    </Dialog>
  );
}
