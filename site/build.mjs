// Builds thenilepen.com: pulls published content from Supabase (the CMS behind
// app.thenilepen.com) and writes one static HTML page per URL into dist/.
// usage: node build.mjs            (Vercel runs this on every deploy)
import fs from 'fs'; import path from 'path'; import vm from 'vm'; import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'src'), PUBLIC = path.join(HERE, 'public'), OUT = path.join(HERE, 'dist');
const SITE = 'https://thenilepen.com';
const SB_URL = process.env.SUPABASE_URL || 'https://kfnjlsxtocwhkuyhjtiw.supabase.co';
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_blZrqupJjsRWeez6xwlOtw_dEHm9P9s';
let t = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');

const must = (from, to) => { if (!t.includes(from)) throw new Error('pattern not found: ' + from.slice(0, 80)); t = t.split(from).join(to); };

// 0. Load published content from the CMS. Fail the build rather than publish an empty site.
const sb = async (q) => {
  const r = await fetch(SB_URL + '/rest/v1/' + q, { headers: { apikey: SB_KEY } });
  if (!r.ok) throw new Error('Supabase ' + q + ' -> ' + r.status + ' ' + await r.text());
  return r.json();
};
const [dbTopics, dbArticles, dbSettings] = await Promise.all([
  sb('topics?select=slug,name,nav,description,sort&order=sort.asc'),
  sb('articles?select=*&status=eq.published&order=published_on.asc,created_at.asc'),
  sb('settings?select=key,value'),
]);
if (!dbTopics.length || !dbArticles.length) throw new Error('CMS returned no topics or articles; refusing to publish an empty site');
const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const readTime = (a) => Math.max(1, Math.round([a.dek, ...(a.body || [])].join(' ').split(/\s+/).length / 220)) + ' min read';
const settings = Object.fromEntries(dbSettings.map(s => [s.key, s.value]));
const CMS = {
  topics: dbTopics.map(x => ({ slug: x.slug, name: x.name, nav: x.nav, desc: x.description })),
  settings,
  articles: dbArticles.filter(a => a.topics && a.topics.length).map(a => ({
    id: a.slug, title: a.title, dek: a.dek || '', body: a.body || [], topics: a.topics,
    author: a.author, authorImage: a.author_image || null, d: a.published_on, date: a.date_label || fmtDate(a.published_on),
    read: a.read_time || readTime(a), img: a.image_url || null, imageCredit: a.image_credit || '', imageSource: a.image_source || '',
    isBrief: !!a.is_brief, featured: !!a.featured, source: a.source_label || undefined, url: a.source_url || undefined, updated: (a.updated_at || '').slice(0, 10),
  })),
};
const knownTopics = new Set(CMS.topics.map(x => x.slug));
CMS.articles = CMS.articles.filter(a => knownTopics.has(a.topics[0]));
console.log('CMS:', CMS.topics.length, 'topics,', CMS.articles.length, 'published articles');

// 0b. Swap the hard-coded sample data for the CMS content
{
  const start = t.indexOf('const TOPICS = [');
  const endMark = '.sort((x, y) => y.d.localeCompare(x.d));';
  const end = t.indexOf(endMark, start) + endMark.length;
  const poolStart = t.indexOf('const POOL = {'), poolEnd = t.indexOf('const PORTRAITS = {');
  if (start < 0 || end < endMark.length || poolStart < start || poolEnd > end) throw new Error('data region not found');
  const pool = t.slice(poolStart, poolEnd);
  const region = `const CMS = ${JSON.stringify(CMS).replace(/</g, '\\u003c')};
const TOPICS = CMS.topics;
const TOPIC_ORDER = TOPICS.map(t => t.slug);
TOPICS.forEach(t => { if (!TONE[t.slug]) TONE[t.slug] = '#1d2430'; });
${pool}let poolIdx = {};
const ALL = CMS.articles.map(a => { const t = a.topics[0]; let img = a.img; if (!img) { poolIdx[t] = poolIdx[t] || 0; const k = poolIdx[t]++; img = (CARD_TOPICS.includes(t) || !POOL[t]) ? CARD(t, k) : IMG + POOL[t][k % POOL[t].length]; }
    const credit = a.imageCredit ? 'Photo: ' + a.imageCredit + (a.imageSource ? ' / ' + a.imageSource : '') : (a.isBrief && !a.img ? 'Image is illustrative.' : '');
    return { ...a, topic: t, img, credit, portrait: a.isBrief ? img : (a.authorImage || AV(a.author)) }; })
  .map(a => {
    const t = TOPICS.find(x => x.slug === a.topic);
    return { ...a, topicName: t.name, topicHref: '/topic/' + t.slug, href: '/article/' + a.id, slotLead: a.id + '-lead', slotSide: a.id + '-side', slotCard: a.id + '-card', slotRel: a.id + '-rel', slotHero: a.id + '-hero', slotBand: a.id + '-band', slotList: a.id + '-list', isOriginal: !a.isBrief, sourceLabel: a.source || '' };
  })
  ${endMark}`;
  t = t.slice(0, start) + region + t.slice(end);
}
// Featured stories lead the homepage hero
must('const HERO = ARTICLES.slice(0, 3).concat(BRIEFS_ALL.slice(2, 4));',
  "const HERO = (() => { const f = ALL.filter(a => a.featured); const base = ARTICLES.slice(0, 3).concat(BRIEFS_ALL.slice(2, 4)); return f.concat(base, ALL).filter((a, i, arr) => arr.indexOf(a) === i).slice(0, 5); })();");
// Footer social links from dashboard settings (only the ones that are filled in)
must("{ title: 'Follow Us', links: [ext('Instagram', 'https://www.instagram.com/'), ext('X / Twitter', 'https://x.com/'), ext('Facebook', 'https://www.facebook.com/'), ext('LinkedIn', 'https://www.linkedin.com/'), ext('WhatsApp Channel', 'https://www.whatsapp.com/channel')] }",
  "{ title: 'Follow Us', links: [['Instagram', 'instagram'], ['X / Twitter', 'x'], ['Facebook', 'facebook'], ['LinkedIn', 'linkedin'], ['WhatsApp Channel', 'whatsapp']].filter(([, k]) => /^https:\\/\\//.test((CMS.settings.social || {})[k] || '')).map(([l, k]) => ext(l, CMS.settings.social[k])) }");
// Ticker on/off from dashboard settings
must('showTicker: this.props.showTicker ?? true', 'showTicker: (CMS.settings.show_ticker ?? this.props.showTicker ?? true)');
// Show every paragraph of a story (skip the first only when it repeats the standfirst)
must('artRest: art ? art.body.slice(1) : [],', 'artRest: art ? art.body.filter((p, i) => !(i === 0 && p.trim() === (art.dek || \'\').trim())) : [],');
must('<sc-if value="{{ artOriginal }}" hint-placeholder-val="{{ false }}"><p style="margin:0;font-size:13px;color:#8a8f95">Sample article text — replace with the published story.</p></sc-if>',
  '<sc-if value="{{ art.credit }}" hint-placeholder-val="{{ false }}"><p style="margin:0;font-size:13px;color:#8a8f95">{{ art.credit }}</p></sc-if>');
must('This is a Nile Pen summary of reporting by <strong>{{ art.source }}</strong>. Image is illustrative.', 'This is a Nile Pen summary of reporting by <strong>{{ art.source }}</strong>.');

// 0c. Forms save to the CMS (pitches, messages, newsletter sign-ups)
const HONEYPOT = '<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;opacity:0">';
const ERR = '<sc-if value="{{ formError }}" hint-placeholder-val="{{ false }}"><p role="alert" style="margin:0;font-size:14px;font-weight:700;color:#c4262e">{{ formError }}</p></sc-if>';
t = t.replace(/(<form sc-camel-on-submit="\{\{ (?:submitForm|nlSubmit) \}\}"[^>]*>)/g, '$1' + HONEYPOT);
must('<button type="submit" style="align-self:flex-start;display:flex;align-items:center;gap:12px;padding:6px 6px 6px 22px;border:0;border-radius:999px;background:#c4262e;color:#fff;font-size:16px;font-weight:800;cursor:pointer" style-hover="background:#a51d24">Send pitch',
  ERR + '<button type="submit" style="align-self:flex-start;display:flex;align-items:center;gap:12px;padding:6px 6px 6px 22px;border:0;border-radius:999px;background:#c4262e;color:#fff;font-size:16px;font-weight:800;cursor:pointer" style-hover="background:#a51d24">Send pitch');
must('<button type="submit" style="align-self:flex-start;font-size:16px;font-weight:800;padding:14px 24px;border:0;background:#c4262e;color:#fff;cursor:pointer;border-radius:999px" style-hover="background:#a51d24">Send message</button>',
  ERR + '<button type="submit" style="align-self:flex-start;font-size:16px;font-weight:800;padding:14px 24px;border:0;background:#c4262e;color:#fff;cursor:pointer;border-radius:999px" style-hover="background:#a51d24">Send message</button>');
must("submitForm: (e) => { e.preventDefault(); this.setState({ done: true }); },",
  `submitForm: async (e) => { e.preventDefault(); const f = e.currentTarget || e.target; if (this.state.sending) return;
        const hp = f.querySelector('[name=website]'); if (hp && hp.value) { this.setState({ done: true }); return; }
        const v = [...f.querySelectorAll('input:not([type=checkbox]):not([name=website]), textarea')].map(x => x.value.trim());
        const page = this.state.route[0]; let table, row;
        if (page === 'submit') { table = 'submissions'; row = { name: v[0], email: v[1], location: v[2] || null, headline: v[3] || null, pitch: v[4] + (v[5] ? '\\n\\nPrevious work: ' + v[5] : '') }; }
        else if (page === 'newsletter') { table = 'subscribers'; row = { email: v[0], source: 'newsletter-page' }; }
        else { table = 'messages'; row = { name: v[0], email: v[1], subject: this.state.subject || 'General enquiry', message: v[2] }; }
        this.setState({ sending: true, formError: '' }); const ok = await npSend(table, row);
        this.setState(ok === true ? { done: true, sending: false } : { sending: false, formError: ok }); },`);
must("nlSubmit: (e) => { e.preventDefault(); this.setState({ nlDone: true }); },",
  `nlSubmit: async (e) => { e.preventDefault(); const f = e.currentTarget || e.target; const hp = f.querySelector('[name=website]'); const em = (f.querySelector('input[type=email]') || {}).value || '';
        if (hp && hp.value) { this.setState({ nlDone: true }); return; } const ok = await npSend('subscribers', { email: em.trim(), source: 'site' });
        if (ok === true) this.setState({ nlDone: true }); else window.alert(ok); },`);
must('pitchCount: (', "formError: this.state.formError || '', pitchCount: (");

// 1. Hash links -> real paths
t = t.replace(/(["'(])#\//g, '$1/');
if (/["'(]#\//.test(t)) throw new Error('hash links left');

must('<html>', '<html lang="en">');

// 2. Root-relative icon paths so nested pages resolve them
must('href="favicon.png"', 'href="/favicon.png"');
must('href="apple-touch-icon.png"', 'href="/apple-touch-icon.png"');
must('href="site.webmanifest"', 'href="/site.webmanifest"');

// 3. Self-hosted React (the runtime looks these up in window.__resources)
const resources = { 'https://unpkg.com/react@18.3.1/umd/react.production.min.js': '/assets/14efa5eb.js', 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': '/assets/209b6dd9.js' };
t = t.replace(/<head>/, '<head>\n<script>window.__resources = ' + JSON.stringify(resources) + ';</script>');

// 4. Page metadata, shared by the build and the browser
const META_FN = `
const NP_SB = { url: '${SB_URL}', key: '${SB_KEY}' };
const npSend = async (table, row) => {
  try {
    const r = await fetch(NP_SB.url + '/rest/v1/' + table, { method: 'POST', headers: { apikey: NP_SB.key, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (r.ok || (table === 'subscribers' && r.status === 409)) return true;
    const j = await r.json().catch(() => ({}));
    if (/Too many/.test(j.message || '')) return 'Too many messages from this address. Please try again later.';
    if (/email/.test(j.message || '')) return 'Please check your email address and try again.';
    return 'Sorry, that did not send. Please check your details and try again.';
  } catch (e) { return 'Network problem. Please try again in a moment.'; }
};
const SITE_URL = '${SITE}';
const DEFAULT_DESC = 'Independent voices on climate justice, South Sudan politics and human rights. For Africans, the diaspora and everyone paying attention.';
const PAGE_META = {
  live: ['Live updates', 'The latest short briefs from The Nile Pen on South Sudan, human rights, climate and the diaspora, updated as news breaks.'],
  about: ['About us', 'The Nile Pen is an independent publication covering South Sudan, human rights, water and land, climate justice and diaspora voices.'],
  team: ['Our team', 'Meet the editor and writers behind The Nile Pen.'],
  submit: ['Submit a story', 'Write for The Nile Pen. Send us a short pitch: what the story is, why it matters now and why you are the person to tell it.'],
  contact: ['Contact us', 'Get in touch with The Nile Pen for general enquiries, partnerships and corrections.'],
  advertise: ['Advertise', 'Advertise with The Nile Pen and reach readers across South Sudan, East Africa and the diaspora.'],
  newsletter: ['Newsletter', 'Get The Nile Pen weekly dispatch: the stories that matter on South Sudan, human rights and climate justice.'],
  privacy: ['Privacy policy', 'How The Nile Pen collects, uses and protects your information.'],
  terms: ['Terms of use', 'The terms for using The Nile Pen website.'],
};
const npMeta = (route) => {
  const [page = 'home', id] = route;
  const home = { title: 'The Nile Pen — Independent African Journalism', desc: DEFAULT_DESC, path: '/', type: 'website', image: SITE_URL + '/og-image.png' };
  if (page === 'home') return home;
  if (PAGE_META[page] && !id) return { ...home, title: PAGE_META[page][0] + ' — The Nile Pen', desc: PAGE_META[page][1], path: '/' + page };
  if (page === 'topic') { const tp = TOPICS.find(x => x.slug === id); if (tp) return { ...home, title: tp.name + ' — The Nile Pen', desc: tp.desc, path: '/topic/' + tp.slug }; }
  if (page === 'article') { const a = ALL.find(x => x.id === id); if (a) return { ...home, title: a.title + ' — The Nile Pen', desc: a.dek || DEFAULT_DESC, path: '/article/' + a.id, type: 'article', image: /^https:/.test(a.img || '') ? a.img : home.image }; }
  return { ...home, title: 'Page not found — The Nile Pen', path: null, missing: true };
};
const npApplyMeta = (route) => {
  const m = npMeta(route);
  document.title = m.title;
  const set = (sel, attr, val) => { const el = document.head.querySelector(sel); if (el && val != null) el.setAttribute(attr, val); };
  const url = m.path ? SITE_URL + m.path : SITE_URL + window.location.pathname;
  set('meta[name="description"]', 'content', m.desc);
  set('link[rel="canonical"]', 'href', url);
  set('meta[property="og:title"]', 'content', m.title);
  set('meta[property="og:description"]', 'content', m.desc);
  set('meta[property="og:url"]', 'content', url);
  set('meta[property="og:type"]', 'content', m.type);
  set('meta[property="og:image"]', 'content', m.image);
  set('meta[name="twitter:title"]', 'content', m.title);
  set('meta[name="twitter:description"]', 'content', m.desc);
  set('meta[name="twitter:image"]', 'content', m.image);
};
`;
must('\nconst STOP = ', '\n' + META_FN + 'const STOP = ');

// 5. Router: read the path, use history navigation, keep old #/ links working
must(
  "const route = (window.location.hash || '').replace(/^#\\/?/, '').split('/').filter(Boolean);",
  "const route = window.location.pathname.replace(/\\.html$/, '').split('/').filter(Boolean); if (route[0] === 'index') route.shift();\n    npApplyMeta(route);"
);
must(
  "    this.parse();\n    window.addEventListener('hashchange', this.parse);",
  `    if (/^#\\/./.test(window.location.hash)) history.replaceState(null, '', window.location.hash.slice(1));
    this.parse();
    window.addEventListener('popstate', this.parse);
    document.addEventListener('click', this.onLink);`
);
must(
  '  componentDidMount() {',
  `  onLink = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest ? e.target.closest('a') : null; if (!a) return;
    const h = a.getAttribute('href') || '';
    if (h[0] !== '/' || h[1] === '/' || (a.target && a.target !== '_self') || a.hasAttribute('download') || /\\.[a-z0-9]+$/i.test(h)) return;
    e.preventDefault();
    if (h !== window.location.pathname) history.pushState(null, '', h);
    this.parse();
  };
  componentDidMount() {`
);
must("window.removeEventListener('hashchange', this.parse);", "window.removeEventListener('popstate', this.parse); document.removeEventListener('click', this.onLink);");

must("this.setState({ route, done: false, subject });", "this.setState({ route, done: false, subject, menu: false });");

// 6. Share links on Live posts use the site origin, not the current page
must("const site = typeof location !== 'undefined' ? location.href.split('#')[0] : '';", "const site = typeof location !== 'undefined' ? location.origin : '';");

// 7. Pull the data out of the script to know every page
const L = t.split('\n');
const s = L.findIndex(l => l.startsWith('const IMG ')), e = L.findIndex(l => l.startsWith('const STOP '));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(L.slice(s, e).join('\n') + '\n;globalThis.__out = { ALL, TOPICS, npMeta };', ctx);
const { ALL, TOPICS, npMeta } = ctx.__out;

const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const headFor = (m, html) => {
  const url = m.path ? SITE + m.path : SITE + '/';
  const rep = (re, val) => { if (!re.test(html)) throw new Error('head tag missing ' + re); html = html.replace(re, val); };
  rep(/<title>[^<]*<\/title>/, '<title>' + esc(m.title) + '</title>');
  rep(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(m.desc) + '">');
  rep(/<link rel="canonical" href="[^"]*">/, m.missing ? '' : '<link rel="canonical" href="' + esc(url) + '">');
  rep(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="' + (m.missing ? 'noindex' : 'index, follow') + '">');
  rep(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="' + m.type + '">');
  rep(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(m.title) + '">');
  rep(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(m.desc) + '">');
  rep(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + esc(url) + '">');
  rep(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + esc(m.image) + '">');
  rep(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(m.title) + '">');
  rep(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(m.desc) + '">');
  rep(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + esc(m.image) + '">');
  if (m.image !== SITE + '/og-image.png') html = html.replace(/\s*<meta property="og:image:width"[^>]*>\s*<meta property="og:image:height"[^>]*>/, '');
  return html;
};

// 7b. SEO extras: structured data, crawlable fallback content, feed link
const ORG = { '@type': 'NewsMediaOrganization', '@id': SITE + '/#org', name: 'The Nile Pen', url: SITE + '/',
  logo: { '@type': 'ImageObject', url: SITE + '/icon-512.png', width: 512, height: 512 },
  founder: { '@type': 'Person', name: 'Dalia Mori Wanki' }, publishingPrinciples: SITE + '/about' };
const WEBSITE = { '@type': 'WebSite', '@id': SITE + '/#website', name: 'The Nile Pen', url: SITE + '/', inLanguage: 'en', publisher: { '@id': SITE + '/#org' } };
const crumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const ld = (graph) => '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') + '</script>';
const isoTime = (d) => d + 'T09:00:00+03:00';
const NAV = [['Home', '/'], ['Live', '/live']].concat(TOPICS.map(tp => [tp.name, '/topic/' + tp.slug]), [['About', '/about'], ['Our team', '/team'], ['Submit a story', '/submit'], ['Newsletter', '/newsletter'], ['Contact', '/contact'], ['Advertise', '/advertise'], ['Privacy', '/privacy'], ['Terms', '/terms']]);
const byDate = ALL.slice().sort((x, y) => y.d.localeCompare(x.d));
const li = (a) => `<li><a href="/article/${a.id}">${esc(a.title)}</a> <small>${esc(a.date)}</small></li>`;

const extras = (r, m) => {
  const [page, id] = r;
  const url = m.path ? SITE + m.path : SITE + '/';
  let head = `\n  <meta property="og:locale" content="en_US">\n  <link rel="alternate" type="application/rss+xml" title="The Nile Pen" href="${SITE}/feed.xml">\n  <link rel="preconnect" href="https://img.magnific.com">`;
  let graph = [ORG, WEBSITE];
  let body = '';
  if (m.missing) { head += ''; body = '<h1>Page not found</h1><p><a href="/">Go to the homepage</a></p>'; }
  else if (page === 'article') {
    const a = ALL.find(x => x.id === id);
    const tp = TOPICS.find(x => x.slug === a.topic) || TOPICS.find(x => a.topics.includes(x.slug));
    head += `\n  <meta property="article:published_time" content="${isoTime(a.d)}">\n  <meta property="article:section" content="${esc(a.topicName)}">\n  <meta name="author" content="${esc(a.author)}">`;
    graph.push({ '@type': 'NewsArticle', '@id': url + '#article', mainEntityOfPage: url, headline: a.title.slice(0, 110), description: a.dek, image: [m.image],
      datePublished: isoTime(a.d), dateModified: isoTime(a.d), articleSection: a.topicName, inLanguage: 'en',
      author: /desk/i.test(a.author) ? { '@id': SITE + '/#org' } : { '@type': 'Person', name: a.author },
      publisher: { '@id': SITE + '/#org' }, isBasedOn: a.url || undefined },
      crumbs([['Home', SITE + '/'], [tp.name, SITE + '/topic/' + tp.slug], [a.title, url]]));
    const related = byDate.filter(x => x.id !== a.id && x.topics.some(t => a.topics.includes(t))).slice(0, 8);
    body = `<article><p><a href="/topic/${tp.slug}">${esc(tp.name)}</a></p><h1>${esc(a.title)}</h1><p><strong>${esc(a.dek)}</strong></p><p>By ${esc(a.author)} · <time datetime="${a.d}">${esc(a.date)}</time> · ${esc(a.read || '')}</p>`
      + (a.body || []).map(p => `<p>${esc(p)}</p>`).join('')
      + (a.url ? `<p>This is a Nile Pen summary of reporting by <a href="${esc(a.url)}" rel="noopener">${esc(a.sourceLabel || a.source || 'the original source')}</a>.</p>` : '')
      + `</article><h2>Recommended for you</h2><ul>${related.map(li).join('')}</ul>`;
  } else if (page === 'topic') {
    const tp = TOPICS.find(x => x.slug === id);
    const list = byDate.filter(x => x.topics.includes(tp.slug));
    graph.push({ '@type': 'CollectionPage', '@id': url, url, name: tp.name, description: tp.desc, isPartOf: { '@id': SITE + '/#website' } }, crumbs([['Home', SITE + '/'], [tp.name, url]]));
    body = `<h1>${esc(tp.name)}</h1><p>${esc(tp.desc)}</p>` + (list.length ? `<ul>${list.map(li).join('')}</ul>` : '<p>No stories published in this section yet.</p>');
  } else if (page === 'live') {
    graph.push({ '@type': 'CollectionPage', '@id': url, url, name: 'Live updates', isPartOf: { '@id': SITE + '/#website' } }, crumbs([['Home', SITE + '/'], ['Live updates', url]]));
    body = `<h1>Live updates</h1><ul>${byDate.filter(x => x.isBrief).map(li).join('')}</ul>`;
  } else if (!page) {
    body = `<h1>The Nile Pen: independent African journalism</h1><p>${esc(m.desc)}</p><h2>Latest stories</h2><ul>${byDate.slice(0, 20).map(li).join('')}</ul>`;
  } else {
    graph.push({ '@type': page === 'about' ? 'AboutPage' : page === 'contact' ? 'ContactPage' : 'WebPage', '@id': url, url, name: m.title.replace(/ — The Nile Pen$/, ''), description: m.desc, isPartOf: { '@id': SITE + '/#website' } },
      crumbs([['Home', SITE + '/'], [m.title.replace(/ — The Nile Pen$/, ''), url]]));
    body = `<h1>${esc(m.title.replace(/ — The Nile Pen$/, ''))}</h1><p>${esc(m.desc)}</p>`;
  }
  const nav = `<nav aria-label="Site"><ul>${NAV.map(([n, h]) => `<li><a href="${h}">${esc(n)}</a></li>`).join('')}</ul></nav>`;
  return { head: head + '\n  ' + ld(graph), body: `<noscript><div style="max-width:760px;margin:0 auto;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#121417;background:#fff">${nav}<main>${body}</main></div></noscript>` };
};
const pageHtml = (r, m) => {
  let html = headFor(m, t);
  const x = extras(r, m);
  html = html.replace('</head>', x.head + '\n</head>').replace(/<body>/, '<body>\n' + x.body);
  return html;
};

// 8. Write one HTML file per page
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const pages = [[]].concat(['live', 'about', 'team', 'submit', 'contact', 'advertise', 'newsletter', 'privacy', 'terms'].map(p => [p]),
  TOPICS.map(tp => ['topic', tp.slug]), ALL.map(a => ['article', a.id]));
const urls = [];
for (const r of pages) {
  const m = npMeta(r);
  const file = r.length ? r.join('/') + '.html' : 'index.html';
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), pageHtml(r, m));
  const a = r[0] === 'article' ? ALL.find(x => x.id === r[1]) : null;
  urls.push({ loc: SITE + m.path, lastmod: a ? (a.updated && a.updated > a.d ? a.updated : a.d) : null, pri: !r.length ? '1.0' : a ? '0.8' : r[0] === 'topic' || r[0] === 'live' ? '0.9' : '0.5', freq: !r.length || r[0] === 'live' || r[0] === 'topic' ? 'daily' : a ? 'monthly' : 'yearly' });
}
fs.writeFileSync(path.join(OUT, '404.html'), pageHtml(['__missing__'], npMeta(['__missing__'])));

// 9. Sitemap, RSS, robots, Vercel config
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod || today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n') + '\n</urlset>\n');
const sorted = ALL.filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a.d || '')).sort((x, y) => y.d.localeCompare(x.d));
fs.writeFileSync(path.join(OUT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>The Nile Pen</title>
  <link>${SITE}/</link>
  <description>${esc(npMeta([]).desc)}</description>
  <language>en</language>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${sorted.map(a => `  <item><title>${esc(a.title)}</title><link>${SITE}/article/${a.id}</link><guid>${SITE}/article/${a.id}</guid><pubDate>${new Date(a.d + 'T09:00:00Z').toUTCString()}</pubDate><description>${esc(a.dek || '')}</description></item>`).join('\n')}
</channel>
</rss>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
// vercel.json is regenerated here so the security policy lives next to the build;
// the copy in site/ is the one Vercel reads, the copy in dist/ is for local testing.
const vercelJson = JSON.stringify({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null, installCommand: '', buildCommand: 'node build.mjs', outputDirectory: 'dist',
  cleanUrls: true, trailingSlash: false,
  headers: [
    { source: '/(.*)', headers: [
      { key: 'Content-Security-Policy', value: [
        "default-src 'self'",
        // the page runtime compiles its own inline script, so it needs inline + eval
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        `connect-src 'self' ${SB_URL}`,
        "frame-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
      ].join('; ') },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ] },
    { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/(sitemap.xml|feed.xml|robots.txt)', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
  ],
}, null, 2) + '\n';
fs.writeFileSync(path.join(HERE, 'vercel.json'), vercelJson);
fs.writeFileSync(path.join(OUT, 'vercel.json'), vercelJson);
fs.cpSync(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(PUBLIC, OUT, { recursive: true });
console.log('pages:', urls.length, '| articles:', ALL.length, '| feed items:', sorted.length);
