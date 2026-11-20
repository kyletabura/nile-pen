import { useEffect, useMemo, useState } from 'react';
import { Download, Search, Users, UserMinus, UserPlus, Trash2, Copy } from 'lucide-react';
import { supabase, must } from '../lib/supabase.js';
import { bump } from '../lib/auth.jsx';
import { Badge, Btn, Dialog, Empty, SkeletonRows, confirmAction, useToast } from '../components/ui.jsx';
import { download, fmtDate, isEmail, toCsv } from '../lib/util.js';

export default function Subscribers() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('active');
  const [add, setAdd] = useState(false);

  const load = async () => { try { setRows(must(await supabase.from('subscribers').select('*').order('created_at', { ascending: false }).limit(10000))); } catch (e) { toast.error(e); setRows([]); } };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (rows || []).filter((r) => r.status === tab && (!q.trim() || r.email.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, tab]);
  const active = (rows || []).filter((r) => r.status === 'active');
  const week = active.filter((r) => Date.now() - new Date(r.created_at) < 7 * 864e5).length;

  const setStatus = async (r, status) => {
    try { must(await supabase.from('subscribers').update({ status }).eq('id', r.id)); setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status } : x))); bump(); toast(status === 'active' ? 'Resubscribed.' : 'Unsubscribed.'); } catch (e) { toast.error(e); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Subscribers</h1><p>Everyone who signed up for the newsletter on the site.</p></div>
        <div className="row">
          <button className="btn" disabled={!active.length} onClick={async () => { await navigator.clipboard.writeText(active.map((r) => r.email).join(', ')); toast(active.length + ' addresses copied. Paste them into the BCC field of an email.'); }}><Copy />Copy emails</button>
          <button className="btn" disabled={!rows?.length} onClick={() => download('nile-pen-subscribers-' + new Date().toISOString().slice(0, 10) + '.csv', toCsv(rows, ['email', 'status', 'source', 'created_at']))}><Download />Export CSV</button>
          <button className="btn primary" onClick={() => setAdd(true)}><UserPlus />Add subscriber</button>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="card kpi"><span className="kpi-label"><Users />Active subscribers</span><span className="kpi-value">{rows ? active.length : '–'}</span><span className="kpi-foot"><b>+{week}</b> in the last 7 days</span></div>
        <div className="card kpi"><span className="kpi-label"><UserMinus />Unsubscribed</span><span className="kpi-value">{rows ? rows.length - active.length : '–'}</span><span className="kpi-foot">Kept so they are never emailed again</span></div>
      </div>

      <section className="card">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div className="seg">{[['active', 'Active'], ['unsubscribed', 'Unsubscribed']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div className="search" style={{ width: 260 }}><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an email address" aria-label="Find an email address" /></div>
        </div>
        {rows == null ? <SkeletonRows n={6} /> : shown.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Email</th><th>Signed up</th><th className="hide-mobile">Where</th><th>Status</th><th /></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.email}</td>
                <td className="small nowrap">{fmtDate(r.created_at)}</td>
                <td className="small hide-mobile">{{ site: 'Homepage or footer', 'newsletter-page': 'Newsletter page', dashboard: 'Added by an editor' }[r.source] || r.source || '—'}</td>
                <td><Badge status={r.status} /></td>
                <td style={{ textAlign: 'right' }} className="nowrap">
                  {r.status === 'active'
                    ? <button className="btn sm" onClick={() => setStatus(r, 'unsubscribed')}>Unsubscribe</button>
                    : <button className="btn sm" onClick={() => setStatus(r, 'active')}>Resubscribe</button>}
                  <button className="btn sm icon ghost" aria-label={'Delete ' + r.email} onClick={async () => {
                    if (!(await confirmAction({ title: 'Delete ' + r.email + '?', body: 'Use this when someone asks for their data to be erased. To stop emailing them, unsubscribe instead.', confirm: 'Delete', danger: true }))) return;
                    try { must(await supabase.from('subscribers').delete().eq('id', r.id)); setRows((rs) => rs.filter((x) => x.id !== r.id)); bump(); toast('Deleted.'); } catch (e) { toast.error(e); }
                  }}><Trash2 /></button>
                </td>
              </tr>))}
            </tbody></table></div>
        ) : <Empty icon={Users} title={rows.length ? 'No matches' : 'No subscribers yet'}>{rows.length ? 'Try another search.' : 'Sign-ups from the homepage, footer and Newsletter page appear here.'}</Empty>}
      </section>
      <AddDialog open={add} onClose={() => setAdd(false)} onAdded={() => { setAdd(false); load(); bump(); }} />
    </>
  );
}

function AddDialog({ open, onClose, onAdded }) {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const toast = useToast();
  useEffect(() => { if (open) setEmail(''); }, [open]);
  const save = async () => {
    if (!isEmail(email)) return toast.error('That email address does not look right.');
    setBusy(true);
    try { must(await supabase.from('subscribers').insert({ email: email.trim().toLowerCase(), source: 'dashboard' })); toast('Subscriber added.'); onAdded(); }
    catch (e) { toast.error(/already/.test(e.message) ? 'That address is already on the list.' : e); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a subscriber" sub="Only add people who asked to receive the newsletter."
      footer={<><button className="btn" onClick={onClose}>Cancel</button><Btn className="primary" busy={busy} onClick={save}>Add</Btn></>}>
      <label className="field"><span>Email address</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} autoFocus /></label>
    </Dialog>
  );
}
