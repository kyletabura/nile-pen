import { useEffect, useState } from 'react';
import { Globe, KeyRound, UserRound, History, ShieldCheck, LogOut, Activity } from 'lucide-react';
import { supabase, must, requestPublish } from '../lib/supabase.js';
import { useAuth, bump } from '../lib/auth.jsx';
import { Btn, Switch, SkeletonRows, confirmAction, useToast } from '../components/ui.jsx';
import { MfaSettings, PasswordForm } from '../components/Security.jsx';
import { isUrl, timeAgo } from '../lib/util.js';

const SOCIAL = [['instagram', 'Instagram', 'https://www.instagram.com/thenilepen'], ['x', 'X / Twitter', 'https://x.com/thenilepen'], ['facebook', 'Facebook', 'https://www.facebook.com/thenilepen'], ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/thenilepen'], ['whatsapp', 'WhatsApp Channel', 'https://whatsapp.com/channel/…']];

export default function Settings() {
  const toast = useToast();
  const { editor, reload, isOwner, signOut } = useAuth();
  const [pwKey, setPwKey] = useState(0);
  const [site, setSite] = useState(null);
  const [orig, setOrig] = useState('');
  const [busy, setBusy] = useState('');
  const [name, setName] = useState(editor?.name || '');
  const [log, setLog] = useState(null);

  useEffect(() => { (async () => {
    try {
      const s = Object.fromEntries(must(await supabase.from('settings').select('*')).map((r) => [r.key, r.value]));
      const v = { show_ticker: s.show_ticker ?? true, social: { facebook: '', x: '', instagram: '', linkedin: '', whatsapp: '', ...(s.social || {}) } };
      setSite(v); setOrig(JSON.stringify(v));
      setLog(must(await supabase.from('publish_log').select('*').order('requested_at', { ascending: false }).limit(12)));
    } catch (e) { toast.error(e); }
  })(); }, []);

  const saveSite = async () => {
    const bad = SOCIAL.find(([k]) => site.social[k] && !isUrl(site.social[k]));
    if (bad) return toast.error(bad[1] + ' link should start with https://');
    setBusy('site');
    try {
      must(await supabase.from('settings').upsert([{ key: 'show_ticker', value: site.show_ticker }, { key: 'social', value: site.social }]));
      await requestPublish('Site settings updated'); setOrig(JSON.stringify(site)); bump();
      toast('Saved. The site updates in about a minute.');
    } catch (e) { toast.error(e); } finally { setBusy(''); }
  };

  const saveName = async () => {
    setBusy('name');
    try { must(await supabase.from('editors').update({ name: name.trim() }).eq('user_id', editor.user_id)); await reload(); toast('Name updated.'); }
    catch (e) { toast.error(e); } finally { setBusy(''); }
  };

  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Settings</h1><p>Site-wide options and your account.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', alignItems: 'start' }}>
        <section className="card">
          <div className="card-head"><h2 className="h2 row"><Globe size={18} />Public site</h2>
            <Btn className="primary sm" busy={busy === 'site'} disabled={!site || JSON.stringify(site) === orig} onClick={saveSite}>Save and publish</Btn></div>
          {!site ? <SkeletonRows n={4} /> : (
            <div className="card-pad col" style={{ gap: 16 }}>
              <Switch label="Show the news ticker" hint="The scrolling “Latest news” bar at the top of every page" checked={site.show_ticker} onChange={(v) => setSite({ ...site, show_ticker: v })} />
              <div style={{ height: 1, background: 'var(--line)' }} />
              <div><div className="h3">Social links in the footer</div><div className="faint">Leave a box empty to hide that network.</div></div>
              {SOCIAL.map(([k, l, ph]) => (
                <label key={k} className="field"><span>{l}</span>
                  <input className={'input' + (site.social[k] && !isUrl(site.social[k]) ? ' invalid' : '')} value={site.social[k]} placeholder={ph} inputMode="url"
                    onChange={(e) => setSite({ ...site, social: { ...site.social, [k]: e.target.value.trim() } })} /></label>
              ))}
            </div>
          )}
        </section>

        <div className="col" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><h2 className="h2 row"><UserRound size={18} />Your profile</h2></div>
            <div className="card-pad col" style={{ gap: 12 }}>
              <label className="field"><span>Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="field"><span>Email</span><input className="input" value={editor?.email || ''} disabled /></label>
              <Btn className="sm" busy={busy === 'name'} disabled={!name.trim() || name.trim() === editor?.name} onClick={saveName} style={{ alignSelf: 'flex-start' }}>Save name</Btn>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2 className="h2 row"><ShieldCheck size={18} />Two-step verification</h2></div>
            <div className="card-pad"><MfaSettings onChange={(s) => toast(s === 'on' ? 'Two-step verification is on.' : 'Two-step verification is off.')} /></div>
          </section>
          <section className="card">
            <div className="card-head"><h2 className="h2 row"><KeyRound size={18} />Change password</h2></div>
            <div className="card-pad"><PasswordForm key={pwKey} email={editor?.email} submitLabel="Change password" onDone={() => { setPwKey((k) => k + 1); toast('Password changed.'); }} /></div>
          </section>
          <section className="card">
            <div className="card-head"><h2 className="h2 row"><LogOut size={18} />Sessions</h2></div>
            <div className="card-pad col" style={{ gap: 12 }}>
              <p className="muted" style={{ margin: 0 }}>Signed in on a shared or lost device? Sign out everywhere, including this browser. You stay signed out until you enter your password again.</p>
              <Btn className="sm" busy={busy === 'out'} style={{ alignSelf: 'flex-start' }} onClick={async () => {
                if (!(await confirmAction({ title: 'Sign out on every device?', body: 'Anyone using your account on another phone or computer is signed out immediately.', confirm: 'Sign out everywhere', danger: true }))) return;
                setBusy('out'); await signOut('global');
              }}><LogOut />Sign out everywhere</Btn>
            </div>
          </section>
          {isOwner && <ActivityCard />}
          <section className="card">
            <div className="card-head"><h2 className="h2 row"><History size={18} />Site updates</h2></div>
            {log == null ? <SkeletonRows n={3} h={28} /> : (
              <div className="list">{log.map((l) => (
                <div key={l.id} className="list-item" style={{ cursor: 'default' }}>
                  <span className="grow ellipsis">{l.note || 'Site update'}</span><span className="faint nowrap">{timeAgo(l.requested_at)}</span>
                </div>))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

const ACTIONS = {
  login: 'Signed in', logout: 'Signed out', user_recovery_requested: 'Asked for a password reset', user_updated_password: 'Changed password',
  user_modified: 'Account updated', token_revoked: 'Session ended', user_deleted: 'Account removed', user_signedup: 'Account created',
  mfa_challenge_verified: 'Passed two-step check', factor_in_progress: 'Started two-step setup', factor_deleted: 'Turned off two-step',
};

/** Owners only: recent sign-ins and account changes, so an unfamiliar login stands out. */
function ActivityCard() {
  const [rows, setRows] = useState(null);
  useEffect(() => { supabase.rpc('security_activity', { max_rows: 30 }).then(({ data }) => setRows(data || [])); }, []);
  return (
    <section className="card">
      <div className="card-head"><h2 className="h2 row"><Activity size={18} />Sign-in activity</h2><span className="faint">Owners only</span></div>
      {rows == null ? <SkeletonRows n={4} h={28} /> : rows.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th className="hide-mobile">Network address</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}><td className="small nowrap">{timeAgo(r.at)}</td><td className="small">{r.email || '—'}</td>
              <td className="small">{ACTIONS[r.action] || r.action}</td><td className="small faint hide-mobile">{r.ip || '—'}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <p className="faint" style={{ padding: 20, margin: 0 }}>No activity recorded yet.</p>}
      <p className="faint" style={{ margin: 0, padding: '0 20px 16px' }}>See a sign-in you don't recognise? Reset that person's password on the Team page and ask them to turn on two-step verification.</p>
    </section>
  );
}
