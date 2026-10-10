// Run in a scratch package with @takazudo/zfb@3.0.0 installed.
import { h } from '@takazudo/zfb/zudo-react';
import { islandRoot, renderToString } from '@takazudo/zfb/zudo-react/server';
const cases = [
  ['meta.property', h('meta', { property: 'og:title', content: 'x' })],
  ['link attrs', h('link', { rel: 'preload', as: 'script', integrity: 'sha256-x', hreflang: 'en' })],
  ['ol.start', h('ol', { start: 3 }, h('li', {}, 'x'))],
  ['svg.xmlns', h('svg', { xmlns: 'http://www.w3.org/2000/svg' })],
  ['div.popover', h('div', { popover: 'auto' })],
  ['iframe.srcdoc', h('iframe', { srcdoc: '<p>x</p>' })],
];
for (const [name, node] of cases) {
  try { console.log(name, renderToString(node)); }
  catch (error) { console.log(name, error.message); }
}
const identity = { component: 'Case', build: 'spike' };
for (const [name, child] of [
  ['direct iframe', h('iframe', { srcdoc: '<p>x</p>' })],
  ['raw iframe', h('div', { rawHtml: '<iframe srcdoc="<p>x</p>"></iframe>' })],
  ['raw script', h('script', { rawHtml: 'window.x=1' })],
  ['onload string', h('img', { src: 'x', onload: 'window.x=1' })],
]) {
  function Case() { return child; }
  try { console.log(name, renderToString(islandRoot(h(Case, {}), { identity }))); }
  catch (error) { console.log(name, error.message); }
}
