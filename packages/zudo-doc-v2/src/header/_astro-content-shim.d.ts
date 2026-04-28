// Local type shim for `astro:content`.
//
// The host project's `@/config/i18n` re-exports a `CollectionKey` type
// imported from Astro's virtual `astro:content` module. That virtual
// module is materialized by Astro's tooling when running `astro check`
// against the project root, but the v2 package's standalone `tsc --
// noEmit` pass does not run through Astro and so the import resolves
// to nothing.
//
// Mirrors the existing `theme/_zfb-shim.d.ts` pattern: provide just
// enough surface for the v2 type-check to succeed without taking a
// real runtime dependency on `astro:content`. The shape is intentional
// — `CollectionKey` is "any string content collection name", and that
// is the only export the i18n module pulls from this virtual module.

declare module "astro:content" {
  /**
   * In the real Astro virtual module, `CollectionKey` is the union of
   * literal collection names registered in `content.config.ts`. For
   * the v2 package we only need it to behave as a string-like type; the
   * branding adds no runtime weight and helps preserve the original
   * intent if a downstream consumer ever passes the value through.
   */
  export type CollectionKey = string & { readonly __collectionKey?: unique symbol };
}
