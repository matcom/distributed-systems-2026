#!/usr/bin/env node
// Post-build optimizer for the published static course.
//
// Run from the repository root after a fresh publication is copied in:
//   node tools/optimize-site.mjs
//
// It is idempotent: pages already processed are skipped, and the release
// manifest (.release-files.json) is regenerated so the deploy workflow's
// integrity check passes.
//
// What it does (all aimed at slow / metered connections):
//   * HTML: replaces ~70 repeated inline SVG icons per page with CSS-mask icons,
//     drops the duplicated mobile table of contents (cloned from the desktop one
//     at parse time), removes redundant inline styles, moves code-token colours
//     to classes (and adds a real light theme for code), adds a chapter step
//     strip, shows ZIP sizes, adds theme-color / manifest / og:image metadata.
//   * CSS: appends the overrides to the main stylesheet under a new content
//     hash so long-lived caches stay correct.
//   * Adds a service worker (cache-first for hashed assets, network-first with a
//     short timeout for pages, offline fallback, "save chapter for offline").

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = '/distributed-systems-2026/';
const SITE = 'https://matcom.github.io/distributed-systems-2026/';
const MARK = '<meta name="ds-optimized" content="1">';
const EXCLUDE_TOP = new Set(['.git', '.github', '.claude', 'tools', 'node_modules']);
const EXCLUDE_FILES = new Set(['.release-files.json', '.gitattributes']);

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const hash8 = (s) => createHash('sha256').update(s).digest('base64url').replace(/[-_]/g, 'x').slice(0, 8);

function walk(dir = '', out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (!dir && EXCLUDE_TOP.has(e.name)) continue;
    if (e.isDirectory()) walk(rel, out);
    else if (!EXCLUDE_FILES.has(rel)) out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------- icons -----
// Icons that repeat on every page become CSS masks: one copy in the cached
// stylesheet instead of one copy per occurrence in every HTML page.
const ICON_PATHS = {
  anchor:
    'm12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 1 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 0 0-1.42-1.42m8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 1 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 0 0 0 1.42 1 1 0 0 0 1.42 0l3.88-3.89a4.49 4.49 0 0 0 0-6.33M8.83 15.17a1 1 0 0 0 .71.29 1 1 0 0 0 .71-.29l4.92-4.92a1 1 0 1 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42',
  chev: 'm14.83 11.29-4.24-4.24a1 1 0 1 0-1.42 1.41L12.71 12l-3.54 3.54a1 1 0 0 0 0 1.41 1 1 0 0 0 .71.29 1 1 0 0 0 .71-.29l4.24-4.24a1.002 1.002 0 0 0 0-1.42Z',
};
const maskUrl = (d) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${d}'/></svg>`)}")`;

// GitHub-dark token colours (as emitted by Shiki) -> class, with GitHub-light
// equivalents for the light theme.
const TOKENS = [
  ['E1E4E8', '24292E'],
  ['79B8FF', '005CC5'],
  ['F97583', 'D73A49'],
  ['9ECBFF', '032F62'],
  ['B392F0', '6F42C1'],
  ['85E89D', '22863A'],
  ['FFAB70', 'E36209'],
  ['6A737D', '6A737D'],
  ['DBEDFF', '032F62'],
  ['FDAEB7', 'B31D28'],
];

// ------------------------------------------------------- chapter steps ------
const STEPS = [
  ['', { en: 'Overview', es: 'Resumen' }, 'core'],
  ['lesson', { en: 'Lesson', es: 'Lección' }, 'core'],
  ['guided-practice', { en: 'Practice', es: 'Práctica' }, 'core'],
  ['quick-check', { en: 'Check', es: 'Comprobación' }, 'core'],
  ['lab', { en: 'Lab', es: 'Laboratorio' }, 'core'],
  ['deep-dive', { en: 'Deep dive', es: 'Lectura profunda' }, 'extra'],
  ['connections', { en: 'Connections', es: 'Conexiones' }, 'extra'],
  ['references', { en: 'Further learning', es: 'Ampliación' }, 'extra'],
];
const UI = {
  en: { steps: 'Chapter steps', save: 'Save offline', saveTitle: 'Save every step of this chapter on this device to read it without a connection', optional: 'Optional' },
  es: { steps: 'Pasos del capítulo', save: 'Guardar sin conexión', saveTitle: 'Guarda todos los pasos de este capítulo en este dispositivo para leerlos sin conexión', optional: 'Opcional' },
};

function stepStrip(rel, lang) {
  // rel like "generated/m01-x/lesson/index.html" or "es/generated/m01-x/index.html"
  const m = rel.match(/^(?:es\/)?generated\/([^/]+)\/(?:([^/]+)\/)?index\.html$/);
  if (!m) return '';
  const [, , current = ''] = m;
  const depth = current ? '../' : './';
  const items = STEPS.filter(([slug]) => exists(path.posix.join(path.posix.dirname(rel), current ? '..' : '.', slug, 'index.html')))
    .map(([slug, label, kind], i, arr) => {
      const href = slug ? `${depth}${slug}/` : depth;
      const sep = kind === 'extra' && arr[i - 1]?.[2] === 'core' ? `<li class="ds-steps-sep" aria-hidden="true">${UI[lang].optional}</li>` : '';
      const cur = slug === current ? ' aria-current="page"' : '';
      return `${sep}<li><a href="${href}"${cur}>${label[lang]}</a></li>`;
    })
    .join('');
  return `<nav class="ds-steps" aria-label="${UI[lang].steps}" data-pagefind-ignore><ol>${items}</ol><button type="button" class="ds-save" hidden title="${UI[lang].saveTitle}" data-label="${UI[lang].save}">${UI[lang].save}</button></nav>`;
}

// ------------------------------------------------------------ pages ---------
function optimizeHtml(rel, html, ctx) {
  if (html.includes(MARK)) {
    // Already processed: only refresh references to regenerated assets.
    const out = html.replace(new RegExp(`${BASE}_astro/ds\\.\\w+\\.js`, 'g'), ctx.jsHref).replaceAll(ctx.oldCss, ctx.newCss);
    return out === html ? null : out;
  }
  const lang = /<html[^>]*lang="es/.test(html) ? 'es' : 'en';

  // 1. Repeated inline icons -> CSS masks.
  html = html.replace(/<span aria-hidden="true" class="sl-anchor-icon"><svg[\s\S]*?<\/svg><\/span>/g,
    '<span aria-hidden="true" class="sl-anchor-icon ds-ico ds-i-anchor"></span>');
  html = html.replace(/<svg aria-hidden="true" class="caret ([^"]*?)astro-hkc32dio" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="([^"]*)"><path d="([^"]*)"\/><\/svg>/g,
    (all, cls, style, d) => (d === ICON_PATHS.chev ? `<span aria-hidden="true" class="caret ${cls}ds-ico ds-i-chev" style="${style}"></span>` : all));

  // 2. Duplicate mobile TOC: keep an empty placeholder, clone the desktop list
  //    synchronously right after it is parsed (before Starlight's deferred
  //    module scripts upgrade the custom elements).
  const mobile = html.match(/(<mobile-starlight-toc[\s\S]*?<div class="dropdown[^"]*">)(<ul class="([^"]*)"[\s\S]*?<\/ul>)(<\/div><\/details><\/nav><\/mobile-starlight-toc>)/);
  if (mobile && html.includes('</starlight-toc>')) {
    html = html.replace(mobile[0], `${mobile[1]}<ul class="${mobile[3]}" data-ds-toc></ul>${mobile[4]}`);
    html = html.replace('</starlight-toc>',
      '</starlight-toc><script>(()=>{const d=document.querySelector("starlight-toc ul"),m=document.querySelector("ul[data-ds-toc]");if(d&&m){const c=d.cloneNode(!0);c.className=m.className;m.replaceWith(c)}})()</script>');
  }

  // 3. `--depth` is only read on TOC links; drop it from <li>/<span>/<ul>.
  html = html.replace(/<(li|span|ul)([^>]*?) style="--depth: \d+;"/g, '<$1$2');

  // 4. Code blocks: shared class instead of per-block inline colours.
  html = html.replace(/<pre class="astro-code github-dark" style="background-color:#24292e;color:#e1e4e8; overflow-x: auto;"/g,
    '<pre class="astro-code github-dark"');
  for (const [i, [dark]] of TOKENS.entries()) {
    html = html.replace(new RegExp(`<span style="color:#${dark}">`, 'gi'), `<span class="t${i}">`);
  }

  // 5. Smaller logo.
  html = html.replaceAll(`${BASE}assets/uh-logo.jpg`, `${BASE}assets/uh-logo.webp`);
  html = html.replace(/(src="[^"]*?)assets\/uh-logo\.jpg"/g, '$1assets/uh-logo.webp"');

  // 6. Show download sizes.
  html = html.replace(/<a href="([^"]+\.zip)" download>([^<]*)<\/a>/g, (all, href, text) => {
    const file = path.posix.normalize(path.posix.join(path.posix.dirname(rel), href));
    if (!exists(file)) return all;
    const kb = Math.max(1, Math.round(fs.statSync(path.join(ROOT, file)).size / 1024));
    return `<a href="${href}" download>${text.replace(/\(\.zip\)/, `(.zip · ${kb} KB)`)}</a>`;
  });

  // 7. Chapter step strip at the top of every chapter page.
  const strip = stepStrip(rel, lang);
  if (strip) html = html.replace('<div class="sl-markdown-content">', `<div class="sl-markdown-content">${strip}`);

  // 8. Head metadata + stylesheet rename + shared script.
  html = html.replaceAll(ctx.oldCss, ctx.newCss);
  html = html.replace('<meta name="twitter:card" content="summary_large_image"/>', '<meta name="twitter:card" content="summary"/>');
  const head = [
    MARK,
    '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0d151b" media="(prefers-color-scheme: dark)">',
    `<link rel="manifest" href="${BASE}manifest.webmanifest">`,
    html.includes('og:image') ? '' : `<meta property="og:image" content="${SITE}assets/og-card.png">`,
  ].join('');
  html = html.replace(/(<meta name="viewport"[^>]*>)/, `$1${head}`);
  html = html.replace('</body>', `<script type="module" src="${ctx.jsHref}"></script></body>`);
  return html;
}

// ------------------------------------------------------------- CSS ----------
function extraCss() {
  const tokenCss = TOKENS.map(([dark, light], i) => `.astro-code .t${i}{color:#${dark}}html[data-theme=light] .astro-code .t${i}{color:#${light}}`).join('');
  return `/*ds-opt*/
.ds-ico{display:inline-block;width:1em;height:1em;font-size:var(--sl-icon-size,1em);flex-shrink:0;background-color:currentColor;-webkit-mask:var(--ds-m) center/contain no-repeat;mask:var(--ds-m) center/contain no-repeat}
.ds-i-anchor{--ds-m:${maskUrl(ICON_PATHS.anchor)}}
.ds-i-chev{--ds-m:${maskUrl(ICON_PATHS.chev)}}
.sl-markdown-content .sl-anchor-icon.ds-ico{width:var(--sl-anchor-icon-size);height:var(--sl-anchor-icon-size);font-size:inherit;vertical-align:top;transform:translateY(calc((var(--sl-line-height-headings) * 1em - var(--sl-anchor-icon-size)) / 2))}
.astro-code{background-color:#24292e;color:#e1e4e8;overflow-x:auto}
html[data-theme=light] .astro-code{background-color:#f6f8fa;color:#24292e;border:1px solid var(--ds-rule)}
${tokenCss}
header.header{background:#fff}
html[data-theme=dark] header.header{background:#0d151b}
:root{--ds-muted:#56666f}
html[data-theme=dark]{--ds-muted:#a6b7c0}
.ds-book-part,.ds-progress-meta,.ds-lesson-banner span,.ds-workload span,.ds-next-action span,.ds-book-note-label,.ds-learning-grid b,.ds-part-card span,.ds-section-heading small,.ds-offline-link span,.ds-practice-label,.ds-optional-label,.ds-explore-card span,.ds-book-figure figcaption span{font-size:.75rem}
.ds-learning-grid p,.ds-part-card p,.ds-workload-note,.ds-course-topic small,.ds-workload small{font-size:.875rem}
.uh-brand-context{font-size:.7rem!important}
.sidebar-content .group-label .large{font-size:.95rem;line-height:1.3}
.sidebar-content summary{padding-block:.25em}
@media (width>=72rem){:root{--sl-sidebar-width:17rem}}
.ds-steps{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .6rem;margin:0 0 1.1rem;padding:.5rem 0;border-bottom:1px solid var(--ds-rule);font-size:.8rem}
.ds-steps ol{display:flex;flex-wrap:wrap;gap:.25rem;margin:0;padding:0;list-style:none}
.ds-steps li{margin:0;flex-shrink:0}
.ds-steps a{display:block;padding:.15rem .5rem;border:1px solid var(--ds-rule);border-radius:999px;color:var(--ds-text);text-decoration:none;white-space:nowrap}
.ds-steps a:hover{border-color:var(--ds-blue);color:var(--ds-blue)}
.ds-steps a[aria-current=page]{background:var(--ds-navy);border-color:var(--ds-navy);color:#fff;font-weight:700}
html[data-theme=dark] .ds-steps a[aria-current=page]{color:#0d151b}
.ds-steps .ds-steps-sep{align-self:center;white-space:nowrap;padding:0 .2rem 0 .4rem;color:var(--ds-muted);font-family:var(--sl-font-mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
.ds-save{margin-inline-start:auto;padding:.25rem .6rem;border:1px solid var(--ds-blue);border-radius:.3rem;background:none;color:var(--ds-blue);font:inherit;font-weight:700;cursor:pointer}
.ds-save[disabled]{opacity:.7;cursor:default}
@media (width<=50rem){
.ds-steps{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:calc(-1 * var(--sl-content-pad-x,1rem));padding-inline:var(--sl-content-pad-x,1rem)}
.ds-steps ol{flex-wrap:nowrap}
.ds-save{white-space:nowrap}
h1#_top{font-size:1.75rem;line-height:1.15}
.ds-lesson-banner{display:grid;grid-template-columns:auto 1fr;gap:.35rem 1.25rem;padding:.5rem 0;margin-bottom:.6rem}
.ds-lesson-banner div{min-width:0}
.ds-lesson-banner div:nth-child(3){display:none}
.ds-progress{margin:.4rem 0 .9rem}
.ds-progress-meta span+span{display:none}
.ds-book-part{margin-bottom:.3rem!important}
.ds-guiding-question{font-size:1.1rem;margin:1rem 0}
}
`;
}

// ----------------------------------------------------- service worker -------
function serviceWorker(version, precache) {
  return `// Generated by tools/optimize-site.mjs
const VERSION = ${JSON.stringify(version)};
const BASE = ${JSON.stringify(BASE)};
const STATIC = 'ds-static-v1';   // content-hashed files: never change
const PAGES = 'ds-pages-v1';     // HTML and other unhashed files
const SHELL = 'ds-shell-' + VERSION;
const PRECACHE = ${JSON.stringify(precache)};
const MAX_PAGES = 200, MAX_STATIC = 120, NAV_TIMEOUT = 3500;

const isHashed = (p) => p.startsWith(BASE + '_astro/') || /\\.pf_(index|fragment|filter|meta)$/.test(p) || /uh-logo\\.webp$/.test(p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ds-shell-') && k !== SHELL) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

async function trim(name, max) {
  const c = await caches.open(name), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { const c = await caches.open(STATIC); await c.put(req, res.clone()); trim(STATIC, MAX_STATIC); }
  return res;
}

async function networkFirst(e) {
  const req = e.request;
  const cache = await caches.open(PAGES);
  const network = (async () => {
    const res = (await e.preloadResponse) || (await fetch(req));
    if (res.ok) { await cache.put(req, res.clone()); trim(PAGES, MAX_PAGES); }
    return res;
  })();
  const cached = await caches.match(req, { ignoreSearch: true });
  if (!cached) {
    try { return await network; }
    catch { return (await caches.match(BASE + 'offline.html')) || Response.error(); }
  }
  // Slow link: fall back to the saved copy instead of waiting.
  const timeout = new Promise((r) => setTimeout(() => r(cached), NAV_TIMEOUT));
  e.waitUntil(network.catch(() => {}));
  return Promise.race([network.catch(() => cached), timeout]);
}

async function staleWhileRevalidate(e) {
  const req = e.request;
  const cache = await caches.open(PAGES);
  const cached = await cache.match(req);
  const update = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (cached) { e.waitUntil(update.catch(() => {})); return cached; }
  return update;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.endsWith('.zip') || url.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate') return e.respondWith(networkFirst(e));
  if (isHashed(url.pathname)) return e.respondWith(cacheFirst(req));
  e.respondWith(staleWhileRevalidate(e));
});
`;
}

function siteJs() {
  return `// Generated by tools/optimize-site.mjs
const BASE = ${JSON.stringify(BASE)};
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register(BASE + 'sw.js').catch(() => {}));
}
// "Save chapter offline": put every step of this chapter (and its figures) in
// the page cache so it can be read later without a connection.
const btn = document.querySelector('.ds-save');
if (btn && 'caches' in self && 'serviceWorker' in navigator) {
  const urls = [...document.querySelectorAll('.ds-steps a')].map((a) => a.href);
  const done = () => { btn.textContent = '\\u2713 ' + btn.dataset.label; btn.disabled = true; };
  // Only offer it once a service worker is active to serve the saved copies.
  navigator.serviceWorker.ready.then(() => { btn.hidden = false; });
  caches.open('ds-pages-v1').then(async (c) => {
    const hits = await Promise.all(urls.map((u) => c.match(u)));
    if (hits.every(Boolean)) done();
  });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const label = btn.textContent;
    try {
      const c = await caches.open('ds-pages-v1');
      const assets = new Set();
      let n = 0;
      for (const u of urls) {
        btn.textContent = label + ' (' + (++n) + '/' + urls.length + ')';
        const res = await fetch(u);
        if (!res.ok) throw new Error(u);
        const html = await res.clone().text();
        await c.put(u, res);
        for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) assets.add(new URL(m[1], u).href);
      }
      for (const a of assets) { const r = await fetch(a); if (r.ok) await c.put(a, r); }
      done();
    } catch { btn.textContent = label; btn.disabled = false; }
  });
}
`;
}

function offlineHtml(cssHref) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline | Distributed Systems 2026</title><link rel="stylesheet" href="${cssHref}"><style>body{max-width:40rem;margin:0 auto;padding:2.5rem 1rem;font-family:var(--sl-font);line-height:1.6}h1{color:var(--ds-navy);font-size:1.6rem}li{margin:.3rem 0}a{color:var(--ds-blue)}</style></head>
<body><h1>You are offline · Sin conexión</h1>
<p>This page has not been saved on this device yet. These pages are available offline:<br><span lang="es">Esta página aún no se ha guardado en este dispositivo. Estas páginas están disponibles sin conexión:</span></p>
<ul id="saved"><li>…</li></ul>
<script>caches.open('ds-pages-v1').then(c=>c.keys()).then(ks=>{const ul=document.getElementById('saved');const pages=ks.map(r=>new URL(r.url)).filter(u=>u.pathname.endsWith('/'));ul.innerHTML='';for(const u of pages.sort((a,b)=>a.pathname.localeCompare(b.pathname))){const li=document.createElement('li'),a=document.createElement('a');a.href=u.pathname;a.textContent=decodeURIComponent(u.pathname.replace(${JSON.stringify(BASE)},'/'));li.append(a);ul.append(li)}if(!pages.length)ul.innerHTML='<li>—</li>'}).catch(()=>{})</script>
</body></html>
`;
}

// -------------------------------------------------------------- main --------
const files = walk();
const htmlFiles = files.filter((f) => f.endsWith('.html') && !f.startsWith('pagefind/') && f !== 'offline.html');

// Stylesheet: find the one the pages reference now.
const sample = read('index.html');
const cssRef = sample.match(new RegExp(`${BASE}_astro/index\\.[\\w-]+\\.css`))[0];
const oldCssFile = cssRef.slice(BASE.length);
const css = read(oldCssFile).split('\n/*ds-opt*/')[0] + '\n' + extraCss();
const newCssFile = `_astro/index.${hash8(css)}.css`;
if (newCssFile !== oldCssFile) {
  write(newCssFile, css);
  fs.unlinkSync(path.join(ROOT, oldCssFile));
}
const newCss = BASE + newCssFile;

const js = siteJs();
const jsFile = `_astro/ds.${hash8(js)}.js`;
for (const f of files) if (/^_astro\/ds\.[\w]+\.js$/.test(f) && f !== jsFile) fs.unlinkSync(path.join(ROOT, f));
write(jsFile, js);

const ctx = { oldCss: cssRef, newCss, jsHref: BASE + jsFile };
let changed = 0, before = 0, after = 0;
for (const f of htmlFiles) {
  const src = read(f);
  const out = optimizeHtml(f, src, ctx);
  if (out === null) continue;
  before += src.length; after += out.length; changed++;
  write(f, out);
}

write('offline.html', offlineHtml(newCss));
write('manifest.webmanifest', JSON.stringify({
  name: 'Distributed Systems 2026 · MatCom',
  short_name: 'Distributed Systems',
  start_url: BASE,
  scope: BASE,
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#102a3a',
  icons: [{ src: BASE + 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
}, null, 2) + '\n');

const pageJs = walk('_astro').filter((f) => /\/page\.[\w-]+\.js$/.test(f)).map((f) => BASE + f);
const precache = [BASE + 'offline.html', newCss, BASE + jsFile, BASE + 'assets/uh-logo.webp', BASE + 'favicon.svg', ...pageJs];
const version = hash8(JSON.stringify(precache));
write('sw.js', serviceWorker(version, precache));

// Release manifest: every published file with its sha256.
const manifestPath = '.release-files.json';
const manifest = JSON.parse(read(manifestPath));
const published = walk();
manifest.files = Object.fromEntries(published.sort().map((f) => [f, createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex')]));
write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`pages optimized: ${changed}/${htmlFiles.length}`);
if (changed) console.log(`html bytes: ${before} -> ${after} (${(100 - (after / before) * 100).toFixed(1)}% smaller)`);
console.log(`stylesheet: ${oldCssFile} -> ${newCssFile}`);
console.log(`release manifest: ${Object.keys(manifest.files).length} files`);
