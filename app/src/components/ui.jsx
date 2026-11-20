import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, text, ...opts }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), opts.ms || (opts.error ? 7000 : 4200));
  }, []);
  const toast = useCallback((text, opts) => push(text, opts), [push]);
  toast.error = (e) => push(e instanceof Error ? e.message : String(e), { error: true });
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={'toast' + (t.error ? ' error' : '')}>
            {t.error ? <AlertCircle /> : <CheckCircle2 />}
            <span>{t.text}</span>
            {t.action && <button onClick={() => { t.action.run(); setItems((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- dialog (native <dialog>: focus trap, Esc, backdrop) ---------- */
export function Dialog({ open, onClose, title, sub, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={'dlg' + (wide ? ' wide' : '')} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <>
          <div className="dlg-head">
            <div><h2>{title}</h2>{sub && <div className="faint" style={{ marginTop: 4 }}>{sub}</div>}</div>
            <button className="btn ghost icon sm" onClick={onClose} aria-label="Close"><X /></button>
          </div>
          <div className="dlg-body">{children}</div>
          {footer && <div className="dlg-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

/** Promise-based confirm, rendered by <ConfirmHost/>. */
let confirmSetter = null;
export function confirmAction(opts) {
  return new Promise((resolve) => confirmSetter && confirmSetter({ ...opts, resolve }));
}
export function ConfirmHost() {
  const [c, setC] = useState(null);
  useEffect(() => { confirmSetter = setC; return () => { confirmSetter = null; }; }, []);
  const done = (v) => { c && c.resolve(v); setC(null); };
  return (
    <Dialog open={!!c} onClose={() => done(false)} title={c?.title} footer={c && (
      <>
        <button className="btn" onClick={() => done(false)}>Cancel</button>
        <button className={'btn ' + (c.danger ? 'primary' : 'dark')} onClick={() => done(true)} autoFocus>{c.confirm || 'Confirm'}</button>
      </>
    )}>
      {c?.body && <p className="muted" style={{ margin: 0 }}>{c.body}</p>}
    </Dialog>
  );
}

export function Btn({ busy, children, className = '', ...p }) {
  return (
    <button className={'btn ' + className} disabled={busy || p.disabled} {...p}>
      {busy ? <Loader2 className="spin" /> : null}
      {children}
    </button>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <div className="ic"><Icon /></div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function SkeletonRows({ n = 5, h = 44 }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ height: h }} />)}
    </div>
  );
}

export function Badge({ status, children }) {
  return <span className={'badge ' + (status || '')}>{children || cap(status)}</span>;
}
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

export function Switch({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="switch">
      <span><span className="h3" style={{ display: 'block' }}>{label}</span>{hint && <span className="faint">{hint}</span>}</span>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Initials({ name, src, size = 34 }) {
  const ini = String(name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{src ? <img src={src} alt="" /> : ini}</span>;
}

/** Card-tone thumbnail used when a story has no photo (matches the public site's generated cards). */
export const TONE = { 'south-sudan': '#121417', 'human-rights': '#3a1418', diaspora: '#123d30', opinion: '#1d2430', climate: '#2b2416', 'water-land': '#0f2c3a' };
export function Thumb({ article }) {
  if (article?.image_url) return <img className="thumb" src={article.image_url} alt="" loading="lazy" />;
  const t = (article?.topics || [])[0];
  return <span className="thumb card-tone" style={{ background: TONE[t] || '#1d2430' }} aria-hidden="true">N</span>;
}
