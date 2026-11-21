import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, BookOpen, X, ArrowRight, PenLine, ShieldCheck, Image as ImageIcon, Inbox, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { Dialog } from './ui.jsx';

/* Progress is remembered per person in this browser. */
let uid = null;
export const setStartUser = (id) => { uid = id; };
const key = () => 'np-start:' + (uid || 'anon');
const read = () => { try { return JSON.parse(localStorage.getItem(key())) || {}; } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(key(), JSON.stringify(v)); } catch { /* private mode */ } };
export function markGuideStep(step) {
  const s = read(); if (s[step]) return;
  write({ ...s, [step]: Date.now() });
  window.dispatchEvent(new Event('np:start'));
}

const STEPS = [
  { id: 'password', icon: KeyRound, title: 'Choose your own password', to: '/guide#sign-in', always: true },
  { id: 'twostep', icon: ShieldCheck, title: 'Turn on two-step verification', to: '/settings' },
  { id: 'guide', icon: BookOpen, title: 'Read the newsroom guide', to: '/guide' },
  { id: 'story', icon: PenLine, title: 'Save or publish a story', to: '/stories/new' },
  { id: 'photo', icon: ImageIcon, title: 'Upload a photo', to: '/media' },
  { id: 'pitch', icon: Inbox, title: 'Review a pitch', to: '/pitches' },
];

/** Checklist card on the Overview until every step is done or it is dismissed. */
export function GettingStarted() {
  const [state, setState] = useState(read);
  const [mfa, setMfa] = useState(false);
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => setMfa((data?.totp || []).some((f) => f.status === 'verified')));
    const on = () => setState(read());
    window.addEventListener('np:start', on);
    return () => window.removeEventListener('np:start', on);
  }, []);
  const done = (s) => s.always || (s.id === 'twostep' ? mfa : !!state[s.id]);
  const count = STEPS.filter(done).length;
  if (state.dismissed || count === STEPS.length) return null;

  return (
    <section className="card start-card" aria-label="Getting started">
      <div className="card-head">
        <div>
          <h2 className="h2">Getting started</h2>
          <div className="faint">{count} of {STEPS.length} done</div>
        </div>
        <div className="row">
          <div className="start-bar" aria-hidden="true"><span style={{ width: (count / STEPS.length) * 100 + '%' }} /></div>
          <button className="btn ghost icon sm" aria-label="Hide getting started" title="Hide" onClick={() => { write({ ...state, dismissed: Date.now() }); setState(read()); }}><X /></button>
        </div>
      </div>
      <div className="start-steps">
        {STEPS.map((s) => {
          const ok = done(s);
          return (
            <Link key={s.id} to={s.to} className={'start-step' + (ok ? ' ok' : '')}>
              {ok ? <CheckCircle2 className="tick" /> : <Circle className="tick" />}
              <span className="grow">{s.title}</span>
              {!ok && <ArrowRight size={15} />}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** One-time welcome for someone opening the dashboard for the first time. */
export function WelcomeDialog({ name }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(() => !read().welcomed);
  const close = () => { write({ ...read(), welcomed: Date.now() }); setOpen(false); };
  return (
    <Dialog open={open} onClose={close} title={'Welcome to the newsroom' + (name ? ', ' + name.split(' ')[0] : '')}
      sub="This is where you run thenilepen.com."
      footer={<>
        <button className="btn" onClick={close}>Skip for now</button>
        <button className="btn primary" onClick={() => { close(); nav('/guide'); }}><BookOpen />Show me how it works</button>
      </>}>
      <ul className="welcome-list">
        <li><PenLine /><span><b>Write and publish</b> stories and Live updates. They go live on the site in about a minute.</span></li>
        <li><Inbox /><span><b>Review pitches</b> from writers and answer messages from readers.</span></li>
        <li><ImageIcon /><span><b>Add photos</b>, edit the site menu, manage the team and settings.</span></li>
        <li><ShieldCheck /><span><b>Keep it safe:</b> turn on two-step verification under Settings.</span></li>
      </ul>
      <p className="faint" style={{ margin: 0 }}>The guide is always in the menu on the left under <b>Guide</b>.</p>
    </Dialog>
  );
}
