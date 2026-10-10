#!/usr/bin/env node
/**
 * Decompose sidebar height differences (#4505) and exercise the 06R scope
 * toolbar (#4500) on a live or prebuilt site.
 *
 *   node scripts/zfb3-parity/sidebar-decompose.mjs measure (--dist <dir> | --base-url <url>) --output <dir>
 *   node scripts/zfb3-parity/sidebar-decompose.mjs scope   (--dist <dir> | --base-url <url>) --output <dir> [--fixture sidebar]
 *   node scripts/zfb3-parity/sidebar-decompose.mjs compare --baseline <measure.json> --current <measure.json> --output <prefix>
 *
 * `measure` records, per route and viewport, the sidebar nav height and its
 * parts: filter box, 06R toolbar box (+ hint line count), filter→tree offset,
 * per-row heights with wrapped-label line counts, tree area, footer and the
 * scroll viewport extents. `compare` attributes each nav height delta to the
 * toolbar, scope-hint wrapping, extra/removed rows, row wrapping, or residual.
 * `scope` (current side only) drives Broaden / Restore / branch focus on
 * desktop, narrow and mobile-drawer layouts and records article, URL/hash,
 * scroll, TOC and drawer invariants plus screenshots. Run every browser mode
 * through `heavy-guard.sh`. Output must stay outside the repository.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const [mode, ...args] = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const output = option('--output') && resolve(option('--output'));
if (!mode || !output) throw new Error('usage: sidebar-decompose.mjs measure|scope|compare ... --output <dir|prefix>');
if (output === repoRoot || output.startsWith(repoRoot + sep)) throw new Error('Output must be outside the repository');

const PARITY_ROUTES = ['/docs/getting-started/', '/docs/guides/', '/docs/components/html-preview/', '/docs/components/mermaid-diagrams/', '/docs/components/math-equations/', '/ja/docs/getting-started/', '/ja/docs/guides/', '/v/1.0/docs/getting-started/', '/docs/reference/design-token-panel/', '/docs/markdown-features/image-enlarge/'];
const DESKTOP = '#desktop-sidebar nav';
const DRAWER = '[data-zd-mobile-sidebar] nav';

if (mode === 'compare') await compare();
else await withSite(mode === 'measure' ? measure : scope);

async function withSite(run) {
  const dist = option('--dist');
  let server;
  let baseUrl = option('--base-url');
  if (dist) {
    const root = resolve(dist);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
    server = createServer((request, response) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
      const path = resolve(root, '.' + pathname);
      if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      const file = existsSync(path) && statSync(path).isDirectory() ? join(path, 'index.html') : existsSync(path) ? path : `${path}.html`;
      if (!existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end('Not found'); return; }
      response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      createReadStream(file).pipe(response);
    });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  if (!baseUrl) throw new Error('Pass --dist <dir> or --base-url <url>');
  baseUrl = baseUrl.replace(/\/$/, '');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  await mkdir(output, { recursive: true });
  try { await run(browser, baseUrl); } finally { await browser.close(); if (server) await new Promise((ok) => server.close(ok)); }
}

/** In-page measurement of one sidebar nav. Works on pre-06R and 06R markup. */
function measureNav(selector) {
  const nav = document.querySelector(selector);
  if (!nav) return null;
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, right: r.right }; };
  const lines = (el) => {
    if (!el) return 0;
    const range = document.createRange(); range.selectNodeContents(el);
    return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
  };
  const textRects = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rects = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      rects.push(...[...range.getClientRects()].filter((r) => r.width > 0));
    }
    return rects;
  };
  const navBox = box(nav);
  const input = nav.querySelector('input[aria-label="Filter navigation"]');
  const filter = input?.parentElement?.parentElement ?? null;
  const toolbar = nav.querySelector('[data-sidebar-scope-toolbar]');
  const last = nav.lastElementChild;
  const footer = last && /pb-\[50vh\]/.test(last.className) ? last : null;
  const treeRoot = nav.querySelector('[data-sidebar-tree-root]');
  const children = [...nav.children];
  const treeChildren = treeRoot ? [treeRoot] : children.slice(children.indexOf(filter) + 1).filter((el) => el !== toolbar && el !== footer);
  const treeTop = treeChildren.length ? Math.min(...treeChildren.map((el) => box(el).top)) : (footer ? box(footer).top : navBox.bottom);
  const treeBottom = treeChildren.length ? Math.max(...treeChildren.map((el) => box(el).bottom)) : treeTop;
  const rows = treeChildren.flatMap((el) => [...el.querySelectorAll('a[href], button[aria-expanded]')])
    .filter((el) => el.getClientRects().length > 0)
    .map((el) => {
      const label = [...el.querySelectorAll('span')].filter((s) => s.children.length === 0 && s.textContent.trim()).pop() ?? el;
      const text = textRects(el);
      // 06R branch-focus control sits beside the row's link/disclosure (#4505 deep-nesting overlap check).
      const focus = el.parentElement?.querySelector(':scope > [data-sidebar-focus]');
      const fr = focus?.getBoundingClientRect();
      return {
        kind: el.tagName === 'A' ? 'link' : 'disclosure', text: el.textContent.trim().replace(/\s+/g, ' '), href: el.getAttribute('href'),
        top: Math.round(box(el).top - navBox.top), height: +box(el).height.toFixed(2), lines: lines(label),
        overflowX: el.scrollWidth > el.clientWidth + 1,
        textBeyondNav: text.length ? +(Math.max(...text.map((r) => r.right)) - navBox.right).toFixed(1) : 0,
        overlapsFocus: !!fr && text.some((r) => r.right > fr.left + 0.5 && r.left < fr.right - 0.5 && r.bottom > fr.top && r.top < fr.bottom),
      };
    });
  // A linked category renders link + disclosure side by side; count it once.
  const rowTops = new Set(rows.map((r) => r.top));
  let viewport = nav.parentElement;
  while (viewport && viewport !== document.body && !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)) viewport = viewport.parentElement;
  const hint = toolbar?.querySelector(':scope > span');
  return {
    selector, navWidth: +nav.getBoundingClientRect().width.toFixed(2), navHeight: +navBox.height.toFixed(3),
    filterHeight: filter ? +box(filter).height.toFixed(3) : 0,
    toolbar: toolbar ? {
      height: +box(toolbar).height.toFixed(3), hint: hint?.textContent ?? null, hintLines: lines(hint),
      // flex-wrap pushes the hint below the Broaden button when the row is too narrow.
      hintOwnRow: !!hint && box(hint).top >= box(toolbar.querySelector('[data-sidebar-broaden]')).bottom - 1,
      broadenDisabled: !!toolbar.querySelector('[data-sidebar-broaden]')?.disabled,
      restore: !!toolbar.querySelector('[data-sidebar-restore]'),
      buttons: [...toolbar.querySelectorAll('button')].map((b) => ({ text: b.textContent.trim(), height: +box(b).height.toFixed(2) })),
    } : null,
    filterToTree: filter ? +(treeTop - box(filter).bottom).toFixed(3) : null,
    treeArea: +(treeBottom - treeTop).toFixed(3),
    footerHeight: footer ? +box(footer).height.toFixed(3) : 0,
    rowCount: rowTops.size, rowLines: rows.reduce((n, r) => n + r.lines, 0), rows,
    focusButtons: nav.querySelectorAll('[data-sidebar-focus]').length,
    scroll: viewport && viewport !== document.body ? { scrollHeight: viewport.scrollHeight, clientHeight: viewport.clientHeight } : null,
  };
}

async function open(browser, baseUrl, route, width, opts = {}) {
  const context = await browser.newContext({ viewport: { width, height: opts.height ?? 900 }, colorScheme: opts.scheme ?? 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(baseUrl + route, { waitUntil: 'networkidle', timeout: 60_000 });
  return { page, context, errors };
}

async function measure(browser, baseUrl) {
  const report = { baseUrl, takenAt: new Date().toISOString(), states: [] };
  for (const route of PARITY_ROUTES) for (const width of [375, 639, 1023, 1024, 1279, 1280]) {
    const { page, context } = await open(browser, baseUrl, route, width);
    const selector = width >= 1024 ? DESKTOP : DRAWER;
    report.states.push({ route, width, ...(await page.evaluate(measureNav, selector)) });
    await context.close();
  }
  await writeFile(join(output, 'sidebar-measure.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Measured ${report.states.length} sidebar states in ${output}`);
}

async function compare() {
  const [a, b] = await Promise.all(['--baseline', '--current'].map(async (name) => JSON.parse(await readFile(resolve(option(name)), 'utf8'))));
  const key = (s) => `${s.route} ${s.width}`;
  const base = new Map(a.states.map((s) => [key(s), s]));
  const rows = [];
  for (const cur of b.states) {
    const old = base.get(key(cur));
    if (!old || !old.navHeight) continue;
    const delta = +(cur.navHeight - old.navHeight).toFixed(3);
    const toolbar = cur.toolbar?.height ?? 0;
    const offset = +((cur.filterToTree ?? 0) - (old.filterToTree ?? 0) - toolbar).toFixed(3);
    const tree = +(cur.treeArea - old.treeArea).toFixed(3);
    const parts = {
      hintLines: cur.toolbar?.hintLines ?? 0, hintOwnRow: !!cur.toolbar?.hintOwnRow,
      extraRows: cur.rowCount - old.rowCount,
      extraWrappedLines: (cur.rowLines - cur.rowCount) - (old.rowLines - old.rowCount),
      treeArea: tree, filterHead: +(cur.filterHeight - old.filterHeight).toFixed(3), footer: +(cur.footerHeight - old.footerHeight).toFixed(3), offsetOutsideToolbar: offset,
    };
    const residual = +(delta - toolbar - offset - tree - parts.filterHead - parts.footer).toFixed(3);
    const newLabels = cur.rows.map((r) => r.text).filter((t) => !old.rows.some((r) => r.text === t));
    rows.push({ state: key(cur), baseline: old.navHeight, current: cur.navHeight, delta, toolbar, ...parts, residual, newLabels });
  }
  const prefix = resolve(option('--output'));
  await writeFile(`${prefix}.json`, JSON.stringify(rows, null, 2) + '\n');
  const md = ['| state | baseline | current | Δ | toolbar | hint own row | Δtree | extra rows | extra wrap lines | residual | new rows |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.state} | ${r.baseline} | ${r.current} | ${r.delta} | ${r.toolbar} | ${r.hintOwnRow ? 'yes' : 'no'} | ${r.treeArea} | ${r.extraRows} | ${r.extraWrappedLines} | ${r.residual} | ${r.newLabels.join(', ')} |`)].join('\n');
  await writeFile(`${prefix}.md`, md + '\n');
  console.log(md);
}

/** Current-side 06R behaviour walk. Every step records invariants; screenshots go to --output. */
async function scope(browser, baseUrl) {
  const fixture = option('--fixture');
  const log = [];
  const shot = async (page, name, locator) => { const file = `${name}.png`; await (locator ?? page).screenshot({ path: join(output, file), animations: 'disabled' }); return file; };
  const invariants = (page) => page.evaluate(() => ({
    url: location.pathname + location.hash, scrollY: Math.round(scrollY), h1: document.querySelector('.zd-content h1, main h1, h1')?.textContent?.trim(),
    toc: (() => { const t = document.querySelector('nav[aria-label="Table of contents"], [data-zd-toc]'); if (!t) return null; const r = t.getBoundingClientRect(); return { visible: r.width > 0 && r.height > 0, top: Math.round(r.top), links: t.querySelectorAll('a').length, current: t.querySelector('[aria-current="true"]')?.getAttribute('href') ?? null }; })(),
    drawerOpen: !!document.querySelector('button[aria-label="Close sidebar"]'),
  }));
  const roots = (page, sel) => page.evaluate((s) => {
    const root = document.querySelector(`${s} [data-sidebar-tree-root]`);
    if (!root) return [];
    // A top-level row is the first link/disclosure of each direct child block.
    // Identity = label + first href, so same-label roots from different sections stay distinct.
    return [...root.querySelectorAll(':scope > div')].map((block) => `${block.querySelector('a, button')?.textContent?.trim().replace(/\s+/g, ' ')} <${block.querySelector('a[href]')?.getAttribute('href') ?? ''}>`);
  }, sel);
  const toolbarState = (page, sel) => page.evaluate((s) => {
    const t = document.querySelector(`${s} [data-sidebar-scope-toolbar]`);
    return t ? { hint: t.querySelector(':scope > span')?.textContent, broadenDisabled: !!t.querySelector('[data-sidebar-broaden]')?.disabled, restore: !!t.querySelector('[data-sidebar-restore]') } : null;
  }, sel);
  const settle = (page) => page.waitForTimeout(250);
  // Hydration has no DOM signal; retry the click until the toolbar state changes.
  async function act(page, sel, locator, label) {
    const before = JSON.stringify([await toolbarState(page, sel), await roots(page, sel)]);
    for (let attempt = 0; attempt < 20; attempt++) {
      await locator.click({ timeout: 5000 });
      await settle(page);
      if (JSON.stringify([await toolbarState(page, sel), await roots(page, sel)]) !== before) return true;
      await page.waitForTimeout(250);
    }
    log.push({ warning: `no observable change after ${label}` });
    return false;
  }

  const walk = async ({ name, route, width, drawer, touch, scheme }) => {
    const { page, context, errors } = await open(browser, baseUrl, route, width, { touch, scheme, height: drawer ? 844 : 900 });
    const sel = drawer ? '[data-zd-mobile-sidebar] nav' : '#desktop-sidebar nav';
    const steps = [];
    const sidebarShot = () => page.locator(drawer ? '[data-zd-mobile-sidebar]' : '#desktop-sidebar');
    // A hash entry keeps its anchored position; other pages get a non-zero reading scroll.
    if (!route.includes('#')) await page.evaluate(() => window.scrollTo(0, 240));
    // Let the TOC scroll-spy observe the reading position before the baseline snapshot.
    await page.waitForTimeout(1000);
    if (drawer) {
      for (let i = 0; i < 20 && !(await page.locator('button[aria-label="Close sidebar"]').isVisible()); i++) { await page.locator('button[aria-label="Open sidebar"]').click().catch(() => {}); await page.waitForTimeout(300); }
    }
    const start = await invariants(page);
    const record = async (step) => {
      const inv = await invariants(page);
      const m = await page.evaluate(measureNav, sel);
      const rootLabels = await roots(page, sel);
      steps.push({ step, toolbar: await toolbarState(page, sel), roots: rootLabels, duplicateRoots: rootLabels.length !== new Set(rootLabels).size,
        rowCount: m?.rowCount, overflowRows: m?.rows.filter((r) => r.overflowX).map((r) => r.text),
        focusOverlapRows: m?.rows.filter((r) => r.overlapsFocus).map((r) => r.text), beyondNavRows: m?.rows.filter((r) => r.textBeyondNav > 0.5).map((r) => r.text), wrappedRows: m?.rows.filter((r) => r.lines > 1).map((r) => `${r.text} (${r.lines})`),
        invariantsHeld: inv.url === start.url && inv.scrollY === start.scrollY && inv.h1 === start.h1 && JSON.stringify(inv.toc) === JSON.stringify(start.toc) && inv.drawerOpen === start.drawerOpen,
        invariants: inv, screenshot: await shot(page, `${name}-${String(steps.length).padStart(2, '0')}-${step.replace(/[^a-z0-9]+/gi, '-')}`, sidebarShot()) });
    };
    await record('initial');
    const broaden = page.locator(`${sel} [data-sidebar-broaden]`);
    for (let level = 1; level <= 14 && await broaden.count() && !(await broaden.isDisabled()); level++) {
      if (touch) { await broaden.tap(); await settle(page); } else await act(page, sel, broaden, 'broaden');
      await record(`broaden-${level}`);
    }
    const focusButtons = page.locator(`${sel} [data-sidebar-focus]`);
    if (await focusButtons.count() > 1) {
      const target = focusButtons.nth(1);
      const label = await target.getAttribute('aria-label');
      if (touch) { await target.tap(); await settle(page); } else await act(page, sel, target, 'focus');
      await record(`focus ${label}`);
    }
    const restore = page.locator(`${sel} [data-sidebar-restore]`);
    if (await restore.count()) { if (touch) { await restore.tap(); await settle(page); } else await act(page, sel, restore, 'restore'); await record('restore'); }
    let closesOnLink = null;
    if (drawer) {
      const link = page.locator(`${sel} [data-sidebar-tree-root] a[href]:not([aria-current="page"]):visible`).first();
      if (await link.count()) {
        await link.click();
        closesOnLink = await page.locator('button[aria-label="Open sidebar"]').waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false);
      }
    }
    log.push({ name, route, width, drawer: !!drawer, touch: !!touch, scheme: scheme ?? 'light', start, steps, closesOnLink, pageErrors: errors });
    await context.close();
  };

  const keyboard = async (route, width) => {
    const { page, context } = await open(browser, baseUrl, route, width);
    const sel = '#desktop-sidebar nav';
    await page.locator(`${sel} input[aria-label="Filter navigation"]`).focus();
    const stops = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement; const cs = getComputedStyle(el);
        return { tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' '), focusVisible: el.matches(':focus-visible'),
          outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, background: cs.backgroundColor, textDecoration: cs.textDecorationLine, data: Object.keys(el.dataset).join(',') };
      });
      const file = `keyboard-${route.replace(/\W+/g, '_')}-${width}-tab${i + 1}.png`;
      await page.locator('#desktop-sidebar').screenshot({ path: join(output, file), animations: 'disabled' });
      stops.push({ ...info, screenshot: file });
    }
    // Activating the focused branch-focus control with Enter must not navigate.
    const focusBtn = page.locator(`${sel} [data-sidebar-focus]`).first();
    const url = page.url();
    if (await focusBtn.count()) { await focusBtn.focus(); await page.keyboard.press('Enter'); await settle(page); }
    log.push({ name: `keyboard ${route} ${width}`, stops, enterOnFocusKeepsUrl: page.url() === url });
    await context.close();
  };

  const separation = async (route, width) => {
    const { page, context } = await open(browser, baseUrl, route, width);
    const rows = await page.evaluate(() => [...document.querySelectorAll('#desktop-sidebar nav [data-sidebar-focus]')].map((f) => {
      const row = f.parentElement;
      const link = row.querySelector('a[href]'); const disclosure = row.querySelector('button[aria-expanded]');
      const r = (el) => el && el.getBoundingClientRect();
      const overlap = (x, y) => x && y && !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top);
      return { focus: f.getAttribute('aria-label'), link: link?.getAttribute('href') ?? null, disclosure: disclosure?.getAttribute('aria-label') ?? null,
        focusBox: [Math.round(r(f).width), Math.round(r(f).height)], overlapLink: !!overlap(r(f), r(link)), overlapDisclosure: !!overlap(r(f), r(disclosure)), focusTabbable: f.tabIndex >= 0 && !f.disabled };
    }));
    log.push({ name: `separation ${route} ${width}`, rows });
    await context.close();
  };

  if (fixture === 'sidebar') {
    const deep = `/docs/guides/deep/${Array.from({ length: 11 }, (_, i) => `level-${String(i + 2).padStart(2, '0')}`).join('/')}/page`;
    await walk({ name: 'fixture-deep-1024', route: deep, width: 1024 });
    await walk({ name: 'fixture-deep-1280', route: deep, width: 1280 });
    await walk({ name: 'fixture-deep-390-drawer', route: deep, width: 390, drawer: true, touch: true });
    await walk({ name: 'fixture-editorial-1280', route: '/docs/editorial/background', width: 1280 });
    // Twelve-level ladder: focus the deepest branch, then broaden one editorial level per click.
    for (const [width, drawer] of [[1024, false], [390, true]]) {
      const { page, context, errors } = await open(browser, baseUrl, deep, width, { height: 844 });
      const sel = drawer ? '[data-zd-mobile-sidebar] nav' : '#desktop-sidebar nav';
      if (drawer) for (let i = 0; i < 20 && !(await page.locator('button[aria-label="Close sidebar"]').isVisible()); i++) { await page.locator('button[aria-label="Open sidebar"]').click().catch(() => {}); await page.waitForTimeout(300); }
      const ladder = [];
      const focus12 = page.locator(`${sel} [data-sidebar-focus][aria-label$="Deep level 12 with a long wrapped editorial category label"]`);
      await act(page, sel, focus12, 'focus level 12');
      for (let i = 0; i < 13; i++) {
        const m = await page.evaluate(measureNav, sel);
        ladder.push({ roots: await roots(page, sel), toolbar: await toolbarState(page, sel), toolbarHeight: m?.toolbar?.height, overflowRows: m?.rows.filter((r) => r.overflowX).map((r) => r.text),
          focusOverlapRows: m?.rows.filter((r) => r.overlapsFocus).map((r) => r.text), beyondNavRows: m?.rows.filter((r) => r.textBeyondNav > 0.5).map((r) => r.text),
          screenshot: await shot(page, `fixture-ladder-${width}-${String(i).padStart(2, '0')}`, page.locator(drawer ? '[data-zd-mobile-sidebar]' : '#desktop-sidebar')) });
        const broaden = page.locator(`${sel} [data-sidebar-broaden]`);
        if (await broaden.isDisabled()) break;
        await act(page, sel, broaden, 'broaden ladder');
      }
      log.push({ name: `fixture-ladder-${width}`, ladder, drawerStillOpen: await page.locator('button[aria-label="Close sidebar"]').isVisible(), pageErrors: errors });
      await context.close();
    }
  } else {
    await walk({ name: 'guides-1024', route: '/docs/guides/', width: 1024 });
    await walk({ name: 'guides-1280-dark', route: '/docs/guides/', width: 1280, scheme: 'dark' });
    await walk({ name: 'component-1024', route: '/docs/components/html-preview/', width: 1024 });
    await walk({ name: 'ja-guides-1024', route: '/ja/docs/guides/', width: 1024 });
    await walk({ name: 'ja-gs-1024', route: '/ja/docs/getting-started/', width: 1024 });
    await walk({ name: 'hash-1280', route: '/docs/components/html-preview/#basic-usage', width: 1280 });
    await walk({ name: 'guides-390-drawer-touch', route: '/docs/guides/', width: 390, drawer: true, touch: true });
    await walk({ name: 'ja-guides-320-drawer', route: '/ja/docs/guides/', width: 320, drawer: true });
    await walk({ name: 'component-1023-drawer', route: '/docs/components/html-preview/', width: 1023, drawer: true });
    await keyboard('/docs/guides/', 1024);
    await separation('/docs/guides/', 1280);
    await separation('/docs/components/html-preview/', 1024);
  }
  await writeFile(join(output, `scope-${fixture ?? 'site'}.json`), JSON.stringify({ baseUrl, takenAt: new Date().toISOString(), log }, null, 2) + '\n');
  console.log(`Scope walk: ${log.length} entries in ${output}`);
}
