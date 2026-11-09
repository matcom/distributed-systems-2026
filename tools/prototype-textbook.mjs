#!/usr/bin/env node
// Design prototype: "interactive textbook" treatment for Chapter 1 (English).
// Run after tools/optimize-site.mjs:
//   node tools/prototype-textbook.mjs && node tools/optimize-site.mjs
// (the second command refreshes .release-files.json).
//
// This is a prototype of what the source templates should eventually emit;
// it is intentionally limited to one chapter.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = '/distributed-systems-2026/';
const DIR = 'generated/m01-distributed-systems';
const MARK = 'data-tb-proto';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);

const META = {
  '': ['Part I', 'Chapter 1', 'Overview'],
  lesson: ['Part I', 'Chapter 1', 'Lesson', '30–40 min read'],
  'guided-practice': ['Part I', 'Chapter 1', 'Guided practice', '35–50 min with the check'],
  'quick-check': ['Part I', 'Chapter 1', 'Knowledge check'],
  lab: ['Part I', 'Chapter 1', 'Laboratory', '1 h 15 min–1 h 45 min', '6 public tests'],
  'deep-dive': ['Part I', 'Chapter 1', 'Deep dive', 'optional'],
  connections: ['Part I', 'Chapter 1', 'Systems connections', 'optional'],
  references: ['Part I', 'Chapter 1', 'Further learning', 'optional'],
};

// ----------------------------------------------------------- diagrams -------
const crashFigure = (() => {
  const xs = [175, 255, 435, 525, 615];
  const state = ['unchanged', 'unchanged', 'unchanged', 'changed', 'changed'];
  const stages = [[210, 'receive'], [300, 'validate'], [390, 'apply in memory'], [480, 'write to disk'], [570, 'send reply']];
  const marker = (x, y, n) => `<g class="crash"><circle class="alert" cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 4}" text-anchor="middle">${n}</text></g>`;
  return `<figure class="tb-figure"><div class="tb-scroll">
<svg class="tb-svg" viewBox="0 0 760 300" role="img" aria-labelledby="tb-f1t tb-f1d"><title id="tb-f1t">Five crash points for PUT(x=7, r9)</title><desc id="tb-f1d">The client times out in all five cases, but the write survives a restart only when the crash happens after the write reached disk (cases 4 and 5).</desc>
<text class="ink lane" x="20" y="54">Client</text><text class="ink lane" x="20" y="154">Server</text>
<line class="rule" x1="100" y1="50" x2="740" y2="50"/><line class="rule" x1="100" y1="150" x2="740" y2="150"/>
<line class="line" x1="130" y1="50" x2="207" y2="146"/><polygon class="ink" points="210,150 199,143 206,138"/>
<text class="muted small" x="120" y="88" text-anchor="end">PUT(x=7, r9)</text>
${stages.map(([x, l]) => `<circle class="ink" cx="${x}" cy="150" r="4"/><text class="muted small" x="${x}" y="174" text-anchor="middle">${l}</text>`).join('')}
<line class="accent-line" x1="480" y1="128" x2="480" y2="160"/><text class="accent small strong" x="480" y="120" text-anchor="middle">durability point</text>
<line class="line dash" x1="570" y1="150" x2="657" y2="54"/><polygon class="ink" points="660,50 656,62 650,57"/>
<line class="line" x1="700" y1="40" x2="700" y2="60"/><text class="ink small strong" x="700" y="32" text-anchor="middle">timeout</text>
${marker(175, 150, 1)}${marker(255, 150, 2)}${marker(435, 150, 3)}${marker(525, 150, 4)}${marker(615, 100, 5)}
<line class="rule" x1="20" y1="218" x2="740" y2="218"/>
<text class="muted small" x="20" y="246">Client sees</text><text class="muted small" x="20" y="278">After restart</text>
${xs.map((x, i) => `<text class="ink" x="${x}" y="246" text-anchor="middle">timeout</text><text class="${state[i] === 'changed' ? 'accent strong' : 'muted'}" x="${x}" y="278" text-anchor="middle">${state[i]}</text>`).join('')}
</svg></div>
<figcaption><b>Figure 1.2</b>Five crash points, one observation. The client sees a timeout every time, yet the write survives only in cases 4 and 5 — after the durability point. A retry is safe only if the server can recognise <code>r9</code> as a request it has already applied.</figcaption>
</figure>`;
})();

const slowFigure = (() => {
  const panel = (L, title, crashed) => `
<text class="ink strong" x="${L}" y="24">${title}</text>
<text class="ink lane" x="${L}" y="64">Client</text><text class="ink lane" x="${L}" y="154">Server</text>
<line class="rule" x1="${L + 55}" y1="60" x2="${L + 345}" y2="60"/>
<rect class="band" x="${L + 70}" y="52" width="160" height="16" rx="3"/>
<text class="muted small" x="${L + 165}" y="88" text-anchor="middle">silence</text>
<line class="line" x1="${L + 70}" y1="60" x2="${L + 127}" y2="146"/><polygon class="ink" points="${L + 130},150 ${L + 119},144 ${L + 126},139"/>
<line class="line" x1="${L + 230}" y1="48" x2="${L + 230}" y2="72"/><text class="ink small strong" x="${L + 230}" y="42" text-anchor="middle">timeout</text>
${crashed
    ? `<line class="rule" x1="${L + 55}" y1="150" x2="${L + 170}" y2="150"/><line class="rule dash" x1="${L + 170}" y1="150" x2="${L + 345}" y2="150"/>
<g class="crash"><circle class="alert" cx="${L + 170}" cy="150" r="10"/><text x="${L + 170}" y="154" text-anchor="middle">✕</text></g>
<text class="muted small" x="${L + 190}" y="178">crashed, nothing will return</text>`
    : `<line class="rule" x1="${L + 55}" y1="150" x2="${L + 345}" y2="150"/>
<rect class="accent" x="${L + 130}" y="146" width="160" height="8" rx="2" opacity=".55"/>
<text class="muted small" x="${L + 210}" y="178" text-anchor="middle">still working (GC pause, queue, slow disk)</text>
<line class="line dash" x1="${L + 290}" y1="150" x2="${L + 327}" y2="64"/><polygon class="ink" points="${L + 329},60 ${L + 330},72 ${L + 323},69"/>
<text class="muted small" x="${L + 300}" y="100">late reply</text>`}`;
  return `<figure class="tb-figure"><div class="tb-scroll">
<svg class="tb-svg" viewBox="0 0 760 230" role="img" aria-labelledby="tb-f2t tb-f2d"><title id="tb-f2t">Slow server versus crashed server</title><desc id="tb-f2d">In both executions the client observes only silence until its timeout fires, so it cannot tell which one happened.</desc>
${panel(20, 'A · Slow server', false)}${panel(400, 'B · Crashed server', true)}
<line class="rule" x1="20" y1="200" x2="740" y2="200"/>
<text class="ink small" x="380" y="222" text-anchor="middle">Until the timeout fires, the client's view of A and B is identical.</text>
</svg></div>
<figcaption><b>Figure 1.3</b>Slowness and failure look the same from outside. A timeout turns waiting into a decision — a suspicion about the server, not a diagnosis.</figcaption>
</figure>`;
})();

// ------------------------------------------------------------ helpers -------
const H2 = '<div class="sl-heading-wrapper level-h2">';
function splitSections(content) {
  // -> [preamble, ...sections], each section starting with an h2 wrapper.
  const parts = content.split(H2);
  return [parts[0], ...parts.slice(1).map((p) => H2 + p)];
}
const sectionId = (s) => (s.match(/<h2 id="([^"]+)"/) || [])[1] || '';
const numbersFrom = (html, re) => {
  const m = html.match(re);
  return m ? new Set(m[1].match(/\d+/g).map(Number)) : new Set();
};

function withContent(html, fn) {
  const start = html.indexOf('<div class="sl-markdown-content">') + '<div class="sl-markdown-content">'.length;
  const end = html.indexOf('</div><footer', start);
  return html.slice(0, start) + fn(html.slice(start, end)) + html.slice(end);
}

function common(html, slug) {
  html = html.replace(/<html([^>]*?) class="([^"]*)">/, `<html$1 class="$2 tb" ${MARK}>`);
  html = html.replace(/(<link rel="stylesheet" href="[^"]*_astro\/index\.[^"]+\.css">)/, `$1<link rel="stylesheet" href="${BASE}assets/proto/textbook.css">`);
  html = html.replace('</body>', `<script type="module" src="${BASE}assets/proto/textbook.js"></script></body>`);
  // Title: chapter name only; the step goes into one quiet meta line.
  html = html.replace(/(<h1 id="_top"[^>]*>)Thinking in Distributed Systems(?: — [^<]*)?<\/h1>/,
    `$1Thinking in Distributed Systems</h1><p class="tb-meta tb-ui">${META[slug].map((m, i) => (i === 2 ? `<span><b>${m}</b></span>` : `<span>${m}</span>`)).join('')}</p>`);
  // Remove the stacked labels and the misleading percentage bar.
  html = html.replace(/<p class="ds-book-part">[^<]*<\/p>\n?/, '')
    .replace(/<p class="ds-module-kicker">[^<]*<\/p>\n?/, '')
    .replace(/<div class="ds-lesson-banner">[\s\S]*?<\/div>\n<\/div>\n?/, '')
    .replace(/<div class="ds-progress"[\s\S]*?<div class="ds-progress-track">[\s\S]*?<\/div>\n<\/div>\n?/, '')
    .replace(/<p class="ds-back-link">[\s\S]*?<\/p>\n?/, '');
  // Short sidebar names.
  html = html.replace(/>Chapter (\d+) · (?:[^<]*? — )?([^<]+)</g, '>$1 · $2<')
    .replace(/(<span class="large [^"]*">)Part ([IVX]+) — ([^<]+)</g, '$1$2 · $3<');
  return html;
}

// -------------------------------------------------------------- pages -------
const pages = {
  '': (c) => {
    c = c.replace(/<div class="ds-workload ds-workload-three"[\s\S]*?<\/div>\n<\/div>/, `<ol class="tb-path tb-ui">
<li><a href="./lesson/"><span class="n">1</span><strong>Read the lesson</strong><small>30–40 min</small></a></li>
<li><a href="./guided-practice/"><span class="n">2</span><strong>Guided practice</strong><small>core cases 1, 3, 4, 5, 8</small></a></li>
<li><a href="./quick-check/"><span class="n">3</span><strong>Knowledge check</strong><small>9 core questions · 35–50 min with practice</small></a></li>
<li><a href="./lab/"><span class="n">4</span><strong>Laboratory</strong><small>1 h 15 min–1 h 45 min · 6 public tests</small></a></li>
</ol>
<p><a class="tb-cta" href="./lesson/">Start the lesson →</a></p>`);
    return c;
  },

  lesson: (c) => {
    // Predict first: the "Before you read" prompt gets a private answer box…
    c = c.replace(/(<h2 id="before-you-read">[\s\S]*?<\/div>\n)<blockquote>\n<p>([\s\S]*?)<\/p>\n<\/blockquote>/,
      `$1<div class="tb-box"><span class="tb-kicker tb-ui">Predict first</span><p>$2</p><textarea data-tb-key="m01:prediction" aria-label="Your prediction" placeholder="Write your prediction here…"></textarea><span class="tb-hint">Saved only on this device. You will see it again at the end of the chapter.</span></div>`);
    // …which comes back at the end.
    c = c.replace('<div class="ds-next-action">', `<div class="tb-box"><span class="tb-kicker tb-ui">Revisit your prediction</span><p>At the start you predicted:</p><div class="tb-echo" data-tb-echo="m01:prediction" data-empty="(You did not write a prediction.)"></div><p>Which of those executions would you now describe differently? Name the durability point and the acknowledgement point in each.</p></div>\n<div class="ds-next-action">`);
    // Two new diagrams.
    c = c.replace(/(<h2 id="21-worked-example[\s\S]*?<\/ol>)/, `$1\n${crashFigure}`);
    c = c.replace(/(<h2 id="7-failure-and-slowness[\s\S]*?<\/div>\n<p>[\s\S]*?<\/p>)/, `$1\n${slowFigure}`);
    c = c.replace('<span>Figure</span>One timeout', '<span>Figure 1.1</span>One timeout');
    return c;
  },

  'quick-check': (c) => {
    const core = numbersFrom(c, /Answer questions ([\d, and]+)/);
    // The question list is the first <ol> after the intro note (the steps bar is also an <ol>).
    c = c.replace(/(?<=<\/blockquote>\n)<ol>([\s\S]*?)<\/ol>/, (all, items) => {
      let i = 0;
      const lis = items.replace(/<li>([\s\S]*?)<\/li>/g, (m, q) => {
        i++;
        const isCore = core.has(i);
        return `<li class="tb-q${isCore ? ' tb-core' : ''}">${q}${isCore ? '<span class="tb-badge">Core</span>' : ''}<details><summary>Write your answer</summary><textarea data-tb-key="m01:q${i}" aria-label="Answer to question ${i}"></textarea></details></li>`;
      });
      return `<div class="tb-quizwrap"><div class="tb-toolbar tb-ui"><label><input type="checkbox" id="tb-core-only"> Show core questions only</label><span class="tb-count" data-tb-count="li.tb-q.tb-core textarea">Core answered: <b>0/${core.size}</b></span></div><ol class="tb-quiz">${lis}</ol></div>`;
    });
    // Reasoning anchors stay hidden until the student asks for them.
    c = c.replace(/(<h2 id="check-your-reasoning">[\s\S]*?<\/div>\n)<blockquote>\n<p>([\s\S]*?)<\/p>\n<\/blockquote>\n(<ul>[\s\S]*?<\/ul>)/,
      '$1<details class="tb-reveal"><summary>Reveal the reasoning anchors (after answering)</summary><p>$2</p>$3</details>');
    return c;
  },

  'guided-practice': (c) => {
    const core = numbersFrom(c, /Complete cases ([\d, and]+)/);
    const [pre, ...secs] = splitSections(c);
    const out = secs.map((s) => {
      const n = Number((sectionId(s).match(/^(\d+)-/) || [])[1]);
      if (!n) return s;
      const isCore = core.has(n);
      const badge = isCore ? '<span class="tb-badge">Core</span>' : '<span class="tb-badge bank">Challenge bank</span>';
      const [body, tail = ''] = s.split('<div class="ds-next-action">');
      return `<section class="tb-card${isCore ? ' tb-core' : ''}">${body.replace('</h2>', `${badge}</h2>`)}</section>\n${tail ? '<div class="ds-next-action">' + tail : ''}`;
    });
    return `${pre}<div class="tb-practicewrap"><div class="tb-toolbar tb-ui"><label><input type="checkbox" id="tb-core-only"> Show core cases only</label></div>${out.join('')}</div>`;
  },

  lab: (c) => {
    const [pre, ...secs] = splitSections(c);
    const exps = [];
    const out = secs.map((s) => {
      const id = sectionId(s);
      if (!id.startsWith('experiment-')) return s;
      const title = s.match(/<h2 id="[^"]+">([^<]+)<\/h2>/)[1];
      const key = `m01:lab:${id}`;
      exps.push({ id, title, key });
      const [body, tail = ''] = s.split('<div class="ds-next-action">');
      return `<section class="tb-card">${body}<div class="tb-done-toggle tb-ui"><label><input type="checkbox" data-tb-key="${key}"> Evidence recorded</label></div></section>\n${tail ? '<div class="ds-next-action">' + tail : ''}`;
    });
    const list = `<div class="tb-box tb-ui"><span class="tb-kicker">Experiment checklist</span><span class="tb-count" data-tb-count=".tb-checklist input">Recorded: <b>0/${exps.length}</b></span><ol class="tb-checklist">${exps.map((e) => `<li><label><input type="checkbox" data-tb-key="${e.key}"><a href="#${e.id}">${e.title}</a></label></li>`).join('')}</ol></div>`;
    // Checklist goes right after the "Before you start" note.
    const preOut = pre.replace(/(<blockquote>\n<p><strong>Before you start:[\s\S]*?<\/blockquote>)/, `$1\n${list}`);
    return preOut + out.join('');
  },
};

let n = 0;
for (const slug of Object.keys(META)) {
  const file = `${DIR}/${slug ? slug + '/' : ''}index.html`;
  let html = read(file);
  if (html.includes(MARK)) continue;
  html = common(html, slug);
  if (pages[slug]) html = withContent(html, pages[slug]);
  write(file, html);
  n++;
}
console.log(`prototype applied to ${n} pages of ${DIR}`);
