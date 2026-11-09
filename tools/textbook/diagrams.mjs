// Inline SVG diagrams, keyed by "<module>:<lang>". Each entry names the lesson
// section (id prefix) it belongs to and where to place it inside the section:
// after: 'p' -> after the first paragraph; otherwise after the first list or code block.
// Colours come from CSS classes in textbook.css, so the diagrams follow the site theme.

const L = {
  en: {
    f1: { title: 'Five crash points for PUT(x=7, r9)', desc: 'The client times out in all five cases, but the write survives a restart only when the crash happens after the write reached disk (cases 4 and 5).',
      client: 'Client', server: 'Server', stages: ['receive', 'validate', 'apply in memory', 'write to disk', 'send reply'], durability: 'durability point', timeout: 'timeout',
      sees: 'Client sees', after: 'After restart', unchanged: 'unchanged', changed: 'changed',
      caption: '<b>Figure</b>Five crash points, one observation. The client sees a timeout every time, yet the write survives only in cases 4 and 5 — after the durability point. A retry is safe only if the server can recognise <code>r9</code> as a request it has already applied.' },
    f2: { title: 'Slow server versus crashed server', desc: 'In both executions the client observes only silence until its timeout fires, so it cannot tell which one happened.',
      a: 'A · Slow server', b: 'B · Crashed server', silence: 'silence', working: 'still working (GC pause, queue, slow disk)', late: 'late reply', dead: 'crashed, nothing will return',
      bottom: "Until the timeout fires, the client's view of A and B is identical.",
      caption: '<b>Figure</b>Slowness and failure look the same from outside. A timeout turns waiting into a decision — a suspicion about the server, not a diagnosis.' },
  },
  es: {
    f1: { title: 'Cinco puntos de caída para PUT(x=7, r9)', desc: 'El cliente recibe un timeout en los cinco casos, pero la escritura sobrevive a un reinicio solo si la caída ocurre después de llegar a disco (casos 4 y 5).',
      client: 'Cliente', server: 'Servidor', stages: ['recibe', 'valida', 'aplica (RAM)', 'a disco', 'responde'], durability: 'punto de durabilidad', timeout: 'timeout',
      sees: 'El cliente ve', after: 'Tras reiniciar', unchanged: 'sin cambios', changed: 'cambiado',
      caption: '<b>Figura</b>Cinco puntos de caída, una sola observación. El cliente ve un timeout en todos los casos, pero la escritura sobrevive solo en los casos 4 y 5, después del punto de durabilidad. Reintentar es seguro solo si el servidor reconoce <code>r9</code> como una solicitud ya aplicada.' },
    f2: { title: 'Servidor lento frente a servidor caído', desc: 'En ambas ejecuciones el cliente solo observa silencio hasta que vence su timeout, así que no puede saber cuál ocurrió.',
      a: 'A · Servidor lento', b: 'B · Servidor caído', silence: 'silencio', working: 'sigue trabajando (pausa de GC, cola, disco lento)', late: 'respuesta tardía', dead: 'caído; no llegará nada',
      bottom: 'Hasta que vence el timeout, la vista del cliente en A y B es idéntica.',
      caption: '<b>Figura</b>Lentitud y fallo se ven igual desde fuera. Un timeout convierte la espera en una decisión: una sospecha sobre el servidor, no un diagnóstico.' },
  },
};

function crashFigure(lang) {
  const t = L[lang].f1, id = `tb-f12-${lang}`;
  const xs = [175, 255, 435, 525, 615];
  const changed = [false, false, false, true, true];
  const stageX = [210, 300, 390, 480, 570];
  const marker = (x, y, n) => `<g class="crash"><circle class="alert" cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 4}" text-anchor="middle">${n}</text></g>`;
  return `<figure class="tb-figure"><div class="tb-scroll">
<svg class="tb-svg" viewBox="0 0 760 300" role="img" aria-labelledby="${id}t ${id}d"><title id="${id}t">${t.title}</title><desc id="${id}d">${t.desc}</desc>
<text class="ink lane" x="20" y="54">${t.client}</text><text class="ink lane" x="20" y="154">${t.server}</text>
<line class="rule" x1="100" y1="50" x2="740" y2="50"/><line class="rule" x1="100" y1="150" x2="740" y2="150"/>
<line class="line" x1="130" y1="50" x2="207" y2="146"/><polygon class="ink" points="210,150 199,143 206,138"/>
<text class="muted small" x="120" y="88" text-anchor="end">PUT(x=7, r9)</text>
${stageX.map((x, i) => `<circle class="ink" cx="${x}" cy="150" r="4"/><text class="muted small" x="${x}" y="174" text-anchor="middle">${t.stages[i]}</text>`).join('')}
<line class="accent-line" x1="480" y1="128" x2="480" y2="160"/><text class="accent small strong" x="480" y="120" text-anchor="middle">${t.durability}</text>
<line class="line dash" x1="570" y1="150" x2="657" y2="54"/><polygon class="ink" points="660,50 656,62 650,57"/>
<line class="line" x1="700" y1="40" x2="700" y2="60"/><text class="ink small strong" x="700" y="32" text-anchor="middle">${t.timeout}</text>
${marker(175, 150, 1)}${marker(255, 150, 2)}${marker(435, 150, 3)}${marker(525, 150, 4)}${marker(615, 100, 5)}
<line class="rule" x1="20" y1="218" x2="740" y2="218"/>
<text class="muted small" x="20" y="246">${t.sees}</text><text class="muted small" x="20" y="278">${t.after}</text>
${xs.map((x, i) => `<text class="ink" x="${x}" y="246" text-anchor="middle">${t.timeout}</text><text class="${changed[i] ? 'accent strong' : 'muted'}" x="${x}" y="278" text-anchor="middle">${changed[i] ? t.changed : t.unchanged}</text>`).join('')}
</svg></div>
<figcaption>${t.caption}</figcaption>
</figure>`;
}

function slowFigure(lang) {
  const t = L[lang].f2, id = `tb-f13-${lang}`;
  const panel = (L0, title, crashed) => `
<text class="ink strong" x="${L0}" y="24">${title}</text>
<text class="ink lane" x="${L0}" y="64">${L[lang].f1.client}</text><text class="ink lane" x="${L0}" y="154">${L[lang].f1.server}</text>
<line class="rule" x1="${L0 + 70}" y1="60" x2="${L0 + 345}" y2="60"/>
<rect class="band" x="${L0 + 80}" y="52" width="150" height="16" rx="3"/>
<text class="muted small" x="${L0 + 165}" y="88" text-anchor="middle">${t.silence}</text>
<line class="line" x1="${L0 + 80}" y1="60" x2="${L0 + 132}" y2="146"/><polygon class="ink" points="${L0 + 135},150 ${L0 + 124},144 ${L0 + 131},139"/>
<line class="line" x1="${L0 + 230}" y1="48" x2="${L0 + 230}" y2="72"/><text class="ink small strong" x="${L0 + 230}" y="42" text-anchor="middle">${L[lang].f1.timeout}</text>
${crashed
    ? `<line class="rule" x1="${L0 + 70}" y1="150" x2="${L0 + 170}" y2="150"/><line class="rule dash" x1="${L0 + 170}" y1="150" x2="${L0 + 345}" y2="150"/>
<g class="crash"><circle class="alert" cx="${L0 + 170}" cy="150" r="10"/><text x="${L0 + 170}" y="154" text-anchor="middle">✕</text></g>
<text class="muted small" x="${L0 + 190}" y="178">${t.dead}</text>`
    : `<line class="rule" x1="${L0 + 70}" y1="150" x2="${L0 + 345}" y2="150"/>
<rect class="accent" x="${L0 + 135}" y="146" width="155" height="8" rx="2" opacity=".55"/>
<text class="muted small" x="${L0 + 212}" y="178" text-anchor="middle">${t.working}</text>
<line class="line dash" x1="${L0 + 290}" y1="150" x2="${L0 + 327}" y2="64"/><polygon class="ink" points="${L0 + 329},60 ${L0 + 330},72 ${L0 + 323},69"/>
<text class="muted small" x="${L0 + 300}" y="100">${t.late}</text>`}`;
  return `<figure class="tb-figure"><div class="tb-scroll">
<svg class="tb-svg" viewBox="0 0 760 230" role="img" aria-labelledby="${id}t ${id}d"><title id="${id}t">${t.title}</title><desc id="${id}d">${t.desc}</desc>
${panel(20, t.a, false)}${panel(400, t.b, true)}
<line class="rule" x1="20" y1="200" x2="740" y2="200"/>
<text class="ink small" x="380" y="222" text-anchor="middle">${t.bottom}</text>
</svg></div>
<figcaption>${t.caption}</figcaption>
</figure>`;
}

import { seq } from './seq.mjs';
import { CHAPTER_DIAGRAMS } from './chapter-diagrams.mjs';

export const DIAGRAMS = Object.fromEntries(['en', 'es'].map((lang) => [
  `m01-distributed-systems:${lang}`,
  [
    { section: '7-', after: 'p', html: slowFigure(lang) },
    { section: '21-', after: 'block', html: crashFigure(lang) },
  ],
]));
for (const [mod, spec] of Object.entries(CHAPTER_DIAGRAMS)) {
  for (const lang of ['en', 'es']) {
    DIAGRAMS[`${mod}:${lang}`] = [{ section: spec.section[lang], after: spec.after || 'p', html: seq(spec, lang, `tb-${mod}-${lang}`) }];
  }
}
