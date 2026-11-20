import { useEffect, useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2, Tags, ExternalLink } from 'lucide-react';
import { supabase, must, requestPublish, SITE_URL } from '../lib/supabase.js';
import { bump } from '../lib/auth.jsx';
import { Btn, Dialog, Empty, SkeletonRows, confirmAction, useToast } from '../components/ui.jsx';
import { slugify } from '../lib/util.js';

export default function Topics() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [orig, setOrig] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const t = must(await supabase.from('topics').select('*').order('sort'));
      const a = must(await supabase.from('articles').select('topics').eq('status', 'published'));
      const c = {}; a.forEach((x) => (x.topics || []).forEach((s) => (c[s] = (c[s] || 0) + 1)));
      setRows(t); setOrig(JSON.stringify(t)); setCounts(c);
    } catch (e) { toast.error(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);
  const dirty = rows && JSON.stringify(rows) !== orig;
  const set = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i, d) => setRows((rs) => { const n = [...rs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n.map((r, j) => ({ ...r, sort: j })); });

  const save = async () => {
    if (rows.some((r) => !r.name.trim() || !r.nav.trim())) return toast.error('Every topic needs a name and a menu label.');
    setBusy(true);
    try {
      must(await supabase.from('topics').upsert(rows.map(({ slug, name, nav, description, sort }) => ({ slug, name: name.trim(), nav: nav.trim(), description: description.trim(), sort }))));
      await requestPublish('Topics updated'); setOrig(JSON.stringify(rows)); bump();
      toast('Topics saved. The site menu updates in about a minute.');
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Topics</h1><p>The sections in the site menu. Order here is the order in the menu.</p></div>
        <div className="row">
          <button className="btn" onClick={() => setAdding(true)}><Plus />Add topic</button>
          <Btn className="primary" busy={busy} disabled={!dirty} onClick={save}>Save changes</Btn>
        </div>
      </div>
      {rows == null ? <div className="card"><SkeletonRows n={6} h={70} /></div> : rows.length ? (
        <div className="col" style={{ gap: 12 }}>
          {rows.map((r, i) => (
            <section key={r.slug} className="card card-pad" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 16 }}>
              <div className="col" style={{ gap: 4 }}>
                <button className="btn sm icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
                <button className="btn sm icon" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
              </div>
              <div className="col" style={{ gap: 12 }}>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <label className="field"><span>Section name</span><input className="input" value={r.name} onChange={(e) => set(i, 'name', e.target.value)} /></label>
                  <label className="field"><span>Menu label</span><input className="input" value={r.nav} onChange={(e) => set(i, 'nav', e.target.value)} /></label>
                </div>
                <label className="field"><span>Description</span><textarea className="textarea" rows={2} style={{ minHeight: 0 }} value={r.description} onChange={(e) => set(i, 'description', e.target.value)} /></label>
                <div className="spread">
                  <span className="faint">{counts[r.slug] || 0} published · <a href={SITE_URL + '/topic/' + r.slug} target="_blank" rel="noopener">/topic/{r.slug} <ExternalLink size={12} style={{ verticalAlign: -1 }} /></a></span>
                  <button className="btn sm ghost danger" disabled={counts[r.slug] > 0} title={counts[r.slug] ? 'Move its stories to another topic first' : ''} onClick={async () => {
                    if (!(await confirmAction({ title: 'Delete “' + r.name + '”?', body: 'The section disappears from the site menu.', confirm: 'Delete topic', danger: true }))) return;
                    try { must(await supabase.from('topics').delete().eq('slug', r.slug)); await requestPublish('Topic deleted'); bump(); toast('Topic deleted.'); load(); } catch (e) { toast.error(e); }
                  }}><Trash2 />Delete</button>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : <div className="card"><Empty icon={Tags} title="No topics">Add a topic so stories have somewhere to live.</Empty></div>}
      <AddTopic open={adding} onClose={() => setAdding(false)} next={rows?.length || 0} onAdded={() => { setAdding(false); load(); bump(); }} />
    </>
  );
}

function AddTopic({ open, onClose, next, onAdded }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', nav: '', description: '' }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ name: '', nav: '', description: '' }); }, [open]);
  const save = async () => {
    if (!f.name.trim()) return toast.error('Give the topic a name.');
    setBusy(true);
    try {
      must(await supabase.from('topics').insert({ slug: slugify(f.name), name: f.name.trim(), nav: (f.nav || f.name).trim(), description: f.description.trim(), sort: next }));
      await requestPublish('Topic added'); toast('Topic added. It appears in the site menu in about a minute.'); onAdded();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a topic" footer={<><button className="btn" onClick={onClose}>Cancel</button><Btn className="primary" busy={busy} onClick={save}>Add topic</Btn></>}>
      <label className="field"><span>Section name</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Health" autoFocus />
        <small>Web address: /topic/{slugify(f.name) || '…'}</small></label>
      <label className="field"><span>Menu label (short)</span><input className="input" value={f.nav} onChange={(e) => setF({ ...f, nav: e.target.value })} placeholder={f.name || 'Same as the name'} /></label>
      <label className="field"><span>Description</span><textarea className="textarea" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
    </Dialog>
  );
}
