/* zudo-doc lookalike chrome + asset-viewer behaviours (prototype only) */
(function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"';
  const I = {
    home: `<svg ${S}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/></svg>`,
    chevR: `<svg ${S}><path d="M9 5l7 7-7 7"/></svg>`,
    chevD: `<svg ${S}><path d="M19 9l-7 7-7-7"/></svg>`,
    clock: `<svg ${S}><path d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    user: `<svg ${S}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`,
    search: `<svg ${S}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    sun: `<svg ${S}><circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/><line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/></svg>`,
    moon: `<svg ${S}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    palette: `<svg ${S}><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.5 2.5Q10.5 11.5 18 13Q10.5 14.5 9.5 23.5Q8.5 14.5 1 13Q8.5 11.5 9.5 2.5Z"/><path d="M19 0.5Q19.5 4 23.5 5Q19.5 6 19 9.5Q18.5 6 14.5 5Q18.5 4 19 0.5Z"/></svg>`,
    github: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.649.5.5 5.649.5 12a11.5 11.5 0 0 0 7.86 10.915c.575.106.785-.25.785-.556 0-.274-.01-1-.016-1.962-3.198.695-3.873-1.541-3.873-1.541-.523-1.327-1.277-1.68-1.277-1.68-1.044-.714.079-.699.079-.699 1.154.082 1.761 1.186 1.761 1.186 1.026 1.758 2.692 1.25 3.348.956.104-.743.401-1.25.73-1.537-2.553-.29-5.238-1.276-5.238-5.682 0-1.255.448-2.282 1.182-3.086-.119-.29-.512-1.458.111-3.04 0 0 .964-.309 3.159 1.18A10.98 10.98 0 0 1 12 6.036c.977.005 1.963.132 2.883.387 2.193-1.49 3.155-1.18 3.155-1.18.625 1.582.232 2.75.114 3.04.736.804 1.18 1.831 1.18 3.086 0 4.417-2.689 5.389-5.25 5.673.412.355.779 1.056.779 2.129 0 1.538-.014 2.778-.014 3.156 0 .31.207.668.79.555A11.502 11.502 0 0 0 23.5 12C23.5 5.649 18.351.5 12 .5Z"/></svg>`,
    download: `<svg ${S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    copy: `<svg ${S}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg ${S}><polyline points="20 6 9 17 4 12"/></svg>`,
    ext: `<svg ${S}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    file: `<svg ${S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    fileText: `<svg ${S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    code: `<svg ${S}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    fileCode: `<svg ${S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>`,
    image: `<svg ${S}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    film: `<svg ${S}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    archive: `<svg ${S}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    folder: `<svg ${S}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    hash: `<svg ${S}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
    wrap: `<svg ${S}><path d="M3 6h18"/><path d="M3 12h13a3 3 0 0 1 0 6h-4"/><path d="m14 16-2 2 2 2"/><path d="M3 18h6"/></svg>`,
    lines: `<svg ${S}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>`,
    doc: `<svg ${S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    maximize: `<svg ${S}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`,
    info: `<svg ${S}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    box: `<svg ${S}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    alert: `<svg ${S}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    history: `<svg ${S}><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/><polyline points="12 7 12 12 15 15"/></svg>`,
    arrowL: `<svg ${S}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  };
  window.ZD_ICONS = I;

  /* ---------- chrome ---------- */
  function header() {
    const nav = [['Getting Started','#'],['Learn','#','dd'],['Reference','#'],['Blog','#'],['Claude','#'],['Codex','#'],['Changelog','#','dd'],['Develop','#']];
    return `<header class="zd-header">
      <a class="zd-header-logo" href="index.html">zudo-doc</a>
      <nav class="zd-header-nav" aria-label="Main">${nav.map(([l,h,dd]) => `<a class="zd-nav-item" href="${h}">${l}${dd ? I.chevD : ''}</a>`).join('')}</nav>
      <div class="zd-header-right">
        <button class="zd-version-btn zd-hide-mobile" type="button"><span class="lbl">Version:</span><span class="val">Latest</span>${I.chevD}</button>
        <button class="zd-icon-btn" type="button" aria-label="Design token panel">${I.palette}</button>
        <button class="zd-icon-btn" type="button" aria-label="AI assistant">${I.sparkle}</button>
        <a class="zd-icon-btn" href="https://github.com/zudolab/zudo-doc" aria-label="GitHub">${I.github}</a>
        <button class="zd-icon-btn" type="button" id="zd-theme-toggle" aria-label="Toggle dark mode"></button>
        <button class="zd-icon-btn" type="button" aria-label="Search">${I.search}</button>
        <span class="zd-locale"><b>EN</b> / JA</span>
      </div>
    </header>`;
  }
  function footer() {
    return `<footer class="zd-footer"><div class="zd-footer-in">
      <div class="zd-footer-grid">
        <div><p>Docs</p><ul><li><a href="#">Getting Started</a></li><li><a href="#">Guides</a></li></ul></div>
        <div><p>Community</p><ul><li><a href="https://github.com/zudolab/zudo-doc">GitHub</a></li></ul></div>
      </div>
      <div class="zd-footer-copy">Copyright © 2026 <a href="https://x.com/Takazudo">Takazudo</a>. Built with <a href="#">zudo-doc</a>.</div>
    </div></footer>`;
  }
  function applyTheme(t) {
    const html = document.documentElement;
    if (t) html.setAttribute('data-theme', t); else html.removeAttribute('data-theme');
    const dark = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
    const b = document.getElementById('zd-theme-toggle');
    if (b) b.innerHTML = dark ? I.sun : I.moon;
  }
  function mountChrome() {
    const page = document.querySelector('.zd-page');
    if (!page) return;
    page.insertAdjacentHTML('beforebegin', header());
    page.insertAdjacentHTML('afterend', footer());
    let t = null; try { t = localStorage.getItem('zd-proto-theme'); } catch {}
    const q = new URLSearchParams(location.search).get('theme'); if (q === 'dark' || q === 'light') t = q;
    applyTheme(t);
    document.getElementById('zd-theme-toggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const dark = cur === 'dark' || (!cur && matchMedia('(prefers-color-scheme: dark)').matches);
      const next = dark ? 'light' : 'dark';
      try { localStorage.setItem('zd-proto-theme', next); } catch {}
      applyTheme(next);
    });
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = I[el.dataset.icon] || ''; });
  }

  /* ---------- mini highlighter (JS only — enough for a prototype) ---------- */
  const KW = new Set('import export from default const let var function return if else for of in while do switch case break continue new class extends super this throw try catch finally async await yield typeof instanceof void delete static get set'.split(' '));
  const CONST = new Set('true false null undefined NaN Infinity'.split(' '));
  const TOKEN = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|([{}()[\];,.])|([=+\-*/%<>!&|?:^~]+)|(\s+)|(.)/g;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function tokenize(src) {
    const out = []; let m;
    while ((m = TOKEN.exec(src))) {
      let cls = '';
      if (m[1]) cls = 'hi-com'; else if (m[2]) cls = 'hi-str'; else if (m[3]) cls = 'hi-num';
      else if (m[4]) cls = KW.has(m[4]) ? 'hi-kw' : 'hi-fn';
      else if (m[5]) cls = KW.has(m[5]) ? 'hi-kw' : CONST.has(m[5]) ? 'hi-const' : /^[A-Z]/.test(m[5]) ? 'hi-ty' : '';
      else if (m[6]) cls = 'hi-punct'; else if (m[7]) cls = 'hi-op';
      out.push([cls, m[0]]);
    }
    return out;
  }
  function highlight(src) {
    const lines = [['']]; // array of line html strings
    let cur = '';
    const push = (cls, text) => { cur += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text); };
    for (const [cls, text] of tokenize(src)) {
      const parts = text.split('\n');
      parts.forEach((p, i) => {
        if (i > 0) { lines[lines.length - 1] = cur; lines.push(''); cur = ''; }
        if (p) push(cls, p);
      });
    }
    lines[lines.length - 1] = cur;
    return lines.map(l => `<span class="line"><span>${l}\n</span></span>`).join('');
  }
  window.zdHighlight = highlight;

  /* ---------- code viewer wiring ---------- */
  function mountCodeViewers() {
    document.querySelectorAll('[data-code-src]').forEach(pre => {
      const srcEl = document.getElementById(pre.dataset.codeSrc);
      const src = srcEl ? srcEl.textContent.replace(/^\n/, '').replace(/\n$/, '') : '';
      const code = pre.querySelector('code') || pre.appendChild(document.createElement('code'));
      code.innerHTML = highlight(src);
      const n = src.split('\n').length;
      pre.style.setProperty('--gutter', `${String(n).length + 2}ch`);
      pre.dataset.lineCount = n;
      // line anchors
      const lines = [...pre.querySelectorAll('.line')];
      const setHL = (i) => { lines.forEach(l => l.classList.remove('highlighted')); if (lines[i - 1]) lines[i - 1].classList.add('highlighted'); };
      pre.addEventListener('click', e => {
        const line = e.target.closest('.line'); if (!line) return;
        const rect = line.getBoundingClientRect();
        if (e.clientX - rect.left > line.querySelector('span').offsetLeft) return; // clicked code, not gutter
        const i = lines.indexOf(line) + 1; location.hash = `L${i}`; setHL(i);
      });
      const fromHash = () => { const m = /^#L(\d+)$/.exec(location.hash); if (m) { setHL(+m[1]); lines[+m[1] - 1]?.scrollIntoView({ block: 'center' }); } };
      addEventListener('hashchange', fromHash); fromHash();
      // wire buttons scoped to the nearest [data-viewer] (or document)
      const scope = pre.closest('[data-viewer]') || document;
      scope.querySelectorAll('[data-act="copy"]').forEach(b => b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(src); } catch {}
        const lbl = b.querySelector('.lbl'); const ic = b.querySelector('[data-icon]');
        const oldL = lbl && lbl.textContent; const oldI = ic && ic.innerHTML;
        if (lbl) lbl.textContent = 'Copied'; if (ic) ic.innerHTML = I.check;
        setTimeout(() => { if (lbl) lbl.textContent = oldL; if (ic) ic.innerHTML = oldI; }, 1500);
      }));
      scope.querySelectorAll('[data-act="wrap"]').forEach(b => b.addEventListener('click', () => { pre.classList.toggle('is-wrapped'); b.classList.toggle('is-on'); }));
      scope.querySelectorAll('[data-act="gutter"]').forEach(b => b.addEventListener('click', () => { pre.classList.toggle('no-gutter'); b.classList.toggle('is-on'); }));
      scope.querySelectorAll('[data-act="download"]').forEach(a => {
        const blob = new Blob([src], { type: 'text/javascript' });
        a.href = URL.createObjectURL(blob); a.download = a.dataset.name || 'file.js';
      });
      scope.querySelectorAll('[data-act="raw"]').forEach(a => { a.href = URL.createObjectURL(new Blob([src], { type: 'text/plain' })); a.target = '_blank'; });
      scope.querySelectorAll('[data-fill="lines"]').forEach(el => el.textContent = n);
      scope.querySelectorAll('[data-fill="bytes"]').forEach(el => el.textContent = (new Blob([src]).size / 1024).toFixed(1) + ' KB');
    });
    // segmented controls: data-target = element, data-classes = all classes the group can set, button data-cls = class to apply
    document.querySelectorAll('.av-seg').forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
      const target = document.querySelector(seg.dataset.target); if (!target) return;
      (seg.dataset.classes || '').split(/\s+/).filter(Boolean).forEach(c => target.classList.remove(c));
      if (b.dataset.cls) target.classList.add(b.dataset.cls);
    }));
    // "copy link" buttons
    document.querySelectorAll('[data-act="copylink"]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href.replace(/[^/]*$/, '') + (b.dataset.href || '')); } catch {}
      const lbl = b.querySelector('.lbl'); const old = lbl && lbl.textContent; if (lbl) lbl.textContent = 'Copied';
      setTimeout(() => { if (lbl) lbl.textContent = old; }, 1500);
    }));
  }

  /* ---------- image enlarge (port of packages/zudo-doc/src/image-enlarge + mdx-components ENLARGE_SVG) ---------- */
  const ENLARGE_SVG = `<svg viewBox="0 0 38.99 38.99" fill="currentColor" focusable="false" aria-hidden="true"><polygon points="16.2 13.74 5.92 3.47 11.2 3.47 11.2 0 3.47 0 0 0 0 3.47 0 11.2 3.47 11.2 3.47 5.92 13.74 16.2 16.2 13.74"/><polygon points="25.24 16.2 35.52 5.92 35.52 11.2 38.99 11.2 38.99 3.47 38.99 0 35.52 0 27.79 0 27.79 3.47 33.07 3.47 22.79 13.74 25.24 16.2"/><polygon points="22.79 25.24 33.07 35.52 27.79 35.52 27.79 38.99 35.52 38.99 38.99 38.99 38.99 35.52 38.99 27.79 35.52 27.79 35.52 33.07 25.24 22.79 22.79 25.24"/><polygon points="13.74 22.79 3.47 33.07 3.47 27.79 0 27.79 0 35.52 0 38.99 3.47 38.99 11.2 38.99 11.2 35.52 5.92 35.52 16.2 25.24 13.74 22.79"/></svg>`;
  const CLOSE_SVG = `<svg viewBox="0 0 161.03 161.03" fill="currentColor" aria-hidden="true" focusable="false"><polygon points="161.03 10.27 150.76 0 80.51 70.24 10.27 0 0 10.27 70.24 80.51 0 150.76 10.27 161.03 80.51 90.78 150.76 161.03 161.03 150.76 90.78 80.51 161.03 10.27"/></svg>`;
  function mountImageEnlarge() {
    const figs = [...document.querySelectorAll('.zd-enlargeable')];
    if (!figs.length) return;
    // production wraps images at SSR time (figure.zd-enlargeable > img + button[hidden]); the prototype injects the button here
    figs.forEach(fig => { if (!fig.querySelector('.zd-enlarge-btn')) fig.insertAdjacentHTML('beforeend', `<button type="button" class="zd-enlarge-btn" hidden aria-label="Enlarge image">${ENLARGE_SVG}</button>`); });
    const dialog = document.createElement('dialog'); dialog.className = 'zd-enlarge-dialog'; document.body.appendChild(dialog);
    // eligibility: only images that have more pixels than they are currently shown with get the affordance
    const evaluate = img => { const btn = img.closest('.zd-enlargeable')?.querySelector('.zd-enlarge-btn'); if (!btn) return; btn.toggleAttribute('hidden', !(img.naturalWidth > img.clientWidth * devicePixelRatio)); };
    const ro = new ResizeObserver(es => es.forEach(e => evaluate(e.target)));
    document.querySelectorAll('.zd-enlargeable img').forEach(img => { ro.observe(img); if (img.complete) evaluate(img); else img.addEventListener('load', () => evaluate(img), { once: true }); });
    document.addEventListener('click', e => {
      const sel = getSelection(); if (sel && !sel.isCollapsed) return;
      const fig = e.target.closest('.zd-enlargeable'); if (!fig) return;
      if (!e.target.closest('.zd-enlarge-btn') && !e.target.closest('img')) return;
      const btn = fig.querySelector('.zd-enlarge-btn'); if (!btn || btn.hidden) return;
      const img = fig.querySelector('img'); if (!img) return;
      dialog.innerHTML = `<div style="position:relative"><img src="${img.currentSrc || img.src}" alt="${esc(img.alt)}"></div><button type="button" class="zd-enlarge-dialog-close" aria-label="Close enlarged image">${CLOSE_SVG}</button>`;
      dialog.querySelector('.zd-enlarge-dialog-close').addEventListener('click', () => dialog.close());
      dialog.showModal();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); // backdrop click; Esc is native
    dialog.addEventListener('close', () => { dialog.innerHTML = ''; });
  }
  window.zdMountImageEnlarge = mountImageEnlarge;

  document.addEventListener('DOMContentLoaded', () => { mountChrome(); mountCodeViewers(); mountImageEnlarge(); });
})();
