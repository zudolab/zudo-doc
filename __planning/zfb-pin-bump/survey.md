# W1A Survey: zfb Pin Bump — Embed V8 (`88cec07..e550167`)

**Date:** 2026-05-04
**Branch:** `zfb-pin-bump-embed-v8/w1a-survey`
**Target upstream SHA:** `e550167` (merge of PR #168 — `[Embed V8] Replace miniflare subprocess with embedded deno_core`)

---

## 1. Diff Summary (`88cec07..e550167`)

Two independent PRs land in this range:

### PR #157 — `fix/basic-blog-end-to-end` (1 non-merge commit)

- `26f5141` `fix: make examples/basic-blog build end-to-end (6 bugs fixed)`
  Minor bug fixes to the example project; no consumer-facing API change.

### PR #168 — `base/embed-v8` (sub-issues #161–#167, 22 non-merge commits)

The embed-v8 epic replaces the miniflare subprocess with an in-process V8 isolate via `deno_core`. Merged in seven sub-wave merges:

| Sub-merge | Sub-issue | Summary |
|-----------|-----------|---------|
| sub-161 | #161 | Author ADR-007; cross-ref ADR-001/003/004/005 |
| sub-162 | #162 | Implement `EmbeddedV8RenderHost` (`deno_core` + `node:*` stubs + Web polyfills) |
| sub-163 | #163 | Wire `Swatinem/rust-cache` CI cache; document V8 first-build cost |
| sub-164 | #164 | Add `Backend::EmbeddedV8` + `Backend::Stub`; swap renderer dispatch path |
| sub-165 | #165 | Add `ContentSnapshot` e2e verification tests |
| sub-166 | #166 | Flip default `Backend` from `SpawnMiniflare` → `EmbeddedV8` in build/dev |
| sub-167 | #167 | Delete `miniflare-bootstrap.mjs`; strip `SpawnMiniflare` backend; scrub all miniflare references from code/docs/config |

Post-merge fixups: Drop impl on V8 adapter shutdown, percent-encode fix in `synthesise_specifier`, Prettier pass on V8 host JS files, lockfile regeneration, and two test corrections.

---

## 2. ADR-007 Summary

**File:** `$HOME/repos/myoss/zfb/docs/architecture/adr-007-embedded-v8.md`
**Status:** Accepted (2026-05-04) — supersedes ADR-005.

### Tauri motivation

zfb targets a Tauri-bundled desktop distribution (`.app` / `.exe` / `.AppImage`). miniflare is a Node package; Node was the only remaining runtime requirement on end-user machines for `zfb build`. Removing that dependency is a hard prerequisite for the Tauri path.

### Workerd-shape contract preservation

ADR-005's runtime-parity argument ("use workerd at build time") rests on a premise that no longer holds: the stable deployment contract is the **bundle shape** (`export default { fetch }`), not the build-time engine. Whatever engine rendered the bundle at build time is irrelevant to what workerd does at request time. The production path (Cloudflare Workers) is **unchanged** by this ADR.

### `node:*` runtime stub strategy

`deno_core` does not natively resolve `node:*` specifiers. The chosen approach is a single `op_node_compat` extension that intercepts every `node:*` specifier in the module loader and returns a stub module whose exports throw at call time. This satisfies top-level `import "node:fs"` module-graph resolution without pulling in the full `deno_node` compat layer (~150k lines). v1 coverage: `node:fs`, `node:fs/promises`, `node:path`, `node:url`, `node:buffer`. Any uncovered `node:*` specifier uses the same stub template.

### `compatibilityDate` migration

miniflare-bootstrap.mjs pinned `compatibilityDate: "2025-01-01"`. `deno_core` has no equivalent concept. Replacement: pin exact crate versions for `deno_core`, `deno_fetch`, `deno_web`, `deno_url`, `deno_console` in `Cargo.toml`. Version pins serve the same intentionality as `compatibilityDate` bumps, with the added benefit of being visible in `Cargo.toml` diffs.

### Source-map fidelity

`deno_core` surfaces JS exceptions in the same `<file>:<line>:<col>` format that `crates/zfb-render/src/sourcemap.rs` was designed around. The decoder (`decode_position`) is format-agnostic and confirmed to require no structural change. Minor frame-parser adaption (if any) is in scope of sub-162.

### Cloudflare production path unchanged

`packages/zfb-adapter-cloudflare`, `packages/zfb-runtime` (Hono router), and the bundler shape are all untouched. workerd executes the `export default { fetch }` bundle on request exactly as before.

---

## 3. `publicDir` Workaround Cross-Check (zfb#158)

**Location in consumer:** `zfb.config.ts:406` and `plugins/copy-public-plugin.mjs`

**Comment text:** "Workaround for upstream zfb gap (zudolab/zudo-doc#1394; upstream issue: https://github.com/Takazudo/zudo-front-builder/issues/158) — zfb build does not copy publicDir to outDir; remove once upstream ships and pin is bumped."

**Verification command:**

```
cd $HOME/repos/myoss/zfb && gh issue view 158 --json state,closedAt
```

**Result:** `{"closedAt":null,"state":"OPEN"}`

**Conclusion:** zfb#158 is still OPEN. The `copy-public-plugin.mjs` workaround and its `zfb.config.ts` entry must be retained in this pin bump. No W2 spec change needed for this item.

---

## 4. Consumer-Side Audit

**Grep command:**

```bash
grep -rn 'SpawnMiniflare|miniflare|workerd|Backend::|mini_flare' \
  zfb.config.ts plugins/ packages/ pages/ src/
```

**Findings:**

```
src/content/docs-ja/concepts/routing-conventions.mdx:17:
  zfbの`paths()`はビルド時に**miniflare**内で実行され、...

src/content/docs-ja/concepts/routing-conventions.mdx:193:
  | **ランタイム** | Node.js | miniflare |

src/content/docs/concepts/routing-conventions.mdx:17:
  zfb's `paths()` runs inside **miniflare** at build time and is **synchronous** by contract.

src/content/docs/concepts/routing-conventions.mdx:201:
  | **Runtime** | Node.js | miniflare |
```

**Assessment:** The two `miniflare` occurrences are in **doc content prose** (`src/content/docs/` and `src/content/docs-ja/`), not in any build-system, plugin, or runtime code. They describe historical context in the routing-conventions doc page. No code changes are required for the pin bump; however, once this ADR ships, those doc pages should be updated in a follow-on wave (post-W2) to say "embedded V8 / deno_core" instead of "miniflare." No `Backend::`, `SpawnMiniflare`, or `workerd` references appear anywhere in the consumer codebase.

**The doc-history `node:child_process.spawn`** (in `packages/doc-history-server/`) is confirmed unrelated — it is a server-side Node.js tool, not part of the zfb SSG render path.

**Verdict: No code changes required for the pin bump.**

---

## 5. Drafted New `zfb.config.ts` Long-Pin Comment Block

Replace the existing block (lines 1–180) with the following after bumping to `e550167`. Keep every existing bullet in the `includes fixes:` list intact and append the new entries below them:

```
/**
 * zfb pin (canonical, shared with E2/E4):
 *   commit: e550167 (Takazudo/zudo-front-builder main, post-merge of PR #168
 *           — [Embed V8] Replace miniflare subprocess with embedded deno_core
 *           build-time JS host; on top of PR #157 basic-blog end-to-end fix;
 *           2026-05-04)
 *   includes fixes:
 *     [carry all existing bullet entries from the 88cec07 block verbatim]
 *     - Takazudo/zudo-front-builder PR #157 (fix examples/basic-blog build
 *                               end-to-end — 6 bugs fixed; no consumer API
 *                               change)
 *     - Takazudo/zudo-front-builder PR #168 / sub-161 (ADR-007: author
 *                               embedded deno_core ADR, superseding ADR-005
 *                               miniflare subprocess)
 *     - Takazudo/zudo-front-builder PR #168 / sub-162 (implement
 *                               EmbeddedV8RenderHost: deno_core + node:*
 *                               runtime stubs + deno_fetch/web/url/console
 *                               Web API extensions)
 *     - Takazudo/zudo-front-builder PR #168 / sub-163 (CI: wire
 *                               Swatinem/rust-cache@v2; document 15-30 min
 *                               V8 first-build cost in CONTRIBUTING.md)
 *     - Takazudo/zudo-front-builder PR #168 / sub-164 (renderer: add
 *                               Backend::EmbeddedV8 + Backend::Stub,
 *                               WorkerDispatch enum; swap dispatch path)
 *     - Takazudo/zudo-front-builder PR #168 / sub-165 (test: ContentSnapshot
 *                               e2e verification tests)
 *     - Takazudo/zudo-front-builder PR #168 / sub-166 (cli: flip default
 *                               Backend from SpawnMiniflare → EmbeddedV8
 *                               in build/dev pipelines)
 *     - Takazudo/zudo-front-builder PR #168 / sub-167 (cleanup: delete
 *                               miniflare-bootstrap.mjs, strip
 *                               SpawnMiniflare backend, scrub all miniflare
 *                               references from code/docs/config)
 *   pinned by: epic zudolab/zudo-doc#1353 (super-epic #1333) → ... (previous
 *              chain verbatim) → bumped by epic zudolab/zudo-doc#1407
 *              (zfb-pin-bump-embed-v8: pick up PR #168 embedded deno_core)
 */
```

Note: the full existing entry list (lines 8–179 of the current block) must be preserved verbatim before appending the new entries.

---

## 6. Other "Remove Once Upstream Ships" Comments

Two additional workaround sites found:

### A. `src/styles/global.css` — default-theme reset (zfb#159)

- **Location:** `src/styles/global.css:83` — `--color-*: initial;` wildcard reset in `@theme`
- **Comment summary:** zfb prepends `@import "tailwindcss"` (full bundle) unless the user CSS contains a literal `@import "tailwindcss"` line at column 0. The split-import pattern used here (`@import "tailwindcss/preflight"` + `@import "tailwindcss/utilities"`) does not match upstream's `user_has_import` check (`crates/zfb-css/src/engine.rs:234`), so the full default color palette leaks. The `--color-*: initial` wildcard removes the leak.
- **Upstream issue:** `Takazudo/zudo-front-builder#159` — still OPEN (confirmed via `gh issue view 159 --json state,closedAt` → `{"closedAt":null,"state":"OPEN","title":"..."}`)
- **Also referenced:** `src/CLAUDE.md:99`
- **Action when fixed:** Remove `--color-*: initial;` line and the surrounding comment block. See Sub-5 of zfb-migration-parity epic for the removal task.

### B. `zfb.config.ts:406` / `plugins/copy-public-plugin.mjs` — publicDir copy (zfb#158)

Covered in section 3 above. State: OPEN. Workaround stays.

---

## Summary

| Item | Status |
|------|--------|
| zfb#158 (publicDir copy) | OPEN — workaround retained |
| zfb#159 (default-theme leak) | OPEN — workaround retained |
| Consumer code changes for embed-v8 | None required |
| Doc prose updates (routing-conventions.mdx) | Deferred post-W2 |
| New pin comment block | Drafted (section 5) |
