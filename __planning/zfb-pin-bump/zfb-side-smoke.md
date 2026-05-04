# zfb-side smoke results — Wave 1B

**Date**: 2026-05-04  
**Epic**: zfb-pin-bump-embed-v8 (#1407)  
**zfb commit tested**: `0549132` (Merge PR #170 — fix/dev-cold-start-rebuild)  
**zfb binary**: `target/release/zfb` built 2026-05-05 00:09

---

## Smoke 1 — `zfb build` (basic-blog)

**Status: PASS**

`zfb build` in `examples/basic-blog/` with the current release binary produces 14 HTML pages:

```
dist/index.html
dist/blog/page/1/index.html
dist/blog/page/2/index.html
dist/blog/hello-zfb/index.html
dist/blog/why-rust-cli/index.html
dist/blog/ssr-and-islands/index.html
dist/blog/deploying-static-sites/index.html
dist/blog/dev-loop-feel/index.html
dist/tags/intro/index.html
dist/tags/framework/index.html
dist/tags/ssr/index.html
dist/tags/deploy/index.html
dist/tags/perf/index.html
dist/tags/tooling/index.html
```

All pages include correct `<script type="module">` island hydration and `<link rel="stylesheet">` asset references. No build errors.

---

## Smoke 2 — `zfb dev` hot-reload

**Status: PASS (mechanism verified)**

Two architectural bugs were found and fixed in PR #170 (merged to `Takazudo/zudo-front-builder`):

### Bug A — Cold-start rebuild: empty dirty set

**Root cause**: `DependencyGraph` is seeded with page nodes but has no reverse dep edges on startup. When a content file changed, `graph.dirty_pages(&path)` returned an empty set, so the orchestrator planned zero pages.

**Fix in `crates/zfb/src/commands/dev.rs`**: After startup, all page IDs are inserted into the graph as seed nodes:

```rust
for page_id in session.page_ids() {
    g.upsert(PageDeps::new(page_id, vec![]));
}
```

**Fix in `crates/zfb-build/src/orchestrator.rs`**: Empty dirty sets now escalate to `PageSelection::All`:

```rust
let effective = if dirty.is_empty() {
    PageSelection::All
} else {
    dirty
};
```

### Bug B — PageCache miss returns 500

**Root cause**: `serve_page()` in `zfb-server` only checked the in-memory `PageCache`. On cold start the cache was empty, returning 500 instead of reading from `dist/`.

**Fix in `crates/zfb-server/src/routes.rs`**: Added `dist_root: PathBuf` to `AppState` and a `read_from_dist()` disk fallback in `serve_page()`. Cache miss now falls back to reading the pre-built file from `dist/`.

### Verification

Debug prints confirmed the full path:

1. `inotify` watcher fires for file changes (confirmed via `/proc/PID/fdinfo`)
2. Orchestrator receives the event and calls `tick()`
3. `tick()` rebuilds the affected pages (`pages_rendered=1`)
4. `DevAssetPipeline.last_bytes` cache skips atomic write when bytes are identical (correct behavior — not a bug)
5. Disk fallback serves the correct HTML via HTTP 200

A `touch`-only change does not update the dist mtime — this is intentional: the `last_bytes` cache in `crates/zfb-build/src/pipeline/dev.rs` skips `atomic_write` when rendered bytes are identical. An actual content change (e.g., adding text) causes differing bytes and triggers the write.

---

## Smoke 3 — Islands hydration output

**Status: PASS**

`dist/assets/` contains:

- `islands.js` (entry)
- `islands-93961d8a.js` (fingerprinted build)
- `styles-21be108d.css`

Every HTML page includes `<script type="module" src="/assets/islands-93961d8a.js">`. Island hydration targets are present as `data-zfb-island="ThemeToggle"` markers.

---

## W1D — smoke-search flake patch

**Status: PASS (committed)**

Commit `ae653b4`: `test(e2e): use domcontentloaded for smoke-search to avoid load-event flake`

All 8 `page.goto(DOCS_PAGE, { waitUntil: "load" })` calls in `e2e/smoke-search.spec.ts` changed to `waitUntil: "domcontentloaded"`. Root cause of flakiness: the `load` event waits for all subresources including lazy-loaded scripts/workers; `domcontentloaded` fires once the HTML is parsed, before network-dependent resources settle. The smoke-search assertions only inspect DOM elements, not network state, so `domcontentloaded` is the correct signal.

---

## PR #170 — Merge record

- **Branch**: `Takazudo/zudo-front-builder` → `fix/dev-cold-start-rebuild`
- **Status**: Merged 2026-05-04
- **CI**: All 3 checks passed (Build docs site, health, Deploy PR preview)
- **Commits**: 1 commit (`fix(dev): cold-start rebuild + server page-cache miss`)
