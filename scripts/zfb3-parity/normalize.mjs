import { parse } from 'parse5';

const IGNORED_ATTRIBUTES = new Set(['data-zfb-transport', 'data-zfb-protocol', 'data-zfb-build', 'data-zfb-props', 'data-zfb-island-props', 'data-props']);
const ISLAND = /\bdata-zfb-island\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g;

export function islandMarkers(html) {
  return [...html.matchAll(ISLAND)].map((match) => match[1] ?? match[2] ?? match[3]);
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, sorted(val)]));
  return value;
}

function propsFor(attrs) {
  const attr = attrs.find(({ name }) => name === 'data-props' || name === 'data-zfb-props' || name === 'data-zfb-island-props');
  if (!attr) return null;
  try { return sorted(JSON.parse(attr.value)); }
  catch { return { invalidJson: attr.value }; }
}

export function normalizePage(html) {
  const islands = [];
  const classes = [];
  const walk = (node, path = '') => {
    if (node.nodeName === '#comment') {
      // zudo-react hydration boundaries and transport comments are protocol details.
      if (/zudo-react|zfb[-:]island|\bZR_|^\/?zr:1:/.test(node.data ?? '')) return null;
      return { comment: node.data };
    }
    if (node.nodeName === '#text') return { text: node.value };
    if (!node.tagName) {
      const children = (node.childNodes ?? []).filter((child) => !(child.nodeName === '#comment' && /zudo-react|zfb[-:]island|\bZR_|^\/?zr:1:/.test(child.data ?? ''))).map((child, i) => walk(child, `${path}/${i}`)).filter(Boolean);
      return { children };
    }
    const attrs = node.attrs ?? [];
    const island = attrs.find(({ name }) => name === 'data-zfb-island' || name === 'data-zfb-island-skip-ssr');
    if (island) islands.push({ path, name: island.value, skipSsr: island.name === 'data-zfb-island-skip-ssr', props: propsFor(attrs) });
    const classAttr = attrs.find(({ name }) => name === 'class');
    if (classAttr) classes.push({ path, tag: node.tagName, classes: [...new Set(classAttr.value.split(/\s+/).filter(Boolean))].sort() });
    const normalizedAttrs = attrs.filter(({ name }) => name !== 'class' && !IGNORED_ATTRIBUTES.has(name)).map(({ name, value }) => [name, /^(src|href)$/.test(name) && value.startsWith('/assets/') ? value.replace(/[A-Fa-f0-9]{8,}/g, 'HASH') : value]).sort(([a], [b]) => a.localeCompare(b));
    const children = (node.childNodes ?? []).filter((child) => !(child.nodeName === '#comment' && /zudo-react|zfb[-:]island|\bZR_|^\/?zr:1:/.test(child.data ?? ''))).map((child, i) => walk(child, `${path}/${i}`)).filter(Boolean);
    return { tag: node.tagName, attrs: normalizedAttrs, children };
  };
  return { dom: walk(parse(html)), islands, classes };
}

// CSS inventory is intentionally lexical. It records rules without interpreting values or
// expanding Tailwind output; declaration changes belong to the computed-style layer.
export function cssInventory(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = new Set();
  const properties = new Set();
  const media = new Set();
  const layers = [];
  const rule = /([^{}]+)\{/g;
  let match;
  while ((match = rule.exec(clean))) {
    const head = match[1].trim().replace(/\s+/g, ' ');
    const boundary = Math.max(head.lastIndexOf('}'), head.lastIndexOf(';'));
    const actual = head.slice(boundary + 1).trim();
    if (actual.startsWith('@media')) media.add(actual);
    else if (actual.startsWith('@layer')) { /* collected in source order below */ }
    else if (actual && !actual.startsWith('@')) for (const selector of actual.split(',')) selectors.add(selector.trim());
  }
  for (const declaration of clean.matchAll(/@layer\s+([^;{}]+)\s*[;{]/g)) layers.push(`@layer ${declaration[1].trim().replace(/\s+/g, ' ')}`);
  for (const prop of clean.matchAll(/(--[\w-]+)\s*:/g)) properties.add(prop[1]);
  return { selectors: [...selectors].sort(), customProperties: [...properties].sort(), media: [...media].sort(), layers };
}

export function canonical(value) { return JSON.stringify(value); }
