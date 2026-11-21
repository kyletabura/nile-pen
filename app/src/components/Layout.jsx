import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Radio, Inbox, Mail, Users, Image as ImageIcon, Tags, UserCog, Settings as Cog,
  Search, ExternalLink, Menu, LogOut, UploadCloud, Loader2, Plus, BookOpen,
} from 'lucide-react';
import { useAuth, useStats, bump } from '../lib/auth.jsx';
import { supabase, requestPublish, SITE_URL } from '../lib/supabase.js';
import { Initials, useToast } from './ui.jsx';
import { setStartUser } from './GettingStarted.jsx';
import { timeAgo } from '../lib/util.js';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/stories', label: 'Stories', icon: FileText },
  { to: '/live', label: 'Live updates', icon: Radio },
  { to: '/pitches', label: 'Pitches', icon: Inbox, count: 'pitches_new' },
  { to: '/messages', label: 'Messages', icon: Mail, count: 'messages_new' },
  { to: '/subscribers', label: 'Subscribers', icon: Users },
  { label: 'Site' },
  { to: '/media', label: 'Media library', icon: ImageIcon },
  { to: '/topics', label: 'Topics', icon: Tags },
  { to: '/team', label: 'Team', icon: UserCog },
  { to: '/settings', label: 'Settings', icon: Cog },
  { label: 'Help' },
  { to: '/guide', label: 'Guide', icon: BookOpen },
];

export default function Layout() {
  const { editor, signOut } = useAuth();
  const { stats } = useStats() || {};
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => setNavOpen(false), [loc.pathname]);
  useIdleSignOut(signOut);
  setStartUser(editor?.user_id);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className={'shell' + (navOpen ? ' nav-open' : '')}>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <aside className="sidebar" aria-label="Main">
        <NavLink to="/" className="brand">
          <span className="brand-mark">N</span>
          <span><span className="brand-name">The Nile Pen</span><br /><span className="brand-sub">Newsroom</span></span>
        </NavLink>
        <nav className="nav">
          {NAV.map((n, i) => n.to ? (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <n.icon />{n.label}
              {n.count && stats?.[n.count] > 0 && <span className="count">{stats[n.count]}</span>}
            </NavLink>
          ) : <div key={i} className="nav-label">{n.label}</div>)}
        </nav>
        <div className="sidebar-foot">
          <a className="btn sm" href={SITE_URL} target="_blank" rel="noopener"><ExternalLink />View the site</a>
          <div className="me">
            <Initials name={editor?.name || editor?.email} />
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 800, fontSize: 14 }}>{editor?.name || 'Editor'}</div>
              <div className="ellipsis faint">{editor?.role === 'owner' ? 'Owner' : 'Editor'}</div>
            </div>
            <button className="btn ghost icon sm" onClick={() => signOut()} aria-label="Sign out" title="Sign out"><LogOut /></button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className={'topbar' + (scrolled ? ' scrolled' : '')}>
          <button className="btn ghost icon menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu /></button>
          <GlobalSearch />
          <NavLink to="/stories/new" className="btn hide-mobile"><Plus />New story</NavLink>
          <PublishButton />
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}

/** Signs out after 60 minutes without any activity in any open dashboard tab. */
const IDLE_MS = 60 * 60 * 1000;
function useIdleSignOut(signOut) {
  useEffect(() => {
    const KEY = 'np-last-active';
    const mark = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
    let last = 0;
    const onActivity = () => { const n = Date.now(); if (n - last > 15000) { last = n; mark(); } };
    const check = () => {
      let at = Date.now();
      try { at = Number(localStorage.getItem(KEY)) || at; } catch { /* ignore */ }
      if (Date.now() - at > IDLE_MS) {
        try { sessionStorage.setItem('np-notice', 'You were signed out after an hour without activity, to keep the newsroom safe.'); } catch { /* ignore */ }
        signOut();
        return true;
      }
      return false;
    };
    // coming back to a tab or browser that was left signed in for over an hour also signs out
    if (check()) return undefined;
    mark();
    const evs = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'];
    evs.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const t = setInterval(check, 30000);
    return () => { clearInterval(t); evs.forEach((e) => window.removeEventListener(e, onActivity)); };
  }, [signOut]);
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const nav = useNavigate();
  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      const like = '%' + term.replace(/[%_,()]/g, ' ') + '%';
      const { data } = await supabase.from('articles').select('id,title,status,is_brief,published_on').or(`title.ilike.${like},slug.ilike.${like},author.ilike.${like}`).order('published_on', { ascending: false }).limit(8);
      setRes(data || []); setHi(0);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);
  const go = (a) => { setOpen(false); setQ(''); nav('/stories/' + a.id); };
  return (
    <div className="search" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <Search />
      <input ref={ref} value={q} placeholder="Search stories by title or author" aria-label="Search stories"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, res.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && res[hi]) go(res[hi]);
          if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); }
        }} />
      {!q && <kbd className="hide-mobile">Ctrl K</kbd>}
      {open && q.trim().length >= 2 && (
        <div className="search-results">
          {res.length ? res.map((a, i) => (
            <a key={a.id} href={'/stories/' + a.id} className={i === hi ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); go(a); }}>
              {a.is_brief ? <Radio size={16} color="#c4262e" /> : <FileText size={16} color="#5d6166" />}
              <span className="grow ellipsis" style={{ fontWeight: 700 }}>{a.title}</span>
              <span className={'badge ' + a.status}>{a.status}</span>
            </a>
          )) : <div className="faint" style={{ padding: 12 }}>No stories match “{q.trim()}”.</div>}
        </div>
      )}
    </div>
  );
}

function PublishButton() {
  const { stats } = useStats() || {};
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pending = stats?.last_change && (!stats.last_publish || stats.last_change > stats.last_publish);
  const publish = async () => {
    setBusy(true);
    try {
      await requestPublish('Manual update from the dashboard');
      toast('Site update started. Changes go live in about a minute.');
      bump();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <button className={'btn ' + (pending ? 'primary' : '')} onClick={publish} disabled={busy}
      title={stats?.last_publish ? 'Last update ' + timeAgo(stats.last_publish) : 'Rebuild the public site'}>
      {busy ? <Loader2 className="spin" /> : <UploadCloud />}
      <span>{pending ? 'Publish changes' : 'Update site'}</span>
    </button>
  );
}
