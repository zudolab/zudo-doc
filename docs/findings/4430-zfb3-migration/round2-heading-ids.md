# Round 2 heading IDs — #4483 / #4428

Classification: `intentional-fix`, for the migration release. The extractor now recognizes homogeneous CommonMark fences with up to three spaces, rejects backtick info containing backticks, and closes only on a sufficiently long same-character run followed by whitespace. Four-space/tab indented code is excluded from heading extraction and JSX state scanning.

Character references decode exactly once in ordinary masked heading text before restoring protected code spans and backslash escapes. The declared parse5 decoder supplies the full named table; parse errors preserve unknown names rather than decoding legacy prefixes. Numeric references use Markdown's scalar/control validity rules, including U+FFFD for C1 controls instead of HTML Windows-1252 remapping.

## Actual published native oracle

On 2026-10-09, the public `@takazudo/zfb-md-wasm/render` API reported version **4.2.1**, matching the selected published engine pin. Command, run before changing the helper:

```sh
PATH=/tmp/zudo-tools/node_modules/.bin:$PATH node _temp-resource/4430-zfb3-migration/4483-heading-ids/native-probe.mjs
```

The permanent test fixture `src/__tests__/pages-lib/fixtures/heading-ids-4483/probe.mdx` holds named/multi-codepoint, numeric/invalid controls, unknown/incomplete, Unicode, escaped references/punctuation, inline code/spans, real fences and invalid closers, mixed runs, indented code, duplicates, nesting and h5/h6. The adjacent permanent `native-output.json` records the complete ordered **27 native IDs** and raw rendered HTML. This is native renderer evidence, not helper-generated expectations.

The pre-fix regression run returned **3 failures / 87 passes**: the helper returned only nine IDs, including `gt-1000ms`, `lt-2mm`, and the false `code-block-target`. Its full mismatch is preserved in `_temp-resource/4430-zfb3-migration/4483-heading-ids/prefail.log`. After the fix the same focused suite passed **90/90**, comparing all ordered IDs against a fresh native render and the recorded native oracle.

```sh
PATH=/tmp/zudo-tools/node_modules/.bin:$PATH ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run src/__tests__/pages-lib/extract-headings.test.ts
PATH=/tmp/zudo-tools/node_modules/.bin:$PATH ZFB3_SOURCE_RESOLVE=1 pnpm --filter @takazudo/zudo-doc test src/toc/ src/toc-prepaint/ src/desktop-toc-toggle-island/ src/doc-page-shell/__tests__/toc-toggle.test.tsx src/doclayout/__tests__/doc-layout-with-defaults-toc-gating.test.tsx
```

The focused existing TOC regressions passed **62 tests across nine files**. Durable logs beside the migration probe: `focused.log` and `toc-focused.log`. An earlier argument-forwarding attempt began a broader package suite and was terminated; `/tmp/zudo-headings4483-toc.log` is not successful verification evidence.

## Manager built and packed proof handoff

Prepared `/tmp/zudo4483-native-probe/project` is a new no-stub `zudoDoc` site with the same probe, authored links to all 27 native IDs, actual generated scaffold `scripts/check-links.js`, published 4.2.1 engine pins and a candidate-tarball dependency placeholder. It has no workspace links. The manager must substitute the freshly packed candidate, install/freeze dependencies, and run the build through the heavy guard. `/tmp/zudo4483-native-probe/verify.mjs` (durable copy: `verify-built-packed.mjs` beside the probe) then verifies:

- The complete ordered built h2–h6 IDs equal the native 27-ID oracle and the installed packed public helper.
- The actual TOC contains the complete depth 2–4 sequence (23 unique targets); each resolves to an emitted element ID.
- The strict scaffold checker accepts all 27 valid source anchors, including h5/h6, then separately rejects planted `genuinely-missing` and `code-block-target` anchors.

The built-output/packed proof is pending manager execution; the WASM and focused checks do not substitute for it. #4475 must recheck the final merged build. The permanent tests depend only on their adjacent fixtures; deleting `_temp-resource` in #4476 cannot break the suite. The reproduction script reads those fixtures and writes the oracle only with explicit `--capture`; ordinary reproduction is read-only. No archived headings, allowlists or compatibility shims changed.
