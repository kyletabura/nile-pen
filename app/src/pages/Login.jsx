import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowLeft, MailCheck, Info } from 'lucide-react';
import { supabase, friendly } from '../lib/supabase.js';
import { Btn } from '../components/ui.jsx';
import { isEmail } from '../lib/util.js';

// Slow down password guessing in this browser. Supabase also rate-limits sign-ins per IP on the server.
const KEY = 'np-login-throttle';
const readThrottle = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { fails: 0, until: 0 }; } catch { return { fails: 0, until: 0 }; } };
const writeThrottle = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

export default function Login() {
  const [mode, setMode] = useState('signin'); // signin | forgot | sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const [notice] = useState(() => { try { const n = sessionStorage.getItem('np-notice'); sessionStorage.removeItem('np-notice'); return n; } catch { return null; } });

  useEffect(() => {
    const tick = () => setWait(Math.max(0, Math.ceil((readThrottle().until - Date.now()) / 1000)));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  const signIn = async (e) => {
    e.preventDefault(); setErr('');
    if (wait > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (!error) { writeThrottle({ fails: 0, until: 0 }); return; }
    const t = readThrottle(); const fails = t.fails + 1;
    // after 5 wrong tries: 1 minute, then doubling up to 30 minutes
    const until = fails >= 5 ? Date.now() + Math.min(30, 2 ** (fails - 5)) * 60000 : 0;
    writeThrottle({ fails, until });
    setPassword('');
    setErr(/rate limit|too many/i.test(error.message) ? 'Too many sign-in attempts. Please wait a few minutes and try again.'
      : fails >= 5 ? 'Too many wrong attempts. Sign-in is paused for a while; use “Forgot password?” if you need to.'
      : friendly(error));
  };

  const sendReset = async (e) => {
    e.preventDefault(); setErr('');
    if (!isEmail(email)) return setErr('Enter the email address you sign in with.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/reset-password' });
    setBusy(false);
    // Same message whether or not the address has an account, so the form cannot be used to discover editors.
    if (error && !/rate limit/i.test(error.message)) return setErr(friendly(error));
    if (error) return setErr('A reset email was sent very recently. Please wait a minute before asking again.');
    setMode('sent');
  };

  return (
    <div className="login">
      <section className="login-art" aria-hidden="true">
        {/* Placeholder: the stock wetland photo the public site uses for "The Forgotten Floods". Swap for The Nile Pen's own photography (public/sign-in-photo.jpg). */}
        <img className="photo" alt="" decoding="async"
          src="/sign-in-photo.jpg" />
        <svg className="waves" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
          <path d="M-60 540 C 220 450, 520 660, 880 520" fill="none" stroke="#c4262e" strokeOpacity="0.9" strokeWidth="5" />
        </svg>
        <div className="row" style={{ position: 'relative' }}>
          <span className="brand-mark">N</span>
          <span className="brand-name" style={{ color: '#fff' }}>The Nile Pen</span>
        </div>
        <div style={{ position: 'relative' }}>
          <p className="quote" style={{ margin: 0 }}>Independent voices, edited with care.</p>
          <p className="blurb" style={{ color: '#e3e5e8', margin: '14px 0 0', maxWidth: '40ch' }}>
            The newsroom for thenilepen.com. Write stories, post Live updates, review pitches and publish to the site.
          </p>
        </div>
      </section>
      <section className="login-form">
        {mode === 'signin' && (
          <form onSubmit={signIn}>
            <div>
              <h1 className="page-title">Sign in</h1>
              <p className="muted" style={{ margin: '8px 0 0' }}>For The Nile Pen team only.</p>
            </div>
            {notice && <div className="note neutral"><Info /><span>{notice}</span></div>}
            <label className="field"><span>Email</span>
              <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            <label className="field"><span className="spread">Password<button type="button" className="btn ghost sm" style={{ height: 24, padding: '0 6px' }} onClick={() => { setErr(''); setMode('forgot'); }}>Forgot password?</button></span>
              <span style={{ position: 'relative' }}>
                <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 44 }} />
                <button type="button" className="btn ghost icon sm" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 4, top: 4 }}>{show ? <EyeOff /> : <Eye />}</button>
              </span>
            </label>
            {err && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>{err}</p>}
            <Btn className="primary" busy={busy} disabled={wait > 0} type="submit" style={{ height: 44 }}>
              {wait > 0 ? `Try again in ${wait >= 60 ? Math.ceil(wait / 60) + ' min' : wait + ' s'}` : 'Sign in'}
            </Btn>
          </form>
        )}
        {mode === 'forgot' && (
          <form onSubmit={sendReset}>
            <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setErr(''); setMode('signin'); }}><ArrowLeft />Back to sign in</button>
            <div>
              <h1 className="page-title">Reset your password</h1>
              <p className="muted" style={{ margin: '8px 0 0' }}>Enter your email and we'll send a link to choose a new password. The link works once and expires after an hour.</p>
            </div>
            <label className="field"><span>Email</span>
              <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            {err && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>{err}</p>}
            <Btn className="primary" busy={busy} type="submit" style={{ height: 44 }}>Send reset link</Btn>
            <p className="faint" style={{ margin: 0 }}>No email arriving? The site owner can also give you a temporary password from the Team page.</p>
          </form>
        )}
        {mode === 'sent' && (
          <form onSubmit={(e) => { e.preventDefault(); setMode('signin'); }}>
            <MailCheck size={34} color="#1f7a4d" />
            <div>
              <h1 className="page-title">Check your email</h1>
              <p className="muted" style={{ margin: '8px 0 0' }}>If <b>{email.trim()}</b> belongs to a team account, a reset link is on its way. Open it on this device. Check your spam folder if it hasn't arrived in a few minutes.</p>
            </div>
            <Btn className="ghost" type="submit"><ArrowLeft />Back to sign in</Btn>
          </form>
        )}
      </section>
    </div>
  );
}
