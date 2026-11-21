import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Upload, ImagePlus, Check, Crop } from 'lucide-react';
import { supabase, mediaUrl, must } from '../lib/supabase.js';
import { loadImage, render, toBlob } from '../lib/image.js';
import { slugify } from '../lib/util.js';
import { Btn, Dialog, Empty, SkeletonRows, useToast } from './ui.jsx';
import { markGuideStep } from './GettingStarted.jsx';

const ASPECTS = [['Original', null], ['Wide 16:9', 16 / 9], ['Landscape 4:3', 4 / 3], ['Square', 1], ['Portrait 4:5', 4 / 5]];
export const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

/** Upload a Blob to the media bucket and return its public URL. */
export async function uploadBlob(blob, baseName) {
  const d = new Date();
  const ext = blob.type === 'image/gif' ? 'gif' : blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${slugify(baseName || 'image').slice(0, 50) || 'image'}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  must(await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }));
  markGuideStep('photo');
  return { path, url: mediaUrl(path) };
}

/**
 * Crop / rotate / resize an image before it is uploaded.
 * source: a File, or the URL of an image already in the library.
 */
export function ImageEditor({ open, source, name, onClose, onSaved, defaultAspect = 16 / 9 }) {
  const toast = useToast();
  const [img, setImg] = useState(null);
  const [o, setO] = useState({ rotate: 0, aspect: defaultAspect, focusX: 0.5, focusY: 0.5, zoom: 1, maxWidth: 2000 });
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open || !source) return;
    setO({ rotate: 0, aspect: defaultAspect, focusX: 0.5, focusY: 0.5, zoom: 1, maxWidth: 2000 });
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    loadImage(url).then(setImg).catch((e) => { toast.error(e); onClose(); });
    return () => { if (source instanceof Blob) URL.revokeObjectURL(url); };
  }, [open, source]);

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const out = render(img, { ...o, maxWidth: 1100 });
    const c = canvasRef.current; c.width = out.width; c.height = out.height;
    c.getContext('2d').drawImage(out, 0, 0);
  }, [img, o]);

  const save = async () => {
    setBusy(true);
    try {
      const keepGif = source instanceof Blob && source.type === 'image/gif' && o.rotate === 0 && !o.aspect && o.zoom === 1;
      const blob = keepGif ? source : await toBlob(render(img, o), 'image/webp', 0.84);
      const res = await uploadBlob(blob, name || (source instanceof File ? source.name.replace(/\.[^.]+$/, '') : 'image'));
      toast('Image saved to the media library.');
      onSaved(res);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const set = (k) => (e) => setO((x) => ({ ...x, [k]: typeof e === 'object' ? Number(e.target.value) : e }));
  return (
    <Dialog open={open} onClose={onClose} wide title="Edit image" sub="Crop, straighten and resize. Images are compressed for fast loading."
      footer={<><button className="btn" onClick={onClose}>Cancel</button><Btn className="primary" busy={busy} disabled={!img} onClick={save}><Check />Save image</Btn></>}>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 18 }}>
        <div className="crop-stage">{img ? <canvas ref={canvasRef} aria-label="Image preview" /> : <span className="faint" style={{ color: '#b9bec4' }}>Loading image…</span>}</div>
        <div className="col" style={{ gap: 16 }}>
          <div className="field"><span>Shape</span>
            <div className="chips">{ASPECTS.map(([l, a]) => <button key={l} type="button" className={'chip' + (o.aspect === a ? ' on' : '')} onClick={() => setO((x) => ({ ...x, aspect: a }))}>{l}</button>)}</div>
          </div>
          <div className="field"><span>Rotate</span>
            <div className="row">
              <button type="button" className="btn sm" onClick={() => setO((x) => ({ ...x, rotate: x.rotate - 90 }))}><RotateCcw />Left</button>
              <button type="button" className="btn sm" onClick={() => setO((x) => ({ ...x, rotate: x.rotate + 90 }))}><RotateCw />Right</button>
            </div>
          </div>
          <label className="field"><span>Zoom</span><input type="range" min="1" max="3" step="0.05" value={o.zoom} onChange={set('zoom')} style={{ accentColor: '#c4262e' }} /></label>
          <label className="field"><span>Move left / right</span><input type="range" min="0" max="1" step="0.01" value={o.focusX} onChange={set('focusX')} style={{ accentColor: '#c4262e' }} /></label>
          <label className="field"><span>Move up / down</span><input type="range" min="0" max="1" step="0.01" value={o.focusY} onChange={set('focusY')} style={{ accentColor: '#c4262e' }} /></label>
          <label className="field"><span>Size</span>
            <select className="select" value={o.maxWidth} onChange={set('maxWidth')}>
              <option value={2400}>Large, 2400 px wide</option><option value={2000}>Standard, 2000 px wide</option><option value={1200}>Small, 1200 px wide</option>
            </select>
          </label>
        </div>
      </div>
    </Dialog>
  );
}

/** Browse the media library; returns a URL. Also lets you upload (through the editor). */
export function MediaPicker({ open, onClose, onPick, title = 'Choose an image', defaultAspect = 16 / 9 }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => { setItems(null); setItems(await listMedia().catch((e) => { toast.error(e); return []; })); }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const takeFile = (f) => {
    if (!f) return;
    if (!ACCEPT.split(',').includes(f.type)) return toast.error('Please choose a JPG, PNG, WebP, GIF or AVIF image.');
    if (f.size > 25 * 1024 * 1024) return toast.error('That file is over 25 MB. Please choose a smaller image.');
    setEditing(f);
  };

  return (
    <>
      <Dialog open={open && !editing} onClose={onClose} wide title={title} sub="Pick from the library or upload a new photo.">
        <div className={'dropzone' + (drag ? ' drag' : '')}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); takeFile(e.dataTransfer.files[0]); }}>
          <ImagePlus size={26} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 800, color: 'var(--ink)' }}>Drop a photo here</div>
          <div className="faint" style={{ marginBottom: 10 }}>or</div>
          <button type="button" className="btn primary" onClick={() => fileRef.current.click()}><Upload />Upload from your device</button>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => { takeFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
        {items == null ? <SkeletonRows n={2} h={120} /> : items.length ? (
          <div className="media-grid">
            {items.map((m) => (
              <button key={m.path} type="button" className="media-tile" onClick={() => onPick(m.url)} title={m.name}>
                <img src={m.url} alt="" loading="lazy" /><div className="cap ellipsis">{m.name}</div>
              </button>
            ))}
          </div>
        ) : <Empty icon={ImagePlus} title="The library is empty">Photos you upload are kept here so you can reuse them.</Empty>}
      </Dialog>
      <ImageEditor open={!!editing} source={editing} defaultAspect={defaultAspect} onClose={() => setEditing(null)}
        onSaved={(r) => { setEditing(null); onPick(r.url); }} />
    </>
  );
}

/** Lists every file in the media bucket (two levels of year/month folders). */
export async function listMedia() {
  const out = [];
  const list = async (prefix) => must(await supabase.storage.from('media').list(prefix, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } }));
  for (const y of await list('')) {
    if (y.id) { out.push(entry(y.name, y)); continue; }
    for (const m of await list(y.name)) {
      if (m.id) { out.push(entry(y.name + '/' + m.name, m)); continue; }
      for (const f of await list(y.name + '/' + m.name)) if (f.id) out.push(entry(`${y.name}/${m.name}/${f.name}`, f));
    }
  }
  return out.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}
const entry = (path, f) => ({ path, name: f.name, url: mediaUrl(path), size: f.metadata?.size, created: f.created_at });

export { Crop };
