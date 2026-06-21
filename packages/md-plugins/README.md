# @takazudo/zudo-doc-md-plugins

**PRIVATE — internal fixture/parity-test asset. Not published. Not shippable API.**

Do not import from application code. This package is excluded from all generated
project dependencies (see `packages/create-zudo-doc/src/scaffold.ts`).

## Purpose

This package holds the JS-side remark/rehype plugin implementations that were
used during the Astro era of zudo-doc. They are superseded by the Rust pipeline
shipped in **zfb** (`@takazudo/zfb`), but are kept here to:

1. Provide a reference corpus for parity-diffing JS behaviour against the zfb
   Rust pipeline.
2. Power `src/__tests__/` unit and fixture tests so regressions are caught by
   `pnpm test` before merge.

## Surviving exports

Only the three plugins whose tests are still active are re-exported from
`src/index.ts`:

- `remarkAdmonitions` — directive-form admonitions (`:::note`, `:::tip`, …)
- `remarkResolveMarkdownLinks` — resolve `.md`/`.mdx` links to route URLs
- `rehypeStripMdExtension` — strip `.md`/`.mdx` extensions from `<a href>`

All other plugins were retired when zfb #104 achieved byte-for-byte parity with
their JS counterparts. See `AUDIT.md` for the full classification table.

## Two pending upstream zfb follow-ups

- **ResolveLinksPlugin orchestrator wiring** — the zfb port exists but the
  orchestrator does not yet instantiate it for production builds. The JS shim
  is retained until this lands. (AUDIT.md NOTE-1)
- **rehypeStripMdExtension query-string divergence** — the JS regex does not
  handle query strings; zfb intentionally fixes the bug. The JS fixture is kept
  as the divergence reference until the upstream issue formally closes this.
  (AUDIT.md NOTE-2)

## Running tests

```bash
pnpm --filter @takazudo/zudo-doc-md-plugins test
```

To regenerate fixture snapshots after intentional plugin changes:

```bash
cd packages/md-plugins
UPDATE_FIXTURES=1 pnpm test
```
