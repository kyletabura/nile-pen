import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Smartphone, KeyRound, Check, X } from 'lucide-react';
import { supabase, friendly } from '../lib/supabase.js';
import { Btn } from './ui.jsx';

/* ---------- password rules ---------- */
const COMMON = ['password', 'qwerty', '123456', 'letmein', 'welcome', 'nilepen', 'thenilepen', 'admin', 'iloveyou', 'abc123'];
export function checkPassword(pw, email = '') {
  const p = String(pw || '');
  const lower = p.toLowerCase();
  const local = String(email || '').split('@')[0].toLowerCase();
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  const rules = [
    { ok: p.length >= 12, text: 'At least 12 characters' },
    { ok: classes >= 3 || p.length >= 16, text: 'Mix of upper and lower case, numbers or symbols' },
    { ok: !COMMON.some((w) => lower.includes(w)) && !(local.length > 2 && lower.includes(local)), text: 'Not a common word or your email name' },
    { ok: !/(.)\1{3,}/.test(p) && !/(0123|1234|2345|abcd|qwer)/i.test(p), text: 'No long repeats or sequences like 1234' },
  ];
  const score = rules.filter((r) => r.ok).length + (p.length >= 16 ? 1 : 0);
  return { rules, ok: rules.every((r) => r.ok), score: Math.min(score, 5) };
}

function Meter({ score }) {
  const label = ['Too weak', 'Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score];
  const color = score >= 4 ? 'var(--green)' : score === 3 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className="col" style={{ gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ height: 5, borderRadius: 9, background: i <= score ? color : 'var(--line)', transition: 'background .2s' }} />)}
      </div>
      <span className="faint" style={{ fontWeight: 700, color }}>{label}</span>
    </div>
  );
}

/** New password + confirm with live rules. Calls onDone() after Supabase accepts it. */
export function PasswordForm({ email, submitLabel = 'Save password', onDone }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const check = useMemo(() => checkPassword(a, email), [a, email]);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!check.ok) return setErr('Choose a stronger password. Every rule below needs a tick.');
    if (a !== b) return setErr('The two passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: a });
    if (error) { setBusy(false); return setErr(/different from the old|same as/i.test(error.message) ? 'Use a password you have not used here before.' : friendly(error)); }
    await supabase.rpc('password_was_changed');
    setBusy(false); setA(''); setB('');
    onDone && onDone();
  };
  return (
    <form onSubmit={submit} className="col" style={{ gap: 14 }}>
      <label className="field"><span>New password</span>
        <span style={{ position: 'relative' }}>
          <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} style={{ paddingRight: 44 }} autoFocus />
          <button type="button" className="btn ghost icon sm" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 4, top: 4 }}>{show ? <EyeOff /> : <Eye />}</button>
        </span>
      </label>
      {a && <Meter score={check.score} />}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {check.rules.map((r) => (
          <li key={r.text} className="row" style={{ gap: 8, fontSize: 13, color: a && r.ok ? 'var(--green)' : 'var(--body)', fontWeight: 700 }}>
            {a && r.ok ? <Check size={15} /> : <X size={15} color="#b9bec4" />}{r.text}
          </li>
        ))}
      </ul>
      <label className="field"><span>Type it again</span>
        <input className={'input' + (b && a !== b ? ' invalid' : '')} type={show ? 'text' : 'password'} autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      </label>
      {err && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>{err}</p>}
      <Btn className="primary" busy={busy} type="submit" style={{ height: 44 }}>{submitLabel}</Btn>
    </form>
  );
}

/** Full-screen card used by the gate (first sign-in, recovery link, two-step code). */
export function AuthCard({ icon: Icon, title, children, foot }) {
  return (
    <div className="login-form" style={{ minHeight: '100%' }}>
      <div className="card" style={{ width: 'min(440px, 100%)', padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="row"><span className="brand-mark">N</span><span className="brand-name">The Nile Pen</span></div>
        <div>
          <h1 className="page-title row" style={{ gap: 10 }}>{Icon && <Icon size={26} color="#c4262e" />}{title}</h1>
        </div>
        {children}
        {foot}
      </div>
    </div>
  );
}

/* ---------- two-step verification (TOTP authenticator app) ---------- */

/** Code prompt after password sign-in when the account has an authenticator set up. */
export function MfaChallenge({ onDone, onCancel }) {
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!/^\d{6}$/.test(code)) return setErr('Enter the 6-digit code from your authenticator app.');
    setBusy(true);
    try {
      const { data: f, error: e1 } = await supabase.auth.mfa.listFactors(); if (e1) throw e1;
      const factor = (f.totp || []).find((x) => x.status === 'verified'); if (!factor) throw new Error('No authenticator is set up on this account.');
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw error;
      onDone();
    } catch (e2) { setErr(/invalid|expired/i.test(e2.message) ? 'That code is wrong or expired. Codes change every 30 seconds.' : friendly(e2)); setCode(''); }
    finally { setBusy(false); }
  };
  return (
    <AuthCard icon={ShieldCheck} title="Two-step verification" foot={<button className="btn ghost sm" onClick={onCancel} style={{ alignSelf: 'flex-start' }}>Sign out</button>}>
      <p className="muted" style={{ margin: 0 }}>Open your authenticator app (Google Authenticator, Microsoft Authenticator or similar) and enter the 6-digit code for The Nile Pen.</p>
      <form onSubmit={submit} className="col" style={{ gap: 14 }}>
        <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 26, letterSpacing: '0.4em', textAlign: 'center', fontWeight: 800 }} />
        {err && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>{err}</p>}
        <Btn className="primary" busy={busy} type="submit" style={{ height: 44 }}>Verify</Btn>
      </form>
      <p className="faint" style={{ margin: 0 }}>Lost your phone? Ask the site owner to reset your two-step verification from the Team page.</p>
    </AuthCard>
  );
}

/** Settings panel: turn two-step verification on or off. */
export function MfaSettings({ onChange }) {
  const [factors, setFactors] = useState(null);
  const [enroll, setEnroll] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const load = async () => { const { data } = await supabase.auth.mfa.listFactors(); setFactors((data?.totp || []).filter((f) => f.status === 'verified')); };
  useEffect(() => { load(); }, []);

  const start = async () => {
    setErr(''); setBusy(true);
    // clear any half-finished attempt first
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of (all?.all || []).filter((x) => x.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator ' + new Date().toISOString().slice(0, 10) });
    setBusy(false);
    if (error) return setErr(friendly(error));
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }); setCode('');
  };
  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setErr('Enter the 6-digit code shown in the app.');
    setBusy(true); setErr('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    setBusy(false);
    if (error) return setErr('That code did not match. Check the time on your phone is automatic and try the next code.');
    setEnroll(null); await load(); onChange && onChange('on');
  };
  const disable = async (f) => {
    if (!window.confirm('Turn off two-step verification? Your account will be protected by your password only.')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    setBusy(false);
    if (error) return setErr(friendly(error));
    await supabase.auth.refreshSession(); await load(); onChange && onChange('off');
  };

  if (factors == null) return <div className="skel" style={{ height: 60 }} />;
  if (enroll) return (
    <div className="col" style={{ gap: 14 }}>
      <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone.</li>
        <li>In the app, add an account and scan this code.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <img src={enroll.qr} alt="QR code to scan with your authenticator app" style={{ width: 196, height: 196, background: '#fff', borderRadius: 12, border: '1px solid var(--line)', padding: 8 }} />
      <details><summary className="faint" style={{ cursor: 'pointer' }}>Can't scan? Enter this key instead</summary>
        <code style={{ display: 'block', marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--sunk)', wordBreak: 'break-all', fontWeight: 800 }}>{enroll.secret}</code></details>
      <div className="row">
        <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 170, fontWeight: 800, letterSpacing: '0.2em' }} />
        <Btn className="primary" busy={busy} onClick={verify}>Turn on</Btn>
        <button className="btn ghost" onClick={async () => { await supabase.auth.mfa.unenroll({ factorId: enroll.id }); setEnroll(null); }}>Cancel</button>
      </div>
      {err && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>{err}</p>}
    </div>
  );
  return (
    <div className="col" style={{ gap: 12 }}>
      {factors.length ? (
        <>
          <div className="note" style={{ background: 'var(--green-tint)' }}><ShieldCheck style={{ color: 'var(--green)' }} /><span><b>On.</b> Signing in needs your password and a code from your phone.</span></div>
          {factors.map((f) => <div key={f.id} className="spread"><span className="row small" style={{ fontWeight: 700 }}><Smartphone size={16} />{f.friendly_name || 'Authenticator app'}</span><Btn className="sm danger" busy={busy} onClick={() => disable(f)}>Turn off</Btn></div>)}
        </>
      ) : (
        <>
          <div className="note"><KeyRound /><span><b>Off.</b> Turn this on so a stolen password alone cannot get into the newsroom.</span></div>
          <Btn className="dark" busy={busy} onClick={start} style={{ alignSelf: 'flex-start' }}><Smartphone />Set up two-step verification</Btn>
        </>
      )}
      {err && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>{err}</p>}
    </div>
  );
}
