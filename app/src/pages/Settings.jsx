import { useEffect, useState } from 'react';
import { Globe, KeyRound, UserRound, History } from 'lucide-react';
import { supabase, must, friendly, requestPublish } from '../lib/supabase.js';
import { useAuth, bump } from '../lib/auth.jsx';
import { Btn, Switch, SkeletonRows, useToast } from '../components/ui.jsx';
import { isUrl, timeAgo } from '../lib/util.js';

const SOCIAL = [['instagram', 'Instagram', 'https://www.instagram.com/thenilepen'], ['x', 'X / Twitter', 'https://x.com/thenilepen'], ['facebook', 'Facebook', 'https://www.facebook.com/thenilepen'], ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/thenilepen'], ['whatsapp', 'WhatsApp Channel', 'https://whatsapp.com/channel/…']];

export default function Settings() {
  const toast = useToast();
  const { editor, reload } = useAuth();
  const [site, setSite] = useState(null);
  const [orig, setOrig] = useState('');
  const [busy, setBusy] = useState('');
  const [name, setName] = useState(editor?.name || '');
  const [pw, setPw] = useState({ a: '', b: '' });
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

  const savePw = async () => {
    if (pw.a.length < 10) return toast.error('Use at least 10 characters.');
    if (pw.a !== pw.b) return toast.error('The two passwords do not match.');
    setBusy('pw');
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    setBusy('');
    if (error) return toast.error(friendly(error));
    setPw({ a: '', b: '' }); toast('Password changed.');
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
            <div className="card-head"><h2 className="h2 row"><KeyRound size={18} />Change password</h2></div>
            <div className="card-pad col" style={{ gap: 12 }}>
              <label className="field"><span>New password</span><input className="input" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /><small>At least 10 characters.</small></label>
              <label className="field"><span>Type it again</span><input className="input" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></label>
              <Btn className="sm dark" busy={busy === 'pw'} disabled={!pw.a} onClick={savePw} style={{ alignSelf: 'flex-start' }}>Change password</Btn>
            </div>
          </section>
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
