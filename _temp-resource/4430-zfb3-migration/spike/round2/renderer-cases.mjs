// Run from the packed 3.1.0 scratch consumer.
import { h } from '@takazudo/zfb/zudo-react';
import { islandRoot, renderToString } from '@takazudo/zfb/zudo-react/server';
const identity = { component: 'Case', build: 'round2' };
function show(name, value) {
  try { console.log(name, renderToString(value)); }
  catch (error) { console.log(name, error.message); }
}
for (const [name, tag, props] of [
  ['meta.property', 'meta', { property: 'og:title', content: 'x' }],
  ['link.as', 'link', { rel: 'preload', as: 'script' }],
  ['svg.xmlns', 'svg', { xmlns: 'http://www.w3.org/2000/svg' }],
  ['div.popover', 'div', { popover: 'auto' }],
  ['search.element', 'search', {}],
  ['ol.start', 'ol', { start: 3 }],
  ['style.inset', 'div', { style: { inset: '1px' } }],
  ['style.cursor', 'div', { style: { cursor: 'pointer' } }],
  ['style.margin.number', 'div', { style: { margin: 4 } }],
]) show(name, h(tag, props));
function Case() { return h('div', {}, 'ok'); }
show('props.undefined', islandRoot(h(Case, { optional: undefined }), { identity }));
function IframeCase() { return h('iframe', {}); }
show('island.iframe', islandRoot(h(IframeCase, {}), { identity: { ...identity, component: 'IframeCase' } }));
show('pre.leading-LF', h('pre', {}, '\nabc'));
