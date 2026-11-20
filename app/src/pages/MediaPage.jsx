import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, Copy, Trash2, Crop, ExternalLink } from 'lucide-react';
import { supabase, must } from '../lib/supabase.js';
import { Dialog, Empty, SkeletonRows, confirmAction, useToast } from '../components/ui.jsx';
import { ImageEditor, listMedia, ACCEPT } from '../components/Media.jsx';
import { fmtDate } from '../lib/util.js';

export default function MediaPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [queue, setQueue] = useState([]);        // files waiting for the editor
  const [editSrc, setEditSrc] = useState(null);  // existing image being re-edited
  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const load = async () => { setItems(await listMedia().catch((e) => { toast.error(e); return []; })); };
  useEffect(() => { load(); }, []);

  const take = (files) => {
    const ok = [...files].filter((f) => ACCEPT.split(',').includes(f.type) && f.size <= 25 * 1024 * 1024);
    if (ok.length < files.length) toast.error('Some files were skipped. Use JPG, PNG, WebP, GIF or AVIF under 25 MB.');
    setQueue(ok);
  };

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Media library</h1><p>Photos for stories and Live updates. Every upload is cropped and compressed for fast pages.</p></div>
        <button className="btn primary" onClick={() => fileRef.current.click()}><Upload />Upload photos</button>
        <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      </div>

      <div className={'dropzone' + (drag ? ' drag' : '')} style={{ marginBottom: 18 }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}>
        <span className="row" style={{ justifyContent: 'center' }}><ImagePlus size={20} /><b style={{ color: 'var(--ink)' }}>Drag photos here to upload</b></span>
      </div>

      {items == null ? <div className="card"><SkeletonRows n={3} h={140} /></div> : items.length ? (
        <div className="media-grid">
          {items.map((m) => (
            <button key={m.path} type="button" className="media-tile" onClick={() => setSel(m)}>
              <img src={m.url} alt="" loading="lazy" />
              <div className="cap"><div className="ellipsis">{m.name}</div><div className="faint">{fmtDate(m.created)}{m.size ? ' · ' + Math.round(m.size / 1024) + ' KB' : ''}</div></div>
            </button>
          ))}
        </div>
      ) : <div className="card"><Empty icon={ImagePlus} title="No photos yet" action={<button className="btn primary" onClick={() => fileRef.current.click()}><Upload />Upload the first photo</button>}>Upload photos here, or straight from a story's “Main image” box.</Empty></div>}

      <Dialog open={!!sel} onClose={() => setSel(null)} title={sel?.name} sub={sel && fmtDate(sel.created)} wide
        footer={sel && (
          <>
            <button className="btn danger" onClick={async () => {
              if (!(await confirmAction({ title: 'Delete this photo?', body: 'Any story still using it will show a branded card instead. This cannot be undone.', confirm: 'Delete photo', danger: true }))) return;
              try { must(await supabase.storage.from('media').remove([sel.path])); setItems((xs) => xs.filter((x) => x.path !== sel.path)); setSel(null); toast('Photo deleted.'); } catch (e) { toast.error(e); }
            }}><Trash2 />Delete</button>
            <div className="grow" />
            <a className="btn" href={sel.url} target="_blank" rel="noopener"><ExternalLink />Open</a>
            <button className="btn" onClick={() => { setEditSrc(sel.url); setSel(null); }}><Crop />Edit a copy</button>
            <button className="btn dark" onClick={async () => { await navigator.clipboard.writeText(sel.url); toast('Link copied.'); }}><Copy />Copy link</button>
          </>
        )}>
        {sel && <img src={sel.url} alt="" style={{ borderRadius: 14, maxHeight: '60vh', margin: '0 auto', objectFit: 'contain' }} />}
      </Dialog>

      <ImageEditor open={queue.length > 0} source={queue[0]} defaultAspect={null}
        onClose={() => setQueue((q) => q.slice(1))} onSaved={() => { setQueue((q) => q.slice(1)); load(); }} />
      <ImageEditor open={!!editSrc} source={editSrc} defaultAspect={null} onClose={() => setEditSrc(null)} onSaved={() => { setEditSrc(null); load(); }} />
    </>
  );
}
