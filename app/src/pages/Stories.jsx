import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Radio, Star } from 'lucide-react';
import { supabase, must } from '../lib/supabase.js';
import { Badge, Empty, SkeletonRows, Thumb, useToast } from '../components/ui.jsx';
import { fmtDate } from '../lib/util.js';

export default function Stories({ brief = false }) {
  const [rows, setRows] = useState(null);
  const [topics, setTopics] = useState([]);
  const [status, setStatus] = useState('all');
  const [topic, setTopic] = useState('');
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const toast = useToast();
  const base = brief ? '/live' : '/stories';

  useEffect(() => {
    setRows(null);
    (async () => {
      try {
        const [a, t] = await Promise.all([
          supabase.from('articles').select('id,slug,title,status,author,published_on,topics,image_url,featured,updated_at,source_label').eq('is_brief', brief).order('published_on', { ascending: false }).order('updated_at', { ascending: false }).limit(1000),
          supabase.from('topics').select('slug,name').order('sort'),
        ]);
        setRows(must(a)); setTopics(must(t));
      } catch (e) { toast.error(e); setRows([]); }
    })();
  }, [brief]);

  const counts = useMemo(() => {
    const c = { all: 0, published: 0, draft: 0, archived: 0 };
    (rows || []).forEach((r) => { c.all++; c[r.status]++; });
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || []).filter((r) =>
      (status === 'all' || r.status === status) &&
      (!topic || (r.topics || []).includes(topic)) &&
      (!term || (r.title + ' ' + r.author + ' ' + (r.source_label || '')).toLowerCase().includes(term)));
  }, [rows, status, topic, q]);

  const topicName = (s) => topics.find((t) => t.slug === s)?.name || s;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{brief ? 'Live updates' : 'Stories'}</h1>
          <p>{brief ? 'Short briefs that appear on the Live page and the homepage ticker.' : 'Long-form reporting, features and opinion.'}</p>
        </div>
        <Link className="btn primary" to={base + '/new'}><Plus />{brief ? 'New Live update' : 'New story'}</Link>
      </div>

      <section className="card">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="seg" role="tablist" aria-label="Filter by status">
            {[['all', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['archived', 'Archived']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}<span className="n">{counts[k]}</span></button>
            ))}
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <select className="select" style={{ width: 190, height: 38, padding: '0 34px 0 12px' }} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Filter by topic">
              <option value="">All topics</option>
              {topics.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </select>
            <div className="search" style={{ width: 240 }}>
              <Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter this list" aria-label="Filter this list" />
            </div>
          </div>
        </div>
        {rows == null ? <SkeletonRows n={7} /> : shown.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{brief ? 'Update' : 'Story'}</th><th>Topic</th><th className="hide-mobile">{brief ? 'Source' : 'Author'}</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => nav(base + '/' + r.id)}>
                    <td>
                      <Link to={base + '/' + r.id} className="story-cell" style={{ color: 'inherit', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                        <Thumb article={r} />
                        <span className="grow"><span className="t">{r.title}</span>
                          {r.featured && <span className="faint row" style={{ gap: 4, marginTop: 2 }}><Star size={13} fill="#c4262e" color="#c4262e" />Featured on homepage</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="nowrap small">{topicName((r.topics || [])[0])}{r.topics?.length > 1 && <span className="faint"> +{r.topics.length - 1}</span>}</td>
                    <td className="small hide-mobile nowrap">{brief ? r.source_label : r.author}</td>
                    <td className="nowrap small">{fmtDate(r.published_on)}</td>
                    <td><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={brief ? Radio : FileText} title={rows.length ? 'Nothing matches these filters' : brief ? 'No Live updates yet' : 'No stories yet'}
            action={!rows.length && <Link className="btn primary" to={base + '/new'}><Plus />{brief ? 'Post the first update' : 'Write the first story'}</Link>}>
            {rows.length ? 'Try a different status, topic or search.' : brief ? 'Live updates are short summaries of breaking news with a link to the source.' : 'Stories you write will be listed here.'}
          </Empty>
        )}
      </section>
    </>
  );
}
