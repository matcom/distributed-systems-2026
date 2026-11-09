#!/usr/bin/env node
// "Interactive textbook" design for every chapter, in English and Spanish.
// Run after tools/optimize-site.mjs, then run the optimizer again so the
// release manifest is refreshed:
//   node tools/optimize-site.mjs && node tools/textbook-design.mjs && node tools/optimize-site.mjs
//
// Everything is derived from page structure (intro notes, section ids,
// workload blocks), not from English wording, so the same rules apply to both
// languages. The sources live in tools/textbook/ (CSS, JS, diagrams) and are
// published under content-hashed names in _astro/.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DIAGRAMS } from './textbook/diagrams.mjs';

const ROOT = process.cwd();
const BASE = '/distributed-systems-2026/';
const MARK = 'data-tb';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// Windows can briefly lock a file (indexer, antivirus, a local server): retry.
function write(p, s) {
  for (let i = 0; ; i++) {
    try { return fs.writeFileSync(path.join(ROOT, p), s); }
    catch (e) { if (i >= 5 || !['UNKNOWN', 'EBUSY', 'EPERM'].includes(e.code)) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200); }
  }
}
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const hash8 = (s) => createHash('sha256').update(s).digest('base64url').replace(/[-_]/g, 'x').slice(0, 8);
const txt = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const T = {
  en: {
    steps: { '': 'Overview', lesson: 'Lesson', 'guided-practice': 'Guided practice', 'quick-check': 'Knowledge check', lab: 'Laboratory', 'deep-dive': 'Deep dive', connections: 'Systems connections', references: 'Further learning' },
    read: 'read', optional: 'optional', tests: 'public tests',
    predict: 'Predict first', placeholder: 'Write your prediction here…', hint: 'Saved only on this device. You will see it again at the end of the chapter.',
    revisit: 'Revisit your prediction', predicted: 'At the start you predicted:', noPrediction: '(You did not write a prediction.)',
    revisitQ: 'What would you now explain differently, and which evidence from this chapter changed your mind?',
    write: 'Write your answer', answerTo: 'Answer to question', core: 'Core', bank: 'Challenge bank', extension: 'Extension',
    coreOnlyQ: 'Show core questions only', coreAnswered: 'Core answered:', coreOnlyC: 'Show core cases only',
    reveal: 'Reveal the reasoning anchors (after answering)',
    checklist: 'Lab checklist', recorded: 'Recorded:', evidence: 'Evidence recorded',
    pathLesson: 'Read the lesson', pathPractice: 'Guided practice', pathCheck: 'Knowledge check', pathLab: 'Laboratory',
    coreCases: (n) => `${n} core cases`, coreQuestions: (n) => `${n} core questions`, start: 'Start the lesson →', yourPrediction: 'Your prediction',
  },
  es: {
    steps: { '': 'Resumen', lesson: 'Lección', 'guided-practice': 'Práctica guiada', 'quick-check': 'Comprobación de conocimientos', lab: 'Laboratorio', 'deep-dive': 'Lectura profunda', connections: 'Conexiones con otros sistemas', references: 'Aprendizaje ampliado' },
    read: 'de lectura', optional: 'opcional', tests: 'pruebas públicas',
    predict: 'Predice primero', placeholder: 'Escribe aquí tu predicción…', hint: 'Se guarda solo en este dispositivo. La verás de nuevo al final del capítulo.',
    revisit: 'Revisa tu predicción', predicted: 'Al principio predijiste:', noPrediction: '(No escribiste ninguna predicción.)',
    revisitQ: '¿Qué explicarías ahora de otra manera y qué evidencia del capítulo te hizo cambiar de opinión?',
    write: 'Escribe tu respuesta', answerTo: 'Respuesta a la pregunta', core: 'Esencial', bank: 'Banco de retos', extension: 'Extensión',
    coreOnlyQ: 'Mostrar solo preguntas esenciales', coreAnswered: 'Esenciales respondidas:', coreOnlyC: 'Mostrar solo casos esenciales',
    reveal: 'Mostrar las anclas de razonamiento (después de responder)',
    checklist: 'Lista del laboratorio', recorded: 'Registradas:', evidence: 'Evidencia registrada',
    pathLesson: 'Leer la lección', pathPractice: 'Práctica guiada', pathCheck: 'Comprobación de conocimientos', pathLab: 'Laboratorio',
    coreCases: (n) => `${n} casos esenciales`, coreQuestions: (n) => `${n} preguntas esenciales`, start: 'Empezar la lección →', yourPrediction: 'Tu predicción',
  },
};
const SLUGS = ['', 'lesson', 'guided-practice', 'quick-check', 'lab', 'deep-dive', 'connections', 'references'];
const OPTIONAL = new Set(['deep-dive', 'connections', 'references']);

// ------------------------------------------------------------ helpers -------
const H2 = '<div class="sl-heading-wrapper level-h2">';
const splitSections = (c) => { const p = c.split(H2); return [p[0], ...p.slice(1).map((x) => H2 + x)]; };
const sectionId = (s) => (s.match(/<h2 id="([^"]+)"/) || [])[1] || '';
const sectionTitle = (s) => txt((s.match(/<h2 id="[^"]+">([\s\S]*?)<\/h2>/) || ['', ''])[1]);
const firstBlockquote = (c) => (c.match(/<blockquote>[\s\S]*?<\/blockquote>/) || [''])[0];

// Balanced scan for the element that starts at `start` (tag name `tag`).
function balanced(s, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(s))) { depth += m[1] ? -1 : 1; if (depth === 0) return re.lastIndex; }
  return -1;
}
function topLevelItems(olInner) {
  const items = []; let i = 0;
  while ((i = olInner.indexOf('<li', i)) !== -1) {
    const end = balanced(olInner, i, 'li');
    items.push(olInner.slice(olInner.indexOf('>', i) + 1, end - 5));
    i = end;
  }
  return items;
}

function withContent(html, fn) {
  const open = '<div class="sl-markdown-content">';
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf('</div><footer', start);
  return html.slice(0, start) + fn(html.slice(start, end)) + html.slice(end);
}

// Named cases are matched loosely: the Spanish notes sometimes keep the English
// term ("Safety versus liveness") while the heading is translated.
const norm = (s) => s.toLowerCase().replace(/\bseguridad\b/g, 'safety').replace(/\bvivacidad\b/g, 'liveness').replace(/\bfrente a\b/g, 'versus').replace(/\s+/g, ' ');

// Core tokens from the intro note: "Complete cases 0a, 1, 5, and the Safety versus liveness case."
function coreTokens(note) {
  const t = txt(note).replace(/^[^:]*:\s*/, '');
  const sentence = t.split(/\.\s/)[0];
  const ids = new Set((sentence.match(/\b\d+[a-z]?\b/g) || []));
  const named = [...sentence.matchAll(/\bthe ([^,.]+?) case\b|\bel caso ([^,.]+?)(?=[,.]|\s+Después|$)/g)].map((m) => (m[1] || m[2]).trim().toLowerCase());
  return { ids, named };
}

// Chapter facts, read once from the overview page.
function chapterFacts(dir, lang) {
  const o = read(`${dir}/index.html`);
  const part = (o.match(/<p class="ds-book-part">([^<]*)<\/p>/) || [])[1] || '';
  const kicker = (o.match(/<p class="ds-module-kicker">([^<]*)<\/p>/) || [])[1] || '';
  const title = txt((o.match(/<h1 id="_top"[^>]*>([\s\S]*?)<\/h1>/) || ['', ''])[1]);
  const wl = [...o.matchAll(/<div><span>[^<]*<\/span><strong>[^<]*<\/strong><small>([^<]*)<\/small><\/div>/g)].map((m) => m[1]);
  const gp = read(`${dir}/guided-practice/index.html`);
  const qc = read(`${dir}/quick-check/index.html`);
  const g = coreTokens(firstBlockquote(gp.slice(gp.indexOf('sl-markdown-content'))));
  const q = coreTokens(firstBlockquote(qc.slice(qc.indexOf('sl-markdown-content'))));
  const partShort = part.split(' — ')[0];
  return {
    lang, title, part: partShort, chapter: kicker && kicker !== partShort ? kicker : '',
    read: wl[0] || '', practice: wl[1] || '',
    lab: (wl[2] || '').replace(/ \+ (evidence|evidencia)$/, ''),
    coreCases: g.ids.size + g.named.length, coreQuestions: q.ids.size,
  };
}

// ------------------------------------------------------------- common -------
function common(html, slug, f, assets) {
  const t = T[f.lang];
  html = html.replace(/<html([^>]*?) class="([^"]*)">/, `<html$1 class="$2 tb" ${MARK}>`);
  html = html.replace(/(<link rel="stylesheet" href="[^"]*_astro\/index\.[^"]+\.css">)/, `$1<link rel="stylesheet" href="${assets.css}">`);
  html = html.replace('</body>', `<script type="module" src="${assets.js}"></script></body>`);
  const meta = [f.part, f.chapter, `<b>${t.steps[slug]}</b>`];
  if (slug === 'lesson' && f.read) meta.push(`${f.read} ${t.read}`);
  if (slug === 'lab' && f.lab) meta.push(f.lab);
  if (OPTIONAL.has(slug)) meta.push(t.optional);
  const metaHtml = `<p class="tb-meta tb-ui">${meta.filter(Boolean).map((m) => `<span>${m}</span>`).join('')}</p>`;
  html = html.replace(/(<h1 id="_top"[^>]*>)([\s\S]*?)<\/h1>/, (m, open) => `${open}${f.title}</h1>${metaHtml}`);
  return html.replace(/<p class="ds-book-part">[^<]*<\/p>\n?/, '')
    .replace(/<p class="ds-module-kicker">[^<]*<\/p>\n?/, '')
    .replace(/<div class="ds-lesson-banner">[\s\S]*?<\/div>\n<\/div>\n?/, '')
    .replace(/<div class="ds-progress"[\s\S]*?<div class="ds-progress-track">[\s\S]*?<\/div>\n<\/div>\n?/, '')
    .replace(/<p class="ds-back-link">[\s\S]*?<\/p>\n?/, '');
}

// Short sidebar names on every page of the site.
function shortSidebar(html) {
  const a = html.indexOf('<sl-sidebar-state-persist'), b = html.indexOf('</sl-sidebar-state-persist>');
  if (a < 0 || b < 0) return html;
  const side = html.slice(a, b)
    .replace(/>(?:Chapter|Capítulo) (\d+) · (?:[^<]*? — )?([^<]+)</g, '>$1 · $2<')
    .replace(/(<span class="large [^"]*">)(?:Part|Parte) ([IVX]+) — ([^<]+)</g, '$1$2 · $3<');
  return html.slice(0, a) + side + html.slice(b);
}

// -------------------------------------------------------------- pages -------
const pages = {
  ''(c, f, mod) {
    const t = T[f.lang];
    return c.replace(/<div class="ds-workload ds-workload-three"[\s\S]*?<\/div>\n<\/div>/, `<ol class="tb-path tb-ui">
<li><a href="./lesson/"><span class="n">1</span><strong>${t.pathLesson}</strong><small>${f.read}</small></a></li>
<li><a href="./guided-practice/"><span class="n">2</span><strong>${t.pathPractice}</strong><small>${t.coreCases(f.coreCases)} · ${f.practice}</small></a></li>
<li><a href="./quick-check/"><span class="n">3</span><strong>${t.pathCheck}</strong><small>${t.coreQuestions(f.coreQuestions)}</small></a></li>
<li><a href="./lab/"><span class="n">4</span><strong>${t.pathLab}</strong><small>${f.lab}</small></a></li>
</ol>
<p><a class="tb-cta" href="./lesson/">${t.start}</a></p>`);
  },

  lesson(c, f, mod) {
    const t = T[f.lang];
    const [pre, first, ...rest] = splitSections(c);
    let firstOut = first;
    if (first) {
      firstOut = first.replace(/<blockquote>\n<p>([\s\S]*?)<\/p>\n<\/blockquote>/, (m, prompt) =>
        `<div class="tb-box"><span class="tb-kicker tb-ui">${t.predict}</span><p>${prompt}</p><textarea data-tb-key="${mod}:prediction" aria-label="${t.yourPrediction}" placeholder="${t.placeholder}"></textarea><span class="tb-hint">${t.hint}</span></div>`);
    }
    c = [pre, firstOut, ...rest].join('');
    if (firstOut !== first) {
      c = c.replace('<div class="ds-next-action">', `<div class="tb-box"><span class="tb-kicker tb-ui">${t.revisit}</span><p>${t.predicted}</p><div class="tb-echo" data-tb-echo="${mod}:prediction" data-empty="${t.noPrediction}"></div><p>${t.revisitQ}</p></div>\n<div class="ds-next-action">`);
    }
    // Chapter diagrams: after the first paragraph of their section, or after its
    // first list/code block when `after: 'block'` (falling back to the paragraph).
    for (const d of DIAGRAMS[`${mod}:${f.lang}`] || []) {
      const secs = splitSections(c);
      const i = secs.findIndex((s) => sectionId(s).startsWith(d.section));
      if (i < 0) { console.warn(`diagram for ${mod}:${f.lang} not placed: no lesson section starting with "${d.section}"`); continue; }
      const s = secs[i];
      const find = (tags) => tags.map((a) => [a, s.indexOf(a)]).filter(([, at]) => at > 0).sort((x, y) => x[1] - y[1])[0];
      const [a, at] = (d.after === 'p' ? null : find(['</ol>', '</pre>'])) || find(['</p>']) || [];
      if (!a) continue;
      secs[i] = s.slice(0, at + a.length) + '\n' + d.html + s.slice(at + a.length);
      c = secs.join('');
    }
    // Number every figure in reading order: "Figure 6.1", "Figure 6.2"… (warm-up: "Figure 1"…).
    if (DIAGRAMS[`${mod}:${f.lang}`]) {
      const n = (f.chapter.match(/\d+/) || [''])[0];
      let k = 0;
      c = c.replace(/<figcaption>(<span>|<b>)(Figure|Figura)[^<]*(<\/span>|<\/b>)/g, (m, o, w, cl) => `<figcaption>${o}${w} ${n ? n + '.' : ''}${++k}${cl}`);
    }
    return c;
  },

  'quick-check'(c, f, mod) {
    const t = T[f.lang];
    const { ids } = coreTokens(firstBlockquote(c));
    const bq = c.indexOf('</blockquote>');
    const olStart = c.indexOf('<ol>', bq);
    if (bq < 0 || olStart < 0) return c;
    const olEnd = balanced(c, olStart, 'ol');
    const items = topLevelItems(c.slice(olStart + 4, olEnd - 5));
    let core = 0;
    const lis = items.map((q, k) => {
      const n = k + 1, isCore = ids.has(String(n));
      if (isCore) core++;
      return `<li value="${n}" class="tb-q${isCore ? ' tb-core' : ''}">${q}${isCore ? `<span class="tb-badge">${t.core}</span>` : ''}<details><summary>${t.write}</summary><textarea data-tb-key="${mod}:q${n}" aria-label="${t.answerTo} ${n}"></textarea></details></li>`;
    }).join('');
    const quiz = `<div class="tb-quizwrap"><div class="tb-toolbar tb-ui"><label><input type="checkbox" id="tb-core-only"> ${t.coreOnlyQ}</label><span class="tb-count" data-tb-count="li.tb-q.tb-core textarea">${t.coreAnswered} <b>0/${core}</b></span></div><ol class="tb-quiz">${lis}</ol></div>`;
    c = c.slice(0, olStart) + quiz + c.slice(olEnd);
    // Last section ("Check your reasoning"): hidden until asked for.
    const secs = splitSections(c);
    const i = secs.findIndex((s) => /^(check-your-reasoning|comprueba-tu-razonamiento)/.test(sectionId(s)));
    if (i > 0) {
      const s = secs[i];
      const headEnd = s.indexOf('</div>', s.indexOf('</h2>')) + 6;
      const [body, tail] = s.slice(headEnd).split('<div class="ds-next-action">');
      secs[i] = `${s.slice(0, headEnd)}\n<details class="tb-reveal"><summary>${t.reveal}</summary>${body}</details>\n${tail !== undefined ? '<div class="ds-next-action">' + tail : ''}`;
    }
    return secs.join('');
  },

  'guided-practice'(c, f, mod) {
    const t = T[f.lang];
    const { ids, named } = coreTokens(firstBlockquote(c));
    const [pre, ...secs] = splitSections(c);
    let cards = 0;
    const out = secs.map((s) => {
      const title = sectionTitle(s);
      const num = (title.match(/^(\d+[a-z]?)\./) || [])[1];
      if (!num) return s;
      cards++;
      const isCore = ids.has(num) || named.some((n) => norm(title).includes(norm(n)));
      const badge = isCore ? `<span class="tb-badge">${t.core}</span>` : `<span class="tb-badge bank">${t.bank}</span>`;
      const [body, tail] = s.split('<div class="ds-next-action">');
      return `<section class="tb-card${isCore ? ' tb-core' : ''}">${body.replace('</h2>', `${badge}</h2>`)}</section>\n${tail !== undefined ? '<div class="ds-next-action">' + tail : ''}`;
    });
    if (!cards) return c;
    return `${pre}<div class="tb-practicewrap"><div class="tb-toolbar tb-ui"><label><input type="checkbox" id="tb-core-only"> ${t.coreOnlyC}</label></div>${out.join('')}</div>`;
  },

  lab(c, f, mod) {
    const t = T[f.lang];
    const [pre, ...secs] = splitSections(c);
    const tasks = [];
    const out = secs.map((s) => {
      const id = sectionId(s), title = sectionTitle(s);
      if (!(/ — /.test(title) || /^[A-Z]\d+\.\s/.test(title)) || /^(finish|termina)/i.test(id)) return s;
      const ext = /^(Extension|Extensión)\b|optional|opcional/i.test(title);
      const key = `${mod}:lab:${id}`;
      tasks.push({ id, title, key, ext });
      const [body, tail] = s.split('<div class="ds-next-action">');
      const head = ext ? body.replace('</h2>', `<span class="tb-badge bank">${t.extension}</span></h2>`) : body;
      return `<section class="tb-card${ext ? '' : ' tb-core'}">${head}<div class="tb-done-toggle tb-ui"><label><input type="checkbox" data-tb-key="${key}"> ${t.evidence}</label></div></section>\n${tail !== undefined ? '<div class="ds-next-action">' + tail : ''}`;
    });
    if (!tasks.length) return c;
    let list = '';
    if (tasks.length > 1) {
      list = `<div class="tb-box tb-ui"><span class="tb-kicker">${t.checklist}</span><span class="tb-count" data-tb-count=".tb-checklist input">${t.recorded} <b>0/${tasks.length}</b></span><ol class="tb-checklist">${tasks.map((e) => `<li${e.ext ? ' class="ext"' : ''}><label><input type="checkbox" data-tb-key="${e.key}"><a href="#${e.id}">${e.title}</a></label></li>`).join('')}</ol></div>`;
    }
    // Checklist after the first note on the page (or at the top if there is none).
    const at = pre.indexOf('</blockquote>');
    const preOut = list ? (at >= 0 ? pre.slice(0, at + 13) + '\n' + list + pre.slice(at + 13) : pre + list) : pre;
    return preOut + out.join('');
  },
};

// -------------------------------------------------------------- main --------
const src = (p) => fs.readFileSync(path.join(ROOT, 'tools/textbook', p), 'utf8');
const css = src('textbook.css'), js = src('textbook.js');
const assets = { css: `${BASE}_astro/textbook.${hash8(css)}.css`, js: `${BASE}_astro/textbook.${hash8(js)}.js` };
for (const f of fs.readdirSync(path.join(ROOT, '_astro'))) {
  if (/^textbook\.\w+\.(css|js)$/.test(f) && ![assets.css, assets.js].includes(BASE + '_astro/' + f)) fs.unlinkSync(path.join(ROOT, '_astro', f));
}
write(assets.css.slice(BASE.length), css);
write(assets.js.slice(BASE.length), js);

function walk(dir = '', out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (!dir && ['.git', '.github', 'tools', 'pagefind', 'node_modules'].includes(e.name)) continue;
    if (e.isDirectory()) walk(rel, out); else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

let chapters = 0, pagesDone = 0, refreshed = 0;
const chapterDirs = [];
for (const lang of ['en', 'es']) {
  const root = lang === 'es' ? 'es/generated' : 'generated';
  for (const mod of fs.readdirSync(path.join(ROOT, root))) chapterDirs.push({ lang, mod, dir: `${root}/${mod}` });
}
const chapterFiles = new Set();
for (const { lang, mod, dir } of chapterDirs) {
  if (!exists(`${dir}/index.html`)) continue;
  const fresh = !read(`${dir}/index.html`).includes(MARK);
  const facts = fresh ? chapterFacts(dir, lang) : null;
  chapters++;
  // Build the whole chapter in memory first, then write it, so an interrupted
  // run never leaves a chapter half-processed.
  const outputs = [];
  for (const slug of SLUGS) {
    const file = `${dir}/${slug ? slug + '/' : ''}index.html`;
    if (!exists(file)) continue;
    chapterFiles.add(file);
    const html = read(file);
    if (html.includes(MARK)) continue;
    if (!facts) { console.warn(`skipped ${file}: its chapter overview was already processed; run on freshly published files`); continue; }
    let out = common(html, slug, facts, assets);
    if (pages[slug]) out = withContent(out, (c) => pages[slug](c, facts, mod));
    outputs.push([file, out]);
  }
  // Overview last: it is the marker that says the chapter is done.
  outputs.sort(([a], [b]) => (a === `${dir}/index.html`) - (b === `${dir}/index.html`));
  for (const [file, out] of outputs) { write(file, out); pagesDone++; }
}
// Home pages: "Continue: <chapter · step>" as the main action once a student has
// opened any chapter step on this device (stored by textbook.js).
const CONTINUE = { 'index.html': 'Continue: ', 'es/index.html': 'Continuar: ' };
const continueScript = (label) => `<script data-tb-continue>(()=>{try{const l=JSON.parse(localStorage.getItem('tb:last:'+document.documentElement.lang));const box=document.querySelector('.hero .actions'),p=box&&box.querySelector('.primary');if(!l||!p||!l.href.startsWith(${JSON.stringify(BASE)}))return;const a=p.cloneNode(true);a.href=l.href;a.firstChild.textContent=${JSON.stringify(label)}+l.title;p.classList.replace('primary','minimal');p.querySelector('svg')?.remove();box.prepend(a)}catch{}})()</script>`;

// Every page: short sidebar names; chapter pages: current asset names.
for (const file of walk()) {
  const src0 = read(file);
  let html = shortSidebar(src0);
  if (CONTINUE[file] && !html.includes('data-tb-continue')) html = html.replace('</body>', `${continueScript(CONTINUE[file])}</body>`);
  if (chapterFiles.has(file)) {
    html = html.replace(new RegExp(`${BASE}_astro/textbook\\.\\w+\\.css`), assets.css).replace(new RegExp(`${BASE}_astro/textbook\\.\\w+\\.js`), assets.js);
  }
  if (html !== src0) { write(file, html); refreshed++; }
}
console.log(`chapters: ${chapters}, newly designed pages: ${pagesDone}, files touched: ${refreshed}`);
console.log(`assets: ${assets.css}  ${assets.js}`);
