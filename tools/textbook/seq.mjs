// Tiny generator for bilingual space-time (sequence) diagrams.
// Time runs left to right (t in 0..100), one horizontal lane per process.
// Every label is either a string or { en, es }.
//
// Items:
//   msg   { from, to, t1, t2, label?, dashed?, lost? (0..1), dx?, dy?, anchor? }
//   dot   { lane, t, label?, above?, accent? }
//   mark  { lane, t, text? ('✕' default), label?, above? }        alert-coloured marker
//   band  { lane, t1, t2, label?, below? }                       translucent span on a lane
//   bar   { lane, t1, t2, label? }                               "busy" bar on a lane
//   tick  { lane, t, label?, alert? }                            vertical tick (timeout, decision)
//   vline { t, label? }                                          dashed time separator (rounds)
//   text  { t, y ('bottom' | number), label, cls?, anchor? }

const W = 760, X0 = 125, X1 = 735;
const X = (t) => X0 + (t / 100) * (X1 - X0);
const tr = (v, lang) => (v == null ? '' : typeof v === 'string' ? v : v[lang]);
const escx = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function arrow(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 10, Wd = 4.5;
  const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
  const p = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  return `<polygon class="ink" points="${p(x2, y2)} ${p(bx + Wd * Math.sin(a), by - Wd * Math.cos(a))} ${p(bx - Wd * Math.sin(a), by + Wd * Math.cos(a))}"/>`;
}

export function seq(spec, lang, id) {
  const gap = spec.gap || 70, top = spec.top || 48;
  const Y = (i) => top + i * gap;
  const bottom = Y(spec.lanes.length - 1) + (spec.extra || 46);
  const out = [];
  spec.lanes.forEach((l, i) => {
    out.push(`<text class="ink lane" x="16" y="${Y(i) + 5}">${escx(tr(l, lang))}</text>`);
    out.push(`<line class="rule" x1="${X0 - 10}" y1="${Y(i)}" x2="${X1}" y2="${Y(i)}"/>`);
  });
  for (const it of spec.items) {
    const lab = escx(tr(it.label, lang));
    switch (it.kind) {
      case 'vline':
        out.push(`<line class="rule dash" x1="${X(it.t)}" y1="${top - 26}" x2="${X(it.t)}" y2="${bottom - 22}"/>`);
        if (lab) out.push(`<text class="muted small" x="${X(it.t)}" y="${top - 30}" text-anchor="middle">${lab}</text>`);
        break;
      case 'band': {
        const y = Y(it.lane);
        out.push(`<rect class="band" x="${X(it.t1)}" y="${y - 8}" width="${X(it.t2) - X(it.t1)}" height="16" rx="3"/>`);
        if (lab) out.push(`<text class="muted small" x="${(X(it.t1) + X(it.t2)) / 2}" y="${it.below ? y + 24 : y - 13}" text-anchor="middle">${lab}</text>`);
        break;
      }
      case 'bar': {
        const y = Y(it.lane);
        out.push(`<rect class="accent" x="${X(it.t1)}" y="${y - 4}" width="${X(it.t2) - X(it.t1)}" height="8" rx="2" opacity=".55"/>`);
        if (lab) out.push(`<text class="muted small" x="${(X(it.t1) + X(it.t2)) / 2}" y="${y + 22}" text-anchor="middle">${lab}</text>`);
        break;
      }
      case 'msg': {
        const x1 = X(it.t1), y1 = Y(it.from), x2f = X(it.t2), y2f = Y(it.to);
        const f = it.lost ?? 1, x2 = x1 + (x2f - x1) * f, y2 = y1 + (y2f - y1) * f;
        out.push(`<line class="line${it.dashed ? ' dash' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
        out.push(it.lost != null
          ? `<g class="crash"><circle class="alert" cx="${x2}" cy="${y2}" r="8"/><text x="${x2}" y="${y2 + 4}" text-anchor="middle">✕</text></g>`
          : arrow(x1, y1, x2, y2));
        if (lab) {
          const mx = x1 + (x2 - x1) * (it.at ?? 0.5), my = y1 + (y2 - y1) * (it.at ?? 0.5);
          out.push(`<text class="ink small" x="${mx + (it.dx ?? 7)}" y="${my + (it.dy ?? -5)}" text-anchor="${it.anchor || 'start'}">${lab}</text>`);
        }
        break;
      }
      case 'dot': {
        const x = X(it.t), y = Y(it.lane);
        out.push(`<circle class="${it.accent ? 'accent' : 'ink'}" cx="${x}" cy="${y}" r="${it.accent ? 5 : 4}"/>`);
        if (lab) out.push(`<text class="${it.accent ? 'accent strong' : 'muted'} small" x="${x + (it.dx || 0)}" y="${it.above ? y - 11 : y + 21}" text-anchor="${it.anchor || 'middle'}">${lab}</text>`);
        break;
      }
      case 'mark': {
        const x = X(it.t), y = Y(it.lane);
        out.push(`<g class="crash"><circle class="alert" cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 4}" text-anchor="middle">${escx(it.text || '✕')}</text></g>`);
        if (lab) out.push(`<text class="alert small strong" x="${x + (it.dx || 0)}" y="${it.above ? y - 16 : y + 26}" text-anchor="${it.anchor || 'middle'}">${lab}</text>`);
        break;
      }
      case 'tick': {
        const x = X(it.t), y = Y(it.lane);
        out.push(`<line class="${it.alert ? 'alert-line' : 'line'}" x1="${x}" y1="${y - 12}" x2="${x}" y2="${y + 12}"/>`);
        if (lab) out.push(`<text class="${it.alert ? 'alert' : 'ink'} small strong" x="${x + (it.dx || 0)}" y="${it.below ? y + 28 : y - 18}" text-anchor="${it.anchor || 'middle'}">${lab}</text>`);
        break;
      }
      case 'text': {
        const y = it.y === 'bottom' ? bottom - 6 : it.y;
        out.push(`<text class="${it.cls || 'muted small'}" x="${it.x ?? X(it.t)}" y="${y}" text-anchor="${it.anchor || 'middle'}">${lab}</text>`);
        break;
      }
    }
  }
  const title = escx(tr(spec.title, lang)), desc = escx(tr(spec.desc, lang));
  return `<figure class="tb-figure"><div class="tb-scroll">
<svg class="tb-svg" viewBox="0 0 ${W} ${bottom}" role="img" aria-labelledby="${id}t ${id}d"><title id="${id}t">${title}</title><desc id="${id}d">${desc}</desc>
${out.join('\n')}
</svg></div>
<figcaption><b>${lang === 'es' ? 'Figura' : 'Figure'}</b>${tr(spec.caption, lang)}</figcaption>
</figure>`;
}
