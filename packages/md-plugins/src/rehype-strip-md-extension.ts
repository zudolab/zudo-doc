import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';
import { isExternal } from './url-utils';

/**
 * Rehype plugin that strips .md/.mdx extensions from relative link hrefs
 * and ensures they have a trailing slash for Astro's `trailingSlash: "always"` mode.
 *
 * Markdown authors often write links like `[Other doc](./other-doc.md)`.
 * In Astro's static output, the correct URL is `/docs/other-doc/` (no extension).
 *
 * Astro 5+ may strip .md extensions before rehype runs, so this plugin also
 * handles relative links that have already lost their extension by adding
 * a trailing slash when the last path segment has no file extension.
 */
export function rehypeStripMdExtension() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (typeof href !== 'string') return;

      // Only process relative links (not http://, https://, mailto:, #, etc.)
      if (isExternal(href) || href.startsWith('#')) return;

      let newHref = href;

      // Strip .md or .mdx extension (with optional hash fragment)
      newHref = newHref.replace(
        /\.mdx?(#.*)?$/,
        (_match, hash) => (hash ? '/' + hash : '/'),
      );

      // For relative links where Astro already stripped .md:
      // add trailing slash if missing and the last segment has no file extension
      if (newHref === href && (newHref.startsWith('./') || newHref.startsWith('../'))) {
        const hashIdx = newHref.indexOf('#');
        const path = hashIdx >= 0 ? newHref.slice(0, hashIdx) : newHref;
        const hash = hashIdx >= 0 ? newHref.slice(hashIdx) : '';

        if (!path.endsWith('/')) {
          const lastSegment = path.split('/').pop() || '';
          // Only add slash if there's no file extension (like .png, .pdf, etc.)
          if (!/\.[a-zA-Z]\w*$/.test(lastSegment)) {
            newHref = path + '/' + hash;
          }
        }
      }

      if (newHref !== href) {
        node.properties.href = newHref;
      }
    });
  };
}
