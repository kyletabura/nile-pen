import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useBlocker } from 'react-router-dom';
import {
  ArrowLeft, Eye, ImagePlus, Trash2, Archive, Send, Save, Undo2, ExternalLink, Crop, X, Link2, Star, CheckCircle2, Info,
} from 'lucide-react';
import { supabase, must, requestPublish, SITE_URL } from '../lib/supabase.js';
import { useAuth, bump } from '../lib/auth.jsx';
import { Badge, Btn, Dialog, Switch, confirmAction, useToast, SkeletonRows, TONE } from '../components/ui.jsx';
import { MediaPicker, ImageEditor } from '../components/Media.jsx';
import { markGuideStep } from '../components/GettingStarted.jsx';
import { slugify, today, words, readTime, bodyToText, textToBody, fmtDateLong, isUrl } from '../lib/util.js';

const blank = (brief, editor) => ({
  title: '', dek: '', bodyText: '', topics: [], author: brief ? 'Nile Pen News Desk' : (editor?.name || ''),
  published_on: today(), image_url: '', image_credit: '', image_source: '', featured: false,
  source_label: '', source_url: '', slug: '', status: 'draft', is_brief: brief,
});

export default function StoryEditor({ brief: briefRoute = false }) {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { editor } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [topics, setTopics] = useState([]);
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(null);       // last saved snapshot (to detect unsaved changes)
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState('');
  const [picker, setPicker] = useState(false);
  const [editImg, setEditImg] = useState(false);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState({});
  const bodyRef = useRef(null);
  const paperRef = useRef(null);
  // size the headline, standfirst and body boxes to their text (on load, on change, on resize)
  const fitAll = () => paperRef.current?.querySelectorAll('textarea').forEach((t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });
  useLayoutEffect(fitAll, [f?.title, f?.dek, f?.bodyText, !!f]);
  useEffect(() => { window.addEventListener('resize', fitAll); document.fonts?.ready.then(fitAll); return () => window.removeEventListener('resize', fitAll); }, []);

  useEffect(() => {
    (async () => {
      try {
        setTopics(must(await supabase.from('topics').select('slug,name').order('sort')));
        if (isNew) {
          const b = blank(briefRoute, editor);
          setF(b); setSaved(JSON.stringify(b)); setSlugTouched(false);
        } else {
          const a = must(await supabase.from('articles').select('*').eq('id', id).maybeSingle());
          if (!a) { toast.error('That story no longer exists.'); nav(briefRoute ? '/live' : '/stories'); return; }
          const v = { ...a, bodyText: bodyToText(a.body), image_url: a.image_url || '', image_credit: a.image_credit || '', image_source: a.image_source || '', source_label: a.source_label || '', source_url: a.source_url || '' };
          setF(v); setSaved(JSON.stringify(v)); setSlugTouched(true);
        }
      } catch (e) { toast.error(e); }
    })();
  }, [id]);

  const dirty = f && saved !== JSON.stringify(f);
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !busy && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirmAction({ title: 'Leave without saving?', body: 'Your latest changes to this story have not been saved.', confirm: 'Leave', danger: true })
      .then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker.state]);

  const set = (k, v) => setF((x) => {
    const n = { ...x, [k]: v };
    if (k === 'title' && !slugTouched && x.status !== 'published') n.slug = slugify(v);
    return n;
  });
  const brief = f?.is_brief;
  const wc = useMemo(() => words((f?.dek || '') + ' ' + (f?.bodyText || '')), [f?.dek, f?.bodyText]);
  const base = brief ? '/live' : '/stories';

  const validate = (publishing) => {
    const e = {};
    if (!f.title.trim()) e.title = 'Add a headline.';
    if (!f.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) e.slug = 'Use lowercase letters, numbers and dashes only.';
    if (publishing) {
      if (!f.topics.length) e.topics = 'Choose at least one topic.';
      if (!f.dek.trim()) e.dek = brief ? 'Write a one-paragraph summary.' : 'Add a standfirst (the short intro under the headline).';
      if (!brief && !f.bodyText.trim()) e.body = 'The story has no text yet.';
      if (brief && !f.source_label.trim()) e.source_label = 'Name the outlet you are summarising.';
      if (brief && !isUrl(f.source_url)) e.source_url = 'Add a link to the original report (starting with https://).';
      if (!f.author.trim()) e.author = 'Add a byline.';
    }
    if (f.source_url && !isUrl(f.source_url)) e.source_url = 'That link does not look right. It should start with https://';
    setErrors(e);
    if (Object.keys(e).length) { toast.error(Object.values(e)[0]); return false; }
    return true;
  };

  const save = useCallback(async (status, { publish = false, quiet = false } = {}) => {
    const next = status || f.status;
    if (!validate(next === 'published')) return null;
    setBusy(status || 'save');
    try {
      const row = {
        title: f.title.trim(), dek: f.dek.trim(), body: textToBody(f.bodyText), topics: f.topics, author: f.author.trim() || 'Nile Pen News Desk',
        published_on: f.published_on || today(), date_label: null, read_time: brief ? '2 min read' : readTime(wc),
        image_url: f.image_url.trim() || null, image_credit: f.image_credit.trim() || null, image_source: f.image_source.trim() || null,
        featured: !brief && !!f.featured, is_brief: !!brief, source_label: f.source_label.trim() || null, source_url: f.source_url.trim() || null,
        slug: f.slug, status: next,
      };
      const wasPublished = saved && JSON.parse(saved).status === 'published';
      const res = isNew
        ? must(await supabase.from('articles').insert(row).select().single())
        : must(await supabase.from('articles').update(row).eq('id', id).select().single());
      const v = { ...res, bodyText: bodyToText(res.body), image_url: res.image_url || '', image_credit: res.image_credit || '', image_source: res.image_source || '', source_label: res.source_label || '', source_url: res.source_url || '' };
      setF(v); setSaved(JSON.stringify(v));
      if (publish || next === 'published' || wasPublished) {
        await requestPublish((next === 'published' ? 'Published: ' : 'Updated: ') + row.title);
        if (!quiet) toast(next === 'published' ? (wasPublished ? 'Changes saved. The site updates in about a minute.' : 'Published. It will be live on thenilepen.com in about a minute.') : 'Saved and taken off the site.', {
          action: next === 'published' ? { label: 'View', run: () => window.open(SITE_URL + '/article/' + res.slug, '_blank', 'noopener') } : undefined,
        });
      } else if (!quiet) toast('Draft saved.');
      bump(); markGuideStep('story');
      if (isNew) nav(base + '/' + res.id, { replace: true });
      return res;
    } catch (e) { toast.error(e); return null; } finally { setBusy(''); }
  }, [f, saved, isNew, id, wc, brief]);

  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (f && !busy) save(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [f, busy, save]);

  const remove = async () => {
    const ok = await confirmAction({ title: 'Delete this story?', body: 'It will be removed from the dashboard' + (f.status === 'published' ? ' and from the live site' : '') + '. This cannot be undone. To hide it but keep a copy, archive it instead.', confirm: 'Delete story', danger: true });
    if (!ok) return;
    setBusy('delete');
    try {
      must(await supabase.from('articles').delete().eq('id', id));
      if (f.status === 'published') await requestPublish('Deleted: ' + f.title);
      setSaved(JSON.stringify(f)); toast('Story deleted.'); bump(); nav(base);
    } catch (e) { toast.error(e); setBusy(''); }
  };

  if (!f) return <div className="card" style={{ marginTop: 24 }}><SkeletonRows n={8} h={36} /></div>;

  const toggleTopic = (s) => set('topics', f.topics.includes(s) ? f.topics.filter((x) => x !== s) : [...f.topics, s]);
  const autoGrow = (e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; };
  const pub = f.status === 'published';

  return (
    <>
      <div className="editor-bar">
        <Link to={base} className="btn ghost sm"><ArrowLeft />{brief ? 'Live updates' : 'Stories'}</Link>
        <Badge status={f.status} />
        {brief && <span className="badge live plain">Live update</span>}
        <span className="saved">{busy ? 'Saving…' : dirty ? 'Unsaved changes' : !isNew ? <><CheckCircle2 />All changes saved</> : ''}</span>
        <div className="grow" />
        <button className="btn sm" onClick={() => setPreview(true)}><Eye />Preview</button>
        {pub && <a className="btn sm" href={SITE_URL + '/article/' + f.slug} target="_blank" rel="noopener"><ExternalLink />Open on site</a>}
        {!pub && <Btn className="sm" busy={busy === 'draft'} onClick={() => save('draft')}><Save />Save draft</Btn>}
        {pub
          ? <Btn className="primary sm" busy={busy === 'published'} disabled={!dirty} onClick={() => save('published')}><Send />Update live story</Btn>
          : <Btn className="primary sm" busy={busy === 'published'} onClick={() => save('published')}><Send />Publish</Btn>}
      </div>

      <div className="editor">
        <article className="card editor-paper" ref={paperRef}>
          <div className="chips" aria-label="Topics">
            {topics.map((t) => {
              const on = f.topics.includes(t.slug); const primary = f.topics[0] === t.slug;
              return <button key={t.slug} type="button" className={'chip' + (on ? ' on' : '') + (primary ? ' primary-topic' : '')} aria-pressed={on} onClick={() => toggleTopic(t.slug)} title={primary ? 'Main topic' : ''}>{t.name}</button>;
            })}
          </div>
          {errors.topics && <small style={{ color: 'var(--red)', fontWeight: 700 }}>{errors.topics}</small>}
          <textarea className="title-input" rows={1} placeholder={brief ? 'Headline of the update' : 'Headline'} value={f.title} aria-label="Headline"
            onChange={(e) => { set('title', e.target.value); autoGrow(e); }} onFocus={autoGrow} maxLength={300} />
          <textarea className="dek-input" rows={1} placeholder={brief ? 'Summary: what happened, in one or two sentences' : 'Standfirst: one or two sentences that make readers want to continue'}
            value={f.dek} aria-label="Standfirst" onChange={(e) => { set('dek', e.target.value); autoGrow(e); }} onFocus={autoGrow} />
          <div style={{ height: 1, background: 'var(--line)' }} />
          <textarea ref={bodyRef} className="body-input" aria-label="Story text"
            placeholder={brief ? 'Optional: a second paragraph with context.\n\nLeave a blank line between paragraphs.' : 'Write the story here.\n\nLeave a blank line between paragraphs.'}
            value={f.bodyText} onChange={(e) => { set('bodyText', e.target.value); autoGrow(e); }} onFocus={autoGrow} />
          <div className="spread faint"><span>{wc} words · {brief ? '2 min read' : readTime(wc)}</span><span className="hide-mobile">Ctrl S saves</span></div>
        </article>

        <aside className="editor-side">
          <section className="card">
            <div className="side-section">
              <span className="h3">Main image</span>
              <div className="hero-drop" onClick={() => !f.image_url && setPicker(true)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && !f.image_url && setPicker(true)}
                style={!f.image_url ? { background: f.topics[0] ? TONE[f.topics[0]] || '#1d2430' : undefined, color: f.topics[0] ? '#fff' : undefined } : undefined}>
                {f.image_url ? <img src={f.image_url} alt="" /> : (
                  <span className="col" style={{ alignItems: 'center', gap: 6, padding: 12 }}>
                    <ImagePlus size={24} />
                    <span style={{ fontWeight: 800 }}>Add a photo</span>
                    <span className="small" style={{ opacity: 0.8 }}>Without one, the site shows a branded card</span>
                  </span>
                )}
                {f.image_url && (
                  <span className="hero-actions">
                    {/supabase\.co/.test(f.image_url) && <button className="btn sm" onClick={(e) => { e.stopPropagation(); setEditImg(true); }}><Crop />Edit</button>}
                    <button className="btn sm" onClick={(e) => { e.stopPropagation(); setPicker(true); }}>Replace</button>
                    <button className="btn sm icon" aria-label="Remove image" onClick={(e) => { e.stopPropagation(); set('image_url', ''); }}><X /></button>
                  </span>
                )}
              </div>
              <label className="field"><span>Photo credit</span><input className="input" value={f.image_credit} onChange={(e) => set('image_credit', e.target.value)} placeholder="e.g. Amara Deng" /></label>
              <label className="field"><span>Photo source</span><input className="input" value={f.image_source} onChange={(e) => set('image_source', e.target.value)} placeholder="e.g. Reuters, or the photographer's agency" /></label>
            </div>
          </section>

          <section className="card">
            <div className="side-section">
              <label className="field"><span>Byline</span>
                <input className={'input' + (errors.author ? ' invalid' : '')} value={f.author} onChange={(e) => set('author', e.target.value)} placeholder="Writer's name" /></label>
              <label className="field"><span>Publication date</span>
                <input className="input" type="date" value={f.published_on || ''} onChange={(e) => set('published_on', e.target.value)} />
                <small>Shown as {fmtDateLong(f.published_on)}. Stories are ordered by this date.</small></label>
              {!brief && <Switch label="Feature on the homepage" hint="Leads the rotating hero at the top" checked={f.featured} onChange={(v) => set('featured', v)} />}
            </div>
            {brief && (
              <div className="side-section">
                <span className="h3 row" style={{ gap: 6 }}><Link2 size={16} />Original reporting</span>
                <label className="field"><span>Outlet</span><input className={'input' + (errors.source_label ? ' invalid' : '')} value={f.source_label} onChange={(e) => set('source_label', e.target.value)} placeholder="e.g. Radio Tamazuj" /></label>
                <label className="field"><span>Link to the original</span><input className={'input' + (errors.source_url ? ' invalid' : '')} value={f.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://" inputMode="url" /></label>
                <small className="faint">Readers see “This is a Nile Pen summary of reporting by {f.source_label || 'the outlet'}” with this link.</small>
              </div>
            )}
          </section>

          <section className="card">
            <div className="side-section">
              <span className="h3">Search and sharing</span>
              <div className="serp" aria-label="Google preview">
                <div className="u">thenilepen.com › article › {f.slug || 'web-address'}</div>
                <div className="t">{(f.title || 'Headline') + ' — The Nile Pen'}</div>
                <div className="d">{(f.dek || 'The standfirst is used as the description in Google and on social media.').slice(0, 158)}</div>
              </div>
              <label className="field"><span>Web address</span>
                <input className={'input' + (errors.slug ? ' invalid' : '')} value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
                <small>{pub ? 'Changing this breaks links people have already shared.' : 'Made from the headline. Keep it short.'}</small></label>
            </div>
          </section>

          {!isNew && (
            <section className="card">
              <div className="side-section">
                {pub && <Btn className="sm" busy={busy === 'draft'} onClick={() => save('draft')}><Undo2 />Unpublish (back to draft)</Btn>}
                {f.status !== 'archived'
                  ? <Btn className="sm" busy={busy === 'archived'} onClick={() => save('archived')}><Archive />Archive</Btn>
                  : <Btn className="sm" busy={busy === 'draft'} onClick={() => save('draft')}><Undo2 />Restore as draft</Btn>}
                <Btn className="sm danger" busy={busy === 'delete'} onClick={remove}><Trash2 />Delete permanently</Btn>
              </div>
            </section>
          )}
        </aside>
      </div>

      <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(url) => { set('image_url', url); setPicker(false); }} />
      <ImageEditor open={editImg} source={f.image_url} name={f.slug} onClose={() => setEditImg(false)} onSaved={(r) => { set('image_url', r.url); setEditImg(false); }} />
      <Preview open={preview} onClose={() => setPreview(false)} f={f} topics={topics} wc={wc} />
    </>
  );
}

function Preview({ open, onClose, f, topics, wc }) {
  const t = topics.find((x) => x.slug === f.topics[0]);
  const paras = textToBody(f.bodyText).filter((p, i) => !(i === 0 && p === f.dek.trim()));
  return (
    <Dialog open={open} onClose={onClose} wide title="Preview" sub="An approximation of how the story reads on thenilepen.com.">
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <div style={{ position: 'relative', aspectRatio: '21 / 9', background: f.image_url ? '#000' : TONE[f.topics[0]] || '#121417', display: 'flex', alignItems: 'flex-end' }}>
          {f.image_url && <img src={f.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />}
          <div style={{ position: 'relative', padding: '28px 32px', background: 'linear-gradient(transparent, rgba(0,0,0,.75))', width: '100%' }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              {t && <span style={{ background: '#c4262e', color: '#fff', fontWeight: 800, fontSize: 12, padding: '4px 10px', borderRadius: 99 }}>{t.name}</span>}
              <span style={{ color: '#e3e5e8', fontSize: 13 }}>{fmtDateLong(f.published_on)} · {f.is_brief ? '2 min read' : readTime(wc)}</span>
            </div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 40, lineHeight: 1.05, color: '#fff' }}>{f.title || 'Headline'}</div>
          </div>
        </div>
        <div style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
          <div className="faint" style={{ fontWeight: 700 }}>By {f.author}</div>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 600, lineHeight: 1.5 }}>{f.dek}</p>
          {paras.map((p, i) => <p key={i} style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: '#1e2226' }}>{p}</p>)}
          {f.image_credit && <p className="faint" style={{ margin: 0 }}>Photo: {f.image_credit}{f.image_source ? ' / ' + f.image_source : ''}</p>}
          {f.is_brief && f.source_label && <div className="note neutral"><Info /><span>This is a Nile Pen summary of reporting by <b>{f.source_label}</b>.</span></div>}
        </div>
      </div>
    </Dialog>
  );
}
