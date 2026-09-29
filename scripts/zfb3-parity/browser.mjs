#!/usr/bin/env node
/** Capture computed-style and screenshot evidence from a prebuilt dist. */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const root = resolve(option('--dist', 'dist'));
const output = resolve(option('--output', join(process.env.HOME ?? '', '.cache/zudo-doc-zfb3-parity/browser')));
const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
if (output === repoRoot || output.startsWith(repoRoot + sep)) throw new Error('Screenshot output must be outside the repository');
const routes = [ '/', '/docs/getting-started/', '/docs/guides/', '/docs/components/html-preview/', '/docs/components/mermaid-diagrams/', '/docs/components/math-equations/', '/docs/tags/', '/docs/versions/', '/ja/docs/getting-started/', '/v/1.0/docs/getting-started/', '/does-not-exist/', '/docs/reference/design-token-panel/' ];
const selectors = {
  header: 'header', nav: 'header nav', sidebar: '#desktop-sidebar', sidebarTree: '#desktop-sidebar nav', toc: 'nav[aria-label="Table of contents"]',
  heading: '.zd-content h1', subheading: '.zd-content h2', paragraph: '.zd-content p', code: '.zd-content pre',
  admonition: '[data-admonition]', table: '.zd-content table', button: 'button',
  link: '.zd-content a', footer: 'footer',
};
const properties = ['display', 'position', 'width', 'height', 'margin', 'padding', 'color', 'backgroundColor', 'borderColor', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'gap', 'opacity', 'visibility'];
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
  const path = resolve(root, '.' + pathname);
  if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  const file = existsSync(path) && statSync(path).isDirectory() ? join(path, 'index.html') : path;
  if (!existsSync(file) || !statSync(file).isFile()) {
    const notFound = join(root, '404.html');
    if (existsSync(notFound)) { response.statusCode = 404; response.setHeader('Content-Type', 'text/html'); createReadStream(notFound).pipe(response); return; }
    response.writeHead(404).end('Not found'); return;
  }
  response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(response);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const report = { source: root, routes: [], states: [] };
async function capture(page, route, viewport, scheme, state = 'default') {
  const styles = await page.evaluate(({ selectors, properties }) => {
    const result = {};
    for (const [name, selector] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      if (!element) { result[name] = null; continue; }
      const computed = getComputedStyle(element);
      result[name] = Object.fromEntries(properties.map((property) => [property, computed[property]]));
    }
    return result;
  }, { selectors, properties });
  const actualTheme = await page.locator('html').getAttribute('data-theme');
  const key = `${route.replaceAll('/', '_') || 'home'}-${viewport}-${scheme}-${state}`;
  await page.screenshot({
    path: join(output, `${key}.png`),
    fullPage: state === 'default',
    animations: 'disabled',
    timeout: 60_000,
  });
  report.states.push({ route, viewport, scheme, actualTheme, state, styles, screenshot: `${key}.png` });
}
try {
  await mkdir(output, { recursive: true });
  for (const route of routes) {
    const response = await fetch(baseUrl + route);
    if (!response.ok && route !== '/does-not-exist/') throw new Error(`Curated route ${route} returned ${response.status}`);
    report.routes.push(route);
    for (const width of [375, 1280]) for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme });
      await page.goto(baseUrl + route, { waitUntil: 'load' });
      await capture(page, route, width, scheme);
      await page.close();
    }
  }
  const statePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await statePage.goto(baseUrl + '/docs/getting-started/', { waitUntil: 'load' });
  const overlay = statePage.locator('#page-loading-overlay');
  if (await overlay.count()) {
    await overlay.evaluate((element) => element.setAttribute('data-visible', ''));
    await capture(statePage, '/docs/getting-started/', 1280, 'light', 'loading-spinner');
    await overlay.evaluate((element) => element.removeAttribute('data-visible'));
  }
  for (const width of [639, 640, 1023, 1024, 1279, 1280]) {
    await statePage.setViewportSize({ width, height: 900 });
    await capture(statePage, '/docs/getting-started/', width, 'light', 'breakpoint');
  }
  for (const [name, selector, action] of [
    ['footer-hover', 'footer a', 'hover'], ['footer-focus', 'footer a', 'focus'],
    ['group-hover', '.group', 'hover'],
    ['doc-history', '[aria-label="View document history"]', 'click'], ['ai-chat', '#ai-chat-trigger', 'click'],
    ['mobile-drawer', 'button[aria-label="Open sidebar"]', 'click'],
  ]) {
    const target = statePage.locator(selector).first();
    if (!await target.count()) continue;
    try {
      if (name === 'mobile-drawer') await statePage.setViewportSize({ width: 375, height: 900 });
      if (action === 'hover') await target.hover();
      else if (action === 'focus') await target.focus();
      else await target.click();
      await capture(statePage, '/docs/getting-started/', name === 'mobile-drawer' ? 375 : 1280, 'light', name);
      if (action === 'click') await statePage.keyboard.press('Escape');
    } catch { /* unavailable state is recorded by omission; review report coverage */ }
  }
  await statePage.close();
  for (const [route, selector, state] of [
    ['/docs/markdown-features/image-enlarge/', 'figure.zd-enlargeable .zd-enlarge-btn', 'image-enlarge'],
    ['/docs/components/mermaid-diagrams/', '.zd-mermaid-enlargeable .zd-enlarge-btn', 'mermaid-enlarge'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(baseUrl + route, { waitUntil: 'load' });
    const button = page.locator(selector).first();
    await button.waitFor({ state: 'visible', timeout: state === 'mermaid-enlarge' ? 30_000 : 10_000 });
    await button.click();
    await page.locator('dialog[open]').first().waitFor({ state: 'visible' });
    await capture(page, route, 1280, 'light', state);
    await page.close();
  }
  const packPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await packPage.goto(baseUrl + '/', { waitUntil: 'load' });
  const launcher = packPage.getByRole('button', { name: 'Theme pack switcher', exact: true });
  if (await launcher.count()) {
    await launcher.click();
    const browse = packPage.getByRole('button', { name: 'Browse all theme packs' });
    if (await browse.count()) {
      await browse.click();
      await packPage.getByRole('dialog', { name: 'Preview theme' }).waitFor({ state: 'visible' });
      await capture(packPage, '/', 1280, 'light', 'theme-pack-dialog');
      const card = packPage.getByRole('button', { name: /^Apply / }).first();
      if (await card.count()) { await card.click(); await capture(packPage, '/', 1280, 'light', 'theme-pack-selected-card'); }
    }
  }
  await packPage.close();
  await writeFile(join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Captured ${report.states.length} browser states in ${output}`);
} finally { await browser.close(); await new Promise((ok) => server.close(ok)); }
