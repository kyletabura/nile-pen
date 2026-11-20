export const slugify = (s) =>
  String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80).replace(/-+$/, '');

export const today = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (d) =>
  d ? new Date(String(d).length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fmtDateLong = (d) =>
  d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24); if (d < 7) return d + ' d ago';
  return fmtDate(ts);
}

export const words = (text) => (String(text || '').trim().match(/\S+/g) || []).length;
export const readTime = (n) => Math.max(1, Math.round(n / 220)) + ' min read';

/** Body is stored as an array of paragraphs; the editor shows them separated by a blank line. */
export const bodyToText = (arr) => (arr || []).join('\n\n');
export const textToBody = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

export function toCsv(rows, cols) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const isUrl = (s) => /^https?:\/\/\S+\.\S+/.test(String(s || '').trim());
export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '').trim());
