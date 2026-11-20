import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase, friendly } from '../lib/supabase.js';
import { Btn } from '../components/ui.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(friendly(error));
  };

  return (
    <div className="login">
      <section className="login-art" aria-hidden="true">
        <svg className="waves" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 12 }, (_, i) => {
            const y = 60 + i * 72;
            return <path key={i} d={`M-60 ${y} C 220 ${y - 90}, 520 ${y + 120}, 880 ${y - 20}`} fill="none"
              stroke={i === 6 ? '#c4262e' : '#ffffff'} strokeOpacity={i === 6 ? 0.9 : 0.08} strokeWidth={i === 6 ? 5 : 2} />;
          })}
        </svg>
        <div className="row" style={{ position: 'relative' }}>
          <span className="brand-mark">N</span>
          <span className="brand-name" style={{ color: '#fff' }}>The Nile Pen</span>
        </div>
        <p className="quote">Independent voices, edited with care.</p>
        <p style={{ position: 'relative', color: '#b9bec4', margin: 0, maxWidth: '38ch' }}>
          The newsroom for thenilepen.com. Write stories, post Live updates, review pitches and publish to the site.
        </p>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <div>
            <h1 className="page-title">Sign in</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>Use the email and password your editor set up for you.</p>
          </div>
          <label className="field"><span>Email</span>
            <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          <label className="field"><span>Password</span>
            <span style={{ position: 'relative' }}>
              <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 44 }} />
              <button type="button" className="btn ghost icon sm" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 4, top: 4 }}>{show ? <EyeOff /> : <Eye />}</button>
            </span>
          </label>
          {err && <p role="alert" style={{ margin: 0, color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>{err}</p>}
          <Btn className="primary" busy={busy} type="submit" style={{ height: 44 }}>Sign in</Btn>
          <p className="faint" style={{ margin: 0 }}>Forgot your password? Ask the site owner to reset it from the Team page.</p>
        </form>
      </section>
    </div>
  );
}
