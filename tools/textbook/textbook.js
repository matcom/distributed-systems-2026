// Textbook prototype: everything is stored only on this device (localStorage).
const store = {
  get(k) { try { return localStorage.getItem('tb:' + k); } catch { return null; } },
  set(k, v) { try { v === '' || v == null ? localStorage.removeItem('tb:' + k) : localStorage.setItem('tb:' + k, v); } catch {} },
};

// Free-text answers and predictions.
for (const ta of document.querySelectorAll('textarea[data-tb-key]')) {
  const key = ta.dataset.tbKey;
  ta.value = store.get(key) || '';
  let t;
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { store.set(key, ta.value.trim() ? ta.value : ''); refresh(); }, 250); });
}

// Checkboxes (lab experiments).
for (const cb of document.querySelectorAll('input[type=checkbox][data-tb-key]')) {
  const key = cb.dataset.tbKey;
  cb.checked = store.get(key) === '1';
  cb.addEventListener('change', () => {
    store.set(key, cb.checked ? '1' : '');
    for (const twin of document.querySelectorAll(`input[data-tb-key="${key}"]`)) twin.checked = cb.checked;
    refresh();
  });
}

// Core-only filter remembers its state.
const coreOnly = document.getElementById('tb-core-only');
if (coreOnly) {
  coreOnly.checked = store.get('core-only:' + location.pathname) === '1';
  coreOnly.addEventListener('change', () => store.set('core-only:' + location.pathname, coreOnly.checked ? '1' : ''));
}

function refresh() {
  // "What you predicted" echoes.
  for (const el of document.querySelectorAll('[data-tb-echo]')) el.textContent = store.get(el.dataset.tbEcho) || '';
  // Answered markers on quiz cards.
  for (const q of document.querySelectorAll('li.tb-q')) {
    const ta = q.querySelector('textarea');
    q.classList.toggle('tb-answered', !!(ta && store.get(ta.dataset.tbKey)));
  }
  // Counters: data-tb-count="selector" counts answered/checked among matches.
  for (const el of document.querySelectorAll('[data-tb-count]')) {
    const items = [...document.querySelectorAll(el.dataset.tbCount)];
    const done = items.filter((i) => (i.type === 'checkbox' ? i.checked : !!store.get(i.dataset.tbKey))).length;
    el.querySelector('b').textContent = `${done}/${items.length}`;
  }
  // Steps the student has finished.
  for (const a of document.querySelectorAll('.ds-steps a, .tb-path a')) {
    a.classList.toggle('tb-done', store.get('done:' + new URL(a.href, location.href).pathname) === '1');
  }
}

// A step counts as finished once its "next step" box has been reached.
const next = document.querySelector('.ds-next-action');
if (next && 'IntersectionObserver' in window) {
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) { store.set('done:' + location.pathname, '1'); refresh(); obs.disconnect(); }
  }).observe(next);
}

refresh();

// Remember this step so the home page can offer "Continue: …".
try {
  const h1 = document.querySelector('h1#_top'), step = document.querySelector('.tb-meta b');
  if (h1) localStorage.setItem('tb:last:' + document.documentElement.lang, JSON.stringify({ href: location.pathname, title: h1.textContent.trim() + (step ? ' · ' + step.textContent.trim() : '') }));
} catch {}
