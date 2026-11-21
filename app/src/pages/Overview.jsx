import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Radio, PenLine, Inbox, Users, Mail, ArrowRight, CheckCircle2, UploadCloud, Plus, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth, useStats } from '../lib/auth.jsx';
import { Badge, Empty, SkeletonRows, Thumb } from '../components/ui.jsx';
import { GettingStarted, WelcomeDialog } from '../components/GettingStarted.jsx';
import { fmtDate, timeAgo } from '../lib/util.js';

export default function Overview() {
  const { editor } = useAuth();
  const { stats } = useStats() || {};
  const [queue, setQueue] = useState(null);
  const [recent, setRecent] = useState(null);
  const [mfaOff, setMfaOff] = useState(false);
  useEffect(() => { supabase.auth.mfa.listFactors().then(({ data }) => setMfaOff(!(data?.totp || []).some((f) => f.status === 'verified'))); }, []);

  useEffect(() => {
    (async () => {
      const [p, m, d, r] = await Promise.all([
        supabase.from('submissions').select('id,name,headline,created_at').eq('status', 'new').order('created_at', { ascending: false }).limit(6),
        supabase.from('messages').select('id,name,subject,created_at').eq('status', 'new').order('created_at', { ascending: false }).limit(6),
        supabase.from('articles').select('id,title,updated_at,is_brief').eq('status', 'draft').order('updated_at', { ascending: false }).limit(6),
        supabase.from('articles').select('id,title,status,is_brief,published_on,topics,image_url,author').order('updated_at', { ascending: false }).limit(6),
      ]);
      const items = [
        ...(p.data || []).map((x) => ({ key: 'p' + x.id, to: '/pitches/' + x.id, icon: Inbox, title: x.headline || 'Untitled pitch', sub: 'Pitch from ' + x.name, when: x.created_at, tag: 'Review' })),
        ...(m.data || []).map((x) => ({ key: 'm' + x.id, to: '/messages/' + x.id, icon: Mail, title: x.subject + ' from ' + x.name, sub: 'New message', when: x.created_at, tag: 'Reply' })),
        ...(d.data || []).map((x) => ({ key: 'd' + x.id, to: '/stories/' + x.id, icon: PenLine, title: x.title, sub: x.is_brief ? 'Live post draft' : 'Story draft', when: x.updated_at, tag: 'Finish' })),
      ].sort((a, b) => (b.when || '').localeCompare(a.when || ''));
      setQueue(items);
      setRecent(r.data || []);
    })();
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = (editor?.name || '').split(' ')[0];

  const kpis = [
    { to: '/stories', icon: FileText, label: 'Published stories', value: stats?.published, foot: (stats?.drafts || 0) + ' in draft' },
    { to: '/live', icon: Radio, label: 'Live updates', value: stats?.briefs, foot: 'Short briefs on the Live page' },
    { to: '/pitches', icon: Inbox, label: 'Pitches waiting', value: stats?.pitches_new, foot: (stats?.pitches_total || 0) + ' received in total' },
    { to: '/subscribers', icon: Users, label: 'Newsletter subscribers', value: stats?.subscribers, foot: <><b>+{stats?.subscribers_7d || 0}</b> this week</> },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{greet}{first ? ', ' + first : ''}</h1>
          <p>{queue == null ? 'Checking what needs you…' : queue.length ? `${queue.length} ${queue.length === 1 ? 'thing needs' : 'things need'} your attention.` : 'You are all caught up.'}</p>
        </div>
        <div className="row">
          <Link className="btn" to="/live/new"><Radio />Post a Live update</Link>
          <Link className="btn primary" to="/stories/new"><Plus />Write a story</Link>
        </div>
      </div>

      {mfaOff && (
        <div className="note spread" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="row" style={{ alignItems: 'flex-start' }}><ShieldAlert /><span><b>Protect your account.</b> Turn on two-step verification so a stolen password alone can't get into the newsroom. It takes two minutes with your phone.</span></span>
          <Link className="btn sm dark" to="/settings">Turn it on</Link>
        </div>
      )}

      <WelcomeDialog name={editor?.name} />
      <GettingStarted />

      <div className="grid kpis">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="card kpi">
            <span className="kpi-label"><k.icon />{k.label}</span>
            <span className="kpi-value">{k.value ?? <span className="skel" style={{ display: 'inline-block', width: 48, height: 30 }} />}</span>
            <span className="kpi-foot">{k.foot}</span>
          </Link>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', marginTop: 16, alignItems: 'start' }}>
        <section className="card">
          <div className="card-head"><h2 className="h2">Needs your attention</h2>{queue?.length > 0 && <span className="faint">{queue.length} open</span>}</div>
          {queue == null ? <SkeletonRows n={4} /> : queue.length ? (
            <div className="list">
              {queue.slice(0, 8).map((q) => (
                <Link key={q.key} to={q.to} className="list-item">
                  <span className="ic"><q.icon /></span>
                  <span className="grow">
                    <span className="ellipsis" style={{ display: 'block', fontWeight: 800 }}>{q.title}</span>
                    <span className="faint">{q.sub} · {timeAgo(q.when)}</span>
                  </span>
                  <span className="btn sm">{q.tag}<ArrowRight /></span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon={CheckCircle2} title="You're all caught up">New pitches, messages and unfinished drafts will appear here.</Empty>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2 className="h2">Recently edited</h2><Link to="/stories" className="small" style={{ fontWeight: 800 }}>All stories</Link></div>
          {recent == null ? <SkeletonRows n={4} /> : (
            <div className="list">
              {recent.map((a) => (
                <Link key={a.id} to={'/stories/' + a.id} className="list-item" style={{ alignItems: 'center' }}>
                  <Thumb article={a} />
                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 800, lineHeight: 1.3 }}>{a.title}</span>
                    <span className="faint">{a.is_brief ? 'Live update' : a.author} · {fmtDate(a.published_on)}</span>
                  </span>
                  <Badge status={a.status} />
                </Link>
              ))}
            </div>
          )}
          <div className="note neutral" style={{ margin: 16 }}>
            <UploadCloud />
            <span>
              {stats?.last_change && stats?.last_publish && stats.last_change > stats.last_publish
                ? <>You have changes that are not on the live site yet. Press <b>Publish changes</b> at the top to update thenilepen.com.</>
                : <>The live site is up to date{stats?.last_publish ? <> (last updated {timeAgo(stats.last_publish)})</> : ''}.</>}
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
