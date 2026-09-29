import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizePage, allowlistedRemovedSvgAttrs, islandMarkers, cssInventory } from './normalize.mjs';

test('island marker extraction accepts unquoted, single, and double quoted values', () => {
  assert.deepEqual(islandMarkers('<div data-zfb-island=One></div><div data-zfb-island="Two"></div><div data-zfb-island=\'Three\'></div>'), ['One', 'Two', 'Three']);
});
test('protocol attrs and class order do not affect DOM structure', () => {
  const a = normalizePage('<div class="b a" data-zfb-island=Foo data-zfb-transport=x data-zfb-props=\'{"b":2,"a":1}\'><!--zudo-react:start--><p>x</p></div>');
  const b = normalizePage('<div data-zfb-props=\'{"a":1,"b":2}\' data-zfb-island="Foo" class="a b" data-zfb-protocol=y><p>x</p></div>');
  assert.deepEqual(a, b);
  assert.deepEqual(a.classes[0].classes, ['a', 'b']);
  assert.deepEqual(a.islands[0].props, { a: 1, b: 2 });
});
test('non-protocol DOM and class changes remain visible', () => {
  const a = normalizePage('<p class="a">x</p>');
  const b = normalizePage('<p class="b">y</p>');
  assert.notDeepEqual(a.dom, b.dom);
  assert.notDeepEqual(a.classes, b.classes);
});
test('CSS inventory keeps selectors, vars, media and layer order', () => {
  const css = cssInventory('@layer reset { p { --x: 1 } } @media (min-width: 40rem) { .a,.b { --y: 2 } }');
  assert.deepEqual(css.selectors, ['.a', '.b', 'p']);
  assert.deepEqual(css.customProperties, ['--x', '--y']);
  assert.equal(css.media.length, 1);
  assert.deepEqual(css.layers, ['@layer reset']);
});
test('v3 protocol and range markers normalize to v2 island shape', () => {
  const v2 = normalizePage('<div data-zfb-island=Card data-when=load data-props=\'{"a":1,"b":2}\'><span>Hi</span></div>');
  const v3 = normalizePage('<div data-zfb-island="Card" data-when="load" data-zfb-transport="json/1" data-zfb-protocol="zudo-react/1" data-zfb-build="abc" data-props=\'{"b":2,"a":1}\'><!--zr:1:0:0--><span>Hi</span><!--/zr:1:0--></div>');
  assert.deepEqual(v2, v3);
});
test('skip-SSR island inventory includes its scheduling mode and props', () => {
  const page = normalizePage('<div data-zfb-island-skip-ssr="MediaProbe" data-when="media" data-media="(max-width: 640px)" data-props=\'{"enabled":true}\'></div>');
  assert.deepEqual(page.islands[0], { path: '/0/1/0', name: 'MediaProbe', skipSsr: true, props: { enabled: true } });
});
test('#4433 permits only exact removed inert SVG attrs', () => {
  const before = normalizePage('<svg xmlns="http://www.w3.org/2000/svg" focusable="false" viewBox="0 0 2 2"><path d="M0 0"/></svg>');
  const after = normalizePage('<svg viewBox="0 0 2 2"><path d="M0 0"/></svg>');
  assert.deepEqual(allowlistedRemovedSvgAttrs(before.dom, after.dom), after.dom);
  const changed = normalizePage('<svg xmlns="https://wrong.example" focusable="true" viewBox="0 0 2 2"><path d="M0 0"/></svg>');
  assert.notDeepEqual(allowlistedRemovedSvgAttrs(changed.dom, after.dom), after.dom);
  const otherElement = normalizePage('<urlset xmlns="http://www.w3.org/2000/svg"></urlset>');
  const missing = normalizePage('<urlset></urlset>');
  assert.notDeepEqual(allowlistedRemovedSvgAttrs(otherElement.dom, missing.dom), missing.dom);
  const added = normalizePage('<svg viewBox="0 0 2 2" xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.notDeepEqual(allowlistedRemovedSvgAttrs(after.dom, added.dom), added.dom);
});
