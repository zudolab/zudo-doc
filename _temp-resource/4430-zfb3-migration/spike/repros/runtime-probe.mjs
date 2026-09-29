// Run inside a scratch package with zfb@3.0.0 and happy-dom installed.
import { Window } from 'happy-dom';
import { jsx } from '@takazudo/zfb/zudo-react/jsx-runtime';
import { h, signal, flush } from '@takazudo/zfb/zudo-react';
import { islandRoot, renderToString } from '@takazudo/zfb/zudo-react/server';
const window = new Window();
Object.assign(globalThis, { window, document: window.document, Node: window.Node,
  Element: window.Element, HTMLElement: window.HTMLElement, Event: window.Event });
const { hydrate, mount } = await import('@takazudo/zfb/zudo-react/client');
const identity = { component: 'Counter', build: 'spike' };
let count;
function Counter() {
  count = signal(0);
  return h('button', { id: 'counter', 'on:click': () => { count.value++; } }, count);
}
const node = jsx(Counter, {});
const ssr = renderToString(islandRoot(node, { identity }));
document.body.innerHTML = ssr;
const root = document.querySelector('[data-zfb-island]');
const diagnostics = [];
const handle = hydrate(node, root, { identity, report: d => diagnostics.push(d) });
root.querySelector('button')?.click();
await flush();
console.log(JSON.stringify({ ssr, afterClick: root.textContent, disposed: handle?.disposed, diagnostics }));
handle?.dispose();
root.innerHTML = '';
const mounted = mount(node, root, { identity, report: d => diagnostics.push(d) });
console.log(JSON.stringify({ afterMount: root.textContent, disposed: mounted?.disposed, diagnostics }));
mounted?.unmount();
// Intentionally corrupt SSR to check fail-closed hydration diagnostics.
document.body.innerHTML = ssr.replace('<button id="counter">', '<span id="counter">').replace('</button>', '</span>');
const badRoot = document.querySelector('[data-zfb-island]');
const bad = hydrate(node, badRoot, { identity, report: d => diagnostics.push(d) });
console.log(JSON.stringify({ failClosed: bad === null, afterFailure: badRoot.textContent, diagnostic: diagnostics.at(-1) }));
