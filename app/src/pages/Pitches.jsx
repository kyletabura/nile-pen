import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Inbox, Check, X, Mail, MapPin, Clock, PenLine, Trash2, Undo2, FileText } from 'lucide-react';
import { supabase, must } from '../lib/supabase.js';
import { useAuth, bump } from '../lib/auth.jsx';
import { Badge, Btn, Dialog, Empty, Initials, SkeletonRows, confirmAction, useToast } from '../components/ui.jsx';
import { slugify, timeAgo, today, words } from '../lib/util.js';

const REASONS = ['Not the right fit for our sections', 'We have covered this recently', 'Needs a clearer angle or stronger sourcing', 'Too late to be timely'];

export default function Pitches() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { editor } = useAuth();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('new');
  const [approve, setApprove] = useState(false);
  const [decline, setDecline] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRows(must(await supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(500))); }
    catch (e) { toast.error(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({ new: 0, approved: 0, declined: 0, ...(rows || []).reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}) }), [rows]);
  const list = (rows || []).filter((r) => r.status === tab);
  const sel = (rows || []).find((r) => r.id === id) || null;
  useEffect(() => { if (sel && sel.status !== tab) setTab(sel.status); }, [sel?.id]);
  useEffect(() => { if (rows && !id && list[0] && window.innerWidth > 900) nav('/pitches/' + list[0].id, { replace: true }); }, [rows, tab]);

  const update = async (patch) => {
    must(await supabase.from('submissions').update({ ...patch, reviewed_at: new Date().toISOString(), reviewed_by: editor.user_id }).eq('id', sel.id));
    setRows((rs) => rs.map((r) => (r.id === sel.id ? { ...r, ...patch } : r)));
    bump();
  };

  const doApprove = async (createDraft) => {
    setBusy(true);
    try {
      let draft = null;
      if (createDraft) {
        const paras = sel.pitch.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        draft = must(await supabase.from('articles').insert({
          title: sel.headline || 'Untitled pitch from ' + sel.name, dek: '', body: paras, topics: [], author: sel.name,
          published_on: today(), status: 'draft', submission_id: sel.id, slug: slugify(sel.headline || sel.name) + '-' + Math.random().toString(36).slice(2, 6),
        }).select('id').single());
      }
      await update({ status: 'approved', decision_note: createDraft ? 'Draft created' : null });
      setApprove(false);
      toast(createDraft ? 'Approved. A draft story is ready for editing.' : 'Pitch approved.', draft ? { action: { label: 'Open draft', run: () => nav('/stories/' + draft.id) } } : {});
      next();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const doDecline = async (reason, note, email) => {
    setBusy(true);
    try {
      await update({ status: 'declined', decision_note: [reason, note].filter(Boolean).join(' — ') });
      if (email) window.location.href = mailto(sel, 'decline', [reason, note].filter(Boolean).join('. '));
      setDecline(false); toast('Pitch declined.'); next();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const next = () => { const rest = list.filter((r) => r.id !== sel.id); nav(rest[0] ? '/pitches/' + rest[0].id : '/pitches', { replace: true }); };

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Pitches</h1><p>Story ideas sent through “Write for The Nile Pen”. Approve one to turn it into a draft.</p></div>
      </div>
      <div className="split">
        <section className="card">
          <div className="card-head">
            <div className="seg" role="tablist">
              {[['new', 'To review'], ['approved', 'Approved'], ['declined', 'Declined']].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); nav('/pitches'); }}>{l}<span className="n">{counts[k]}</span></button>
              ))}
            </div>
          </div>
          <div className="scroll">
            {rows == null ? <SkeletonRows n={5} /> : list.length ? (
              <div className="list">
                {list.map((r) => (
                  <Link key={r.id} to={'/pitches/' + r.id} className={'list-item' + (sel?.id === r.id ? ' on' : '') + (r.status === 'new' ? ' unread' : '')}>
                    <Initials name={r.name} />
                    <span className="grow">
                      <span className="t" style={{ display: 'block', lineHeight: 1.3 }}>{r.headline || 'Untitled pitch'}</span>
                      <span className="faint">{r.name}{r.location ? ' · ' + r.location : ''} · {timeAgo(r.created_at)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : <Empty icon={Inbox} title={tab === 'new' ? 'No pitches to review' : 'Nothing here yet'}>{tab === 'new' ? 'When writers send a pitch from the site, it appears here.' : 'Pitches you ' + (tab === 'approved' ? 'approve' : 'decline') + ' are kept here.'}</Empty>}
          </div>
        </section>

        <section className="card">
          {sel ? (
            <div className="detail">
              <div className="spread" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <Badge status={sel.status}>{sel.status === 'new' ? 'Needs review' : sel.status === 'approved' ? 'Approved' : 'Declined'}</Badge>
                  <span className="faint row" style={{ gap: 5 }}><Clock size={14} />Received {timeAgo(sel.created_at)}</span>
                </div>
                <a className="btn sm" href={mailto(sel, 'reply')}><Mail />Reply by email</a>
              </div>
              <h2 className="detail-title">{sel.headline || 'Untitled pitch'}</h2>
              <div className="meta-grid">
                <div><div className="k">From</div><div className="v">{sel.name}</div></div>
                <div><div className="k">Email</div><div className="v">{sel.email}</div></div>
                <div><div className="k">Based in</div><div className="v row" style={{ gap: 5 }}>{sel.location ? <><MapPin size={14} />{sel.location}</> : '—'}</div></div>
                <div><div className="k">Length</div><div className="v">{words(sel.pitch)} words</div></div>
              </div>
              <div className="prose">{sel.pitch}</div>
              {sel.decision_note && <div className="note neutral"><FileText /><span><b>Decision note:</b> {sel.decision_note}</span></div>}
              <div className="actions-bar">
                {sel.status === 'new' ? (
                  <>
                    <button className="btn" onClick={() => setDecline(true)}><X />Decline</button>
                    <button className="btn dark" onClick={() => setApprove(true)}><Check />Approve</button>
                  </>
                ) : (
                  <>
                    <Btn className="danger" onClick={async () => {
                      if (!(await confirmAction({ title: 'Delete this pitch?', body: 'The pitch and the writer’s details are removed permanently.', confirm: 'Delete', danger: true }))) return;
                      try { must(await supabase.from('submissions').delete().eq('id', sel.id)); setRows((rs) => rs.filter((r) => r.id !== sel.id)); bump(); nav('/pitches'); toast('Pitch deleted.'); } catch (e) { toast.error(e); }
                    }}><Trash2 />Delete</Btn>
                    <Btn onClick={async () => { try { await update({ status: 'new', decision_note: null }); toast('Moved back to review.'); } catch (e) { toast.error(e); } }}><Undo2 />Move back to review</Btn>
                  </>
                )}
              </div>
            </div>
          ) : <Empty icon={Inbox} title="Select a pitch">Choose a pitch on the left to read it in full.</Empty>}
        </section>
      </div>

      <ApproveDialog open={approve} onClose={() => setApprove(false)} busy={busy} onApprove={doApprove} pitch={sel} />
      <DeclineDialog open={decline} onClose={() => setDecline(false)} busy={busy} onDecline={doDecline} />
    </>
  );
}

function ApproveDialog({ open, onClose, busy, onApprove, pitch }) {
  const [draft, setDraft] = useState(true);
  return (
    <Dialog open={open} onClose={onClose} title="Approve this pitch?" sub={pitch?.headline}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><Btn className="dark" busy={busy} onClick={() => onApprove(draft)}><Check />Approve</Btn></>}>
      <label className="radio"><input type="radio" checked={draft} onChange={() => setDraft(true)} /><span><PenLine size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Approve and start a draft story from it</span></label>
      <label className="radio"><input type="radio" checked={!draft} onChange={() => setDraft(false)} />Approve only (I'll commission it by email)</label>
      <p className="faint" style={{ margin: 0 }}>The writer is not emailed automatically. Use “Reply by email” to let them know.</p>
    </Dialog>
  );
}

function DeclineDialog({ open, onClose, busy, onDecline }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(true);
  useEffect(() => { if (open) { setReason(REASONS[0]); setNote(''); setEmail(true); } }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="Why are you declining?" sub="Your reason is saved with the pitch."
      footer={<><button className="btn" onClick={onClose}>Cancel</button><Btn className="primary" busy={busy} onClick={() => onDecline(reason, note.trim(), email)}>Decline pitch</Btn></>}>
      {REASONS.map((r) => <label key={r} className="radio"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />{r}</label>)}
      <textarea className="textarea" rows={3} placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="row" style={{ cursor: 'pointer', fontWeight: 700 }}><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} style={{ accentColor: '#c4262e', width: 16, height: 16 }} />Open an email to let the writer know</label>
    </Dialog>
  );
}

function mailto(p, kind, reason) {
  const first = (p.name || '').split(' ')[0];
  const subject = 'Your pitch to The Nile Pen' + (p.headline ? ': ' + p.headline : '');
  const body = kind === 'decline'
    ? `Hi ${first},\n\nThank you for pitching “${p.headline || 'your story'}” to The Nile Pen. We've read it carefully and it isn't one we can take on right now${reason ? ' (' + reason.toLowerCase() + ')' : ''}.\n\nPlease do send us other ideas.\n\nBest wishes,\nThe Nile Pen`
    : `Hi ${first},\n\nThank you for pitching “${p.headline || 'your story'}” to The Nile Pen.\n\n\n\nBest wishes,\nThe Nile Pen`;
  return `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
