// Run from the packed 3.1.0 scratch consumer after installing happy-dom.
import { Window } from 'happy-dom';
import { h, signal, flush } from '@takazudo/zfb/zudo-react';
import { islandRoot, renderToString } from '@takazudo/zfb/zudo-react/server';

const window = new Window();
Object.assign(globalThis, { window, document: window.document, Node: window.Node,
  Element: window.Element, HTMLElement: window.HTMLElement, Event: window.Event, CSS: window.CSS });
const { hydrate, mount } = await import('@takazudo/zfb/zudo-react/client');
const { mountIslands, unmountIslands, mountNewIslands } = await import('@takazudo/zfb/runtime');
const { swapBodyElement } = await import('./node_modules/@takazudo/zfb-runtime/dist/client-router/swap-functions.js');
const identity = { component: 'Counter', build: 'round2' };
let activations = 0;
let cleanups = 0;
let count;
function Counter() {
  count = signal(0);
  return h('button', { id: 'counter', 'on:click': () => { count.value++; } }, count);
}
const node = h(Counter, {});
const ssr = renderToString(islandRoot(node, { identity }));
const page = () => `<header data-zfb-transition-persist="header">${ssr}</header><main>page</main>`;
document.body.innerHTML = page();
const manifest = { Counter: { identity, mount(_props, root, mode) {
  activations++;
  const handle = mode === 'render' ? mount(node, root, { identity }) : hydrate(node, root, { identity });
  if (!handle) return null;
  return { dispose() { cleanups++; handle.dispose(); }, unmount() { cleanups++; handle.unmount(); } };
} } };
mountIslands(manifest);
const header = document.querySelector('header');
const button = document.querySelector('button');
button.click();
await flush();
const before = { text: button.textContent, mounted: button.parentElement.hasAttribute('data-zfb-island-mounted'), activations, cleanups };
const incoming = document.createElement('body');
incoming.innerHTML = page();
unmountIslands(document.body, incoming);
swapBodyElement(incoming, document.body);
mountNewIslands();
const sameNode = button === document.querySelector('button');
button.click();
await flush();
console.log('nested persisted island', JSON.stringify({ before, after: {
  sameNode, text: button.textContent, mounted: button.parentElement.hasAttribute('data-zfb-island-mounted'), activations, cleanups,
} }));

for (const [name, child] of [
  ['ol.start', h('ol', { start: 3 }, h('li', {}, 'three'))],
  ['pre.leading-LF', h('pre', {}, '\nabc')],
]) {
  const caseIdentity = { component: 'Case', build: 'round2' };
  function Case() { return child; }
  const caseNode = h(Case, {});
  const html = renderToString(islandRoot(caseNode, { identity: caseIdentity }));
  document.body.innerHTML = html;
  const root = document.querySelector('[data-zfb-island]');
  // happy-dom retains the first LF after <pre>; HTML parsers remove it.
  if (name === 'pre.leading-LF') root.querySelector('pre').firstChild.data = root.querySelector('pre').firstChild.data.slice(1);
  const diagnostics = [];
  const handle = hydrate(caseNode, root, { identity: caseIdentity, report: d => diagnostics.push(d) });
  console.log(name, JSON.stringify({ html, parsedText: root.textContent, hydrated: !!handle, diagnostics }));
  handle?.dispose();
}
