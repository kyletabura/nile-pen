import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, Archive, Trash2, Reply, Clock, Undo2 } from 'lucide-react';
import { supabase, must } from '../lib/supabase.js';
import { bump } from '../lib/auth.jsx';
import { Badge, Empty, Initials, SkeletonRows, confirmAction, useToast } from '../components/ui.jsx';
import { timeAgo } from '../lib/util.js';

export default function Messages() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('inbox');
  const [subject, setSubject] = useState('');

  useEffect(() => { (async () => {
    try { setRows(must(await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(500))); }
    catch (e) { toast.error(e); setRows([]); }
  })(); }, []);

  const inTab = (r) => (tab === 'inbox' ? r.status !== 'archived' : r.status === 'archived');
  const list = (rows || []).filter((r) => inTab(r) && (!subject || r.subject === subject));
  const counts = useMemo(() => ({ inbox: (rows || []).filter((r) => r.status !== 'archived').length, archived: (rows || []).filter((r) => r.status === 'archived').length }), [rows]);
  const sel = (rows || []).find((r) => r.id === id) || null;

  const patch = async (row, p, msg) => {
    try {
      must(await supabase.from('messages').update(p).eq('id', row.id));
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...p } : r))); bump(); if (msg) toast(msg);
    } catch (e) { toast.error(e); }
  };
  useEffect(() => { if (sel && sel.status === 'new') patch(sel, { status: 'read' }); }, [sel?.id]);
  useEffect(() => { if (rows && !id && list[0] && window.innerWidth > 900) nav('/messages/' + list[0].id, { replace: true }); }, [rows, tab]);

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Messages</h1><p>From the Contact and Advertise pages. Replies open in your email app.</p></div>
      </div>
      <div className="split">
        <section className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div className="seg">
              {[['inbox', 'Inbox'], ['archived', 'Archived']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); nav('/messages'); }}>{l}<span className="n">{counts[k]}</span></button>)}
            </div>
            <select className="select" style={{ width: 170, height: 36, padding: '0 30px 0 10px' }} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject">
              <option value="">All subjects</option>{['General enquiry', 'Advertising', 'Partnerships', 'Corrections'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="scroll">
            {rows == null ? <SkeletonRows n={5} /> : list.length ? (
              <div className="list">
                {list.map((r) => (
                  <Link key={r.id} to={'/messages/' + r.id} className={'list-item' + (sel?.id === r.id ? ' on' : '') + (r.status === 'new' ? ' unread' : '')}>
                    {r.status === 'new' ? <span className="dot" aria-label="Unread" /> : <span style={{ width: 8 }} />}
                    <span className="grow">
                      <span className="spread"><span className="t ellipsis">{r.name}</span><span className="faint nowrap">{timeAgo(r.created_at)}</span></span>
                      <span className="faint" style={{ display: 'block' }}>{r.subject}</span>
                      <span className="ellipsis small muted" style={{ display: 'block' }}>{r.message}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : <Empty icon={Mail} title={tab === 'inbox' ? 'No messages' : 'Nothing archived'}>{tab === 'inbox' ? 'Messages from the Contact and Advertise forms land here.' : 'Archived messages are kept here.'}</Empty>}
          </div>
        </section>
        <section className="card">
          {sel ? (
            <div className="detail">
              <div className="spread">
                <div className="row"><Initials name={sel.name} size={42} /><div><div className="h2">{sel.name}</div><div className="faint">{sel.email}</div></div></div>
                <Badge status={sel.subject === 'Advertising' ? 'live' : 'read'}>{sel.subject}</Badge>
              </div>
              <span className="faint row" style={{ gap: 5 }}><Clock size={14} />{new Date(sel.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <div className="prose">{sel.message}</div>
              <div className="actions-bar">
                <button className="btn danger" onClick={async () => {
                  if (!(await confirmAction({ title: 'Delete this message?', body: 'This cannot be undone.', confirm: 'Delete', danger: true }))) return;
                  try { must(await supabase.from('messages').delete().eq('id', sel.id)); setRows((rs) => rs.filter((r) => r.id !== sel.id)); bump(); nav('/messages'); toast('Message deleted.'); } catch (e) { toast.error(e); }
                }}><Trash2 />Delete</button>
                {sel.status === 'archived'
                  ? <button className="btn" onClick={() => patch(sel, { status: 'read' }, 'Moved to inbox.')}><Undo2 />Move to inbox</button>
                  : <button className="btn" onClick={() => patch(sel, { status: 'archived' }, 'Archived.')}><Archive />Archive</button>}
                <a className="btn dark" href={`mailto:${encodeURIComponent(sel.email)}?subject=${encodeURIComponent('Re: ' + sel.subject + ' — The Nile Pen')}&body=${encodeURIComponent('Hi ' + sel.name.split(' ')[0] + ',\n\n\n\n—\nThe Nile Pen\n\n> ' + sel.message.split('\n').join('\n> '))}`}><Reply />Reply</a>
              </div>
            </div>
          ) : <Empty icon={Mail} title="Select a message">Choose a message on the left to read it.</Empty>}
        </section>
      </div>
    </>
  );
}
