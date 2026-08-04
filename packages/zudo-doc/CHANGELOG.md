# Changelog

All notable changes to `@takazudo/zudo-doc` are documented in this file.

The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.

## [5.1.1] - 2026-08-05

### Other Changes

- Adopt the `^5.1.0` floor for the `@takazudo/zudo-doc-history-server` peer dependency, now that 5.1.0 is published. This floor lags a release by design: the showcase resolves the peer from the npm registry under `--frozen-lockfile`, so it can only ever name an already-published version — pointing it at an in-flight release would make the lockfile unresolvable and deadlock both CI and the publish workflows. It is therefore adopted after the fact rather than during the release (d53bd11)
- Retire the `l-bump-deps` maintainer skill and fold what it knew into `RELEASE.md`. It carried a hand-written six-entry pin map that had drifted from the code: it still described zfb as "stable 1.x" (the project is on 2.1.0), and two of the six locations it listed now derive their expected versions from the root `package.json` rather than hardcoding them, so they needed no manual edit at all. `check:pin-parity` already enforces every pin location authoritatively, so the runbook now describes the cycle as "bump, then run the check and fix what it names" — a form that cannot rot the same way (a1d8c96)

## [5.1.0] - 2026-08-05

### Features

- The code-block **wrap lines** toggle is now remembered. It previously lived only in a DOM class, so it was lost on every browser reload — awkward in the doc-writing loop (`pnpm dev` → edit MDX → reload → wrap is off again). Wrap is now a **page-wide** preference persisted in `sessionStorage` under `zudo-doc-code-wrap`, restored on initial load and after SPA navigation. Two consequences worth knowing: toggling any wrap button now wraps **every** code block on the page rather than just that one, and the choice is scoped to the browser-tab session rather than kept forever. Per-block persistence was rejected deliberately — every candidate key (block index, code content hash) is invalidated by editing the document, which is the exact flow the feature exists for (ae0b1db, #3270)

### Bug Fixes

- The wrap toggle no longer appears on code blocks that comfortably fit. Wrapping removes the very overflow that decides whether the button is offered, so the previous "keep visible while active" rule would have revealed a toggle on every short block once the page-wide preference was switched on. The unwrapped measurement is now cached on the element and reused while wrapping is active (ae0b1db)
- A code block inside a closed `` panel no longer loses its wrap toggle permanently. Such a `<pre>` is `hidden`, so it has no layout box and measures `0/0` when the enhancer first sees it; caching that as "does not overflow" froze the block, because the wrap guard then stopped it ever re-measuring. On a page whose only overflowing block lives in a tab, that left no way to turn wrapping back off. A zero-size reading is now treated as *unknown* rather than *fits*, and the stored preference is deferred until the block has been measured while visible — the `ResizeObserver` applies it on the frame the panel gains a layout box, which is before paint, so the wrap still lands without a flash (912ee02)

### Other Changes

- Real-DOM regression coverage for the wrap preference: a new unit suite executes the actual enhancer init script under happy-dom (default-off, restore-on-load, page-wide sync, persistence of both states, the fitting-block and tab-panel visibility rules, observer settling, and graceful degradation when storage access throws), plus three Playwright specs covering reload persistence, a tab opened after wrap was restored, and a block that never overflows (912ee02, ae0b1db)

## [5.0.1] - 2026-08-04

### Bug Fixes

- `setup-doc-skill.sh` no longer skips a tracked skill whose global symlink is already correct. The idempotency check compared the literal string stored in the existing symlink against a target built from `MAIN_PROJECT_DIR`, which is derived from `git worktree list` and is therefore always the **physical** path. When the project or any parent directory sits behind a symlink — a symlinked `$HOME`, a symlinked checkout, or macOS's `$TMPDIR` (`/var` → `/private/var`) — the two forms name the same directory but differ as strings, so the script mis-read its own correct link as foreign and printed a spurious `already links to ...` warning instead of no-opping. It now compares where the link actually lands, via a portable `physical_dir` helper (`cd` + `pwd -P`, since stock macOS ships no `realpath(1)` and BSD `readlink` has no `-f`). The dangling-symlink replacement path and the D4 safe-link policy are unchanged — nothing the script does not own is ever claimed or deleted (b6a226c, 76a39c0)
- Harden that same helper against unresolvable directories: it now falls back to its raw input on any resolution failure. An unreadable directory made `cd` fail and the subshell yield an empty string, so two different unreadable paths both collapsed to `""` and compared equal, which would have silently skipped a link that should have been created. `cd`'s permission-denied output is suppressed (76a39c0)

### Other Changes

- Add a regression test that reaches the skill directory through a deliberate symlinked alias, so the defect above reproduces on Linux as well. The original bug was invisible to CI because only macOS symlinks `$TMPDIR`; the test was verified to fail against the pre-fix script (b6a226c)

## [5.0.0] - 2026-08-04

### Breaking Changes

- The `@takazudo/zfb` family peer range moves from `^1.1.0` to `^2.1.0`. Consumers must upgrade `@takazudo/zfb`, `@takazudo/zfb-md-wasm`, and `@takazudo/zfb-runtime` in lockstep; `@takazudo/design-token-lint` also moves from 1.x to 2.x (d23e47a8, fb91919f)
- The `githubAutolinks` feature and its `githubAutolinksRepo` setting are removed. A project still passing `githubAutolinksRepo` now fails at runtime with an explicit rejection rather than silently ignoring it, and the config shim likewise rejects zfb 2.0.0's removed `githubAutolinks` key (3d4a8ca7, 4c03befc, 255676da)
- `strictContentBridge` is enabled by default in this repo's config and re-points the b4push/CI wiring — a content-bridge fallback now fails a plain `pnpm build` instead of only tripping the allowlist-gated b4push step (#3234, d3035f68)
- The shared base `tsconfig` flips its JSX mode to `react-jsx` with `jsxImportSource: preact`, and `@types/react` is dropped from the scaffolded devDependencies. Projects that relied on the React typings being present must add them back explicitly (#3182, 705c3957, be91c050)

### Features

- Desktop TOC visibility toggle — a new `tocToggle` setting adds a prepaint-backed show/hide control for the desktop table of contents, wired through the generator, the showcase, and the sidebar fixture, with e2e coverage. The claim is scoped to default-TOC pages (c5a26102, 3f851196, ed1f6887, 304ce68d, 409b0bfe, 5301b011)
- New `entryDocSlug` and `headerNav` versioned config fields, letting a versioned site name its entry document and carry version context through header navigation (#3217, 0d42ffbd, e56c4dee)
- Version switcher now recomputes its disabled state across SPA navigation — each page emits an unavailable-version payload into the swapped content and the switcher rewires on `after-swap` (faa0e8aa, d2a3fccf)
- GFM task lists and footnotes are now enabled as a preset default (31c1f253)
- `strictContentBridge` added as a shell passthrough field so downstream projects can opt into the strict content bridge from their own config (725febec, c1432ffa)
- Theme packs gain a catalog-wide `(pointer: coarse)` scroll fallback for fixed-attachment layers, and the pack validator now accepts top-level `@media`-wrapped pack-scoped rules (ee973b27, 594b0486)
- `create-zudo-doc` ships a default `public/` favicon set in the base template, with an SVG favicon link emitted ahead of the `.ico`/`.png` entries (a9d100bc, 19d11f8d)
- The safelist checker gains a `safelist-ok` marker escape hatch plus honest remediation text (150925a4)

### Bug Fixes

- Restore desktop TOC sticky scroll-follow, with an e2e regression guard (ab25912a, ac7d3fc0)
- Version availability is now computed from real route generation rather than an approximation, and `unavailableVersions` is computed for both version switchers (01409a94, a820304b)
- An absent version-availability payload now leaves the disabled state untouched instead of clearing it, and the switcher rewire is deferred to `DOMContentLoaded` (6593e0c0, d5d6b586)
- Thread `currentVersion` into the `CategoryNav` / `CategoryTreeNav` / `SiteTreeNav` wrappers so versioned sites link correctly from nav cards (ddeaa6da)
- `entryDocSlug` is optional and locale-aware in the versions page (20890f21)
- The zfb config shim re-exports `zfb/config` instead of hand-copying its shape, and shim-shape validation is now AST-based rather than substring matching, closing three false-negative paths (#3239, #3241, 213f4e5a, ea109c66, 70ad667c)
- Restore public API back-compat on the versioning deps/node shapes (416baef2)
- `claude-resources` excludes build directories by basename at any depth rather than only at the top level (6e830dc4)
- Long delimiter-free inline code identifiers now wrap instead of overflowing (62679947)
- Rename the TOC island helpers to avoid an island marker-name collision (7c29a6ca)
- Resolve package-only dependencies in the packed-tarball slow fixtures (df23d982)

### Other Changes

- Academia theme pack readability pass: low-opacity rest-state link underline and 0.9rem code blocks (8dbb8f46)
- Restructure the `CLAUDE.md` hierarchy and fix seven accuracy defects surfaced by the refactor self-review (#3167, fd2124ba, ed8917a4)
- Repository cleanup — remove six unused dependencies and two dead files, delete host-side source superseded by package-owned equivalents, drop finished-epic scratch/report directories, and correct stale references in the README, config, and b4push skill (332c8406, 6d2f90dd, a40bc5fd, c035c76d, 7869d45b)
- Record the Tauri Mode 1 CSP verification result and put the icon prerequisite before the build command in the Tauri docs (4a45c00f, 532eb81e, 8a93286e)
- Test coverage: dogfood snapshot plus e2e fixture/spec coverage for the version-link family, an SPA-navigation guard for the version-switcher disabled state, a wider A2 fixture covering headings/task lists/footnotes/directives, and the locked favicon set mirrored in the target manifest fixture (#3219, #3245, 1a73989b, fab8568d, 0310c8fb, 94e09ceb)
- Documentation corrections for the content-fallback guard wiring, the e2e fixture-setup fast path, and the safelist-ok example (9047c389, 2bb9a1e1, 70d69842, 66ad3101, 100761b3)

## [4.5.0] - 2026-08-02

### Features

- `setup-doc-skill.sh` now links a site's own tracked skills into the global skills directory — after generating the doc-lookup skill it discovers every `.<target>/skills/*` directory containing a `SKILL.md` and symlinks it too, resolving sources through `MAIN_PROJECT_DIR` so the links survive worktree removal. Linking is non-destructive: it no-ops when already correct, replaces a dangling symlink, and warns and skips a real file, directory, or a symlink owned by something else. Pass `--no-link-tracked-skills` to opt out (#3156, c8d9b44)

### Bug Fixes

- Stop doubling the `-wisdom` suffix when deriving the doc skill name — a project already named `*-wisdom` (or exactly `wisdom`) now derives its skill name verbatim instead of producing e.g. `zudo-test-wisdom-wisdom`. When the corrected rule shortens the name, the script prints a migration warning naming both directories, the `.gitignore` update, and the cleanup commands; it never deletes anything automatically (#3154, 7edc219)
- Align `create-zudo-doc`'s `.gitignore` emission with the same suffix-aware rule, so a `-wisdom`-suffixed project no longer gets a doubled ignore entry that matches nothing (#3155, a5ccb5f)
- Widen the migration warning's trigger — it previously fired only when a legacy doubled-name directory was on disk, silently missing a project whose `.gitignore` still named the doubled skill but whose legacy directory was never generated. It now also detects stale ignore rules and a leftover global symlink, fires on any of the three symptoms, and prints only the steps that apply (dbbcb99)
- Treat only an actual symlink as the stale global link — a real file or directory at that path is no longer labelled a stale symlink, and no longer draws an `rm -f` suggestion against a user-owned path (7671374)

### Other Changes

- Pass `--no-link-tracked-skills` on this repo's own `setup:doc-skill*` scripts, since the monorepo's skill directories would otherwise leak into the maintainer's global skills directory. Generated projects deliberately keep auto-linking on (#3157, 7b93206)
- Add a cross-artifact skill-name-parity regression test that scaffolds a project, runs its `setup-doc-skill.sh`, and asserts the directory the bash-side derivation creates matches the `.gitignore` entries the TypeScript-side `deriveDocSkillName()` emits — closing the gap where the two hand-mirrored derivations could drift undetected (#3158, 533769b)
- Strip an inherited `SKILL_NAME` from the setup-doc-skill test environment, so a developer or CI shell export can no longer rename the directory the assertions look for (d89e7e6)
- Re-baseline the route-injection parity hashes (#3140, 5be6685)
- Adopt zfb v1.0.0 stable across every pin site, then bump the zfb family to 1.1.0 (0034871, cab6636)
- Retarget the `l-bump-deps` skill at the stable zfb 1.x line (f60d5d6)

## [4.4.13] - 2026-07-30

### Bug Fixes

- Kill the flash of the default look on soft navigation with theme packs — the matching pack stylesheet link is now injected into the incoming document before zfb's SPA head swap, so the already-loaded link persists instead of being removed and refetched (da3c9d9)

### Other Changes

- Lock in theme-pack link non-removal across SPA navigation and history traversal with e2e coverage (a6dbcfd, 1cee0df, 8615097)
- Bump the zfb family to 0.1.0-next.99 (d48d2e1)

## [4.4.12] - 2026-07-30

### Bug Fixes

- Restore EN `/docs/reference/design-token-panel` rendering — the page shipped its whole body as a single `<pre data-zfb-content-fallback>` blob due to a byte-offset-sensitive upstream zfb bundler bug, worked around with an exact-equivalent rewording (c3d9c78)
- Re-inject the mermaid enlarge button after a theme re-render (5b9a655)
- Close the bare same-page fragment guard hole in the link checker (ab2fea6)

### Other Changes

- New `check:content-fallback` build gate: fail the build when any built page ships a content-fallback blob, wired into b4push and the build-site jobs of all three CI workflows (a0e4361, 945c392)
- Record Takazudo/zudo-front-builder#2186 as the content-fallback guard's upstream tracking issue and retirement condition (6cee4ca)
- Bump the zfb family to 0.1.0-next.98 and add routes-src exports (8143de0)

## [4.4.11] - 2026-07-28

A maintenance release: CI post-deploy gate reliability, the `packages/zudo-doc` dev loop, and documentation. The published package artifacts are unchanged — the build path still cleans exactly as before.

### Bug Fixes

- Keep `packages/zudo-doc` declarations alive during dev. `tsup --watch` ran with `clean: true` and `dts: false`, so a dev session wiped `dist/` and regenerated no `.d.ts` at all (285 → 0). `dev` now pairs `tsup --watch` with a `tsc --watch` declarations pass, and only non-watch builds clean (a705fca1f, #3126)
- Widen the post-deploy smoke-gate retry window so slow asset propagation no longer turns a green deploy red, and split the CSS-shape action's HTML fetch from its link grep so a failure names the URL that died instead of surfacing a bare curl exit code (960ff3e3f, #3123)
- Give the six post-deploy gate steps a failure branch naming the URL and curl's exit status. Under `set -euo pipefail` a persistent 404 aborted at the assignment, so the `::error::` annotation was unreachable — the exact diagnosability gap the gate was meant to close. Gate-carrying jobs raised to `timeout-minutes: 15` so a job timeout cannot pre-empt the annotation (5f2266eaf, #3124)

### Other Changes

- Document the `run-p` dev-session cascade as accepted behaviour. One watcher exiting non-zero tears down all of `pnpm dev`, because `run-p` aborts its siblings and the zudo-doc watchers are themselves a nested `run-p`. Records the trigger set (including that `tsup --watch` exits on a failed *first* build while `tsc --watch` does not), the `EMFILE` vs `ENOSPC` inotify limit distinction, and why `--continue-on-error` is the wrong remedy (b9d7d5a29, 23f0deac1, #3129)

## [4.4.10] - 2026-07-28

### Bug Fixes

- Widen the sidebar resizer hit area so the handle straddles the scrollbar instead of hiding behind it (d68656b38, #3117)
- Report the sidebar's rendered width in `aria-valuenow` instead of the unresolved `--zd-sidebar-w` custom property, which reported the minimum width until the first interaction (c8393179e, #3120)
- Compensate for the pointer grab offset when dragging the sidebar resizer, so the edge no longer snaps to the cursor on the first pointer move (c8393179e, #3121)
- Replace inert numeric spacing utilities with arbitrary values (f0b50a987)
- Narrow the regex captures in the resizer geometry parity test so it type-checks under `noUncheckedIndexedAccess` (e3a6c608e)

### Other Changes

- Add e2e regressions covering the theme card width clamp and the resizer straddle geometry (3f09ff5b6)
- Tighten the narrow-viewport clamp tolerance so the test can actually fail on a regression (d5f0888b0)

## [4.4.9] - 2026-07-27

### Bug Fixes

- Fixed a build failure that made every `docHistory: false` project unbuildable with `Could not resolve "@takazudo/zudo-doc-history-server/exclude"`. The chrome graph's `doc-history-area` imported that subpath at module top level, and because the chrome graph is always bundled, esbuild had to resolve it on every build — even though `@takazudo/zudo-doc-history-server` is an *optional* peer that a doc-history-off project never installs. A regression introduced in 4.3.0 by the exclude-filtering work. The canonical matcher now lives inside `@takazudo/zudo-doc` and both consumers import it relatively; `doc-history-server` keeps its own copy and its published `./exclude` export (it is a standalone dependency-free Node server/CLI and cannot depend back on the framework package), with a source-identity parity test pinning the two copies together (5dc2a2bec)
- Restored `@takazudo/zudo-doc-history-server` to the `docHistory` feature block in the generated scaffold's `package.json`. It had been promoted to an unconditional base dependency purely to work around the resolution bug above; with that root cause fixed, a doc-history-off scaffold no longer needs the package at all. The scaffold test now asserts docHistory-OFF ⇒ absent so the workaround cannot silently creep back (5d5d0ad1a)
- Widened the release script's pin-rewrite regex to accept both pin spellings (bracket-assignment and object-literal-key). It previously matched only the colon form, so moving the pin into a conditional block would have failed the following release with `could not locate ... pin` (5d5d0ad1a)

### Other Changes

- Added an optional-peer reachability guard that walks the real injected doc routes and reports any optional peer reachable from the always-bundled graph. This bug class has now shipped three times and nothing else catches it — unit tests import from source, and this repo's own build installs every optional peer. The guard also resolves package self-imports back to source through the exports map rather than treating them as external, so the walk crosses the `@takazudo/zudo-doc/*` boundary instead of stopping at it (5dc2a2bec, cd6bd9516)
- Made cold checkouts self-healing. A tree installed with `pnpm install --ignore-scripts` has no `dist/` for the workspace packages, so `zfb` could not even load `zfb.config.ts` (it imports `@takazudo/zudo-doc/config`, which resolves through `dist/config.js`) and `check` / `build` / `check:pages` / `test:packages` all failed before a single line was edited. A new `ensure:workspace-build` prerequisite now runs ahead of those commands and as a `b4push` preflight, building the two workspace packages in their mandatory order (c63615d90)
- Made that build guard check every literal `./dist/**` target declared in each package's `exports` map instead of a single sentinel file. A `tsc` declaration pass killed partway leaves some `.d.ts` written and others missing — a state the sentinel pair accepted, so the next command failed on a missing subpath instead of self-healing. Deriving completeness from the manifest keeps the check correct as exports change and leaves no hand-maintained list to drift (833b9110e)

## [4.4.8] - 2026-07-27

### Bug Fixes

- Corrected the color roles of the generated hero logo (`AutoLogo`, rendered when `logo: "auto"` — the default for every fresh scaffold), which were inverted relative to the intended design. In dark mode the tile rendered a foreground-filled interior with a dark center disc and a light glyph; it now renders a page-background interior with thin light frame lines, light corner rays, a light disc, and the glyph knocked out of that disc. Light mode is the exact inverse. Both roles are theme-driven tokens, so the fix applies to every color scheme and theme pack at once (31535b6f8)
- Fixed the same inversion in the SVG produced by `zudo-doc eject logo`, which serializes the identical shape data through a luminance mask and so baked the wrong silhouette into the ejected asset. Note that the ejected variant's tile interior is transparent where the live component paints an opaque page background — an inherent limitation of the one-color CSS-mask path, and visually identical over a flat page background (31535b6f8)

## [4.4.7] - 2026-07-27

### Bug Fixes

- Corrected the admonition-title syntax documented in the generated project's `CLAUDE.md`: it now shows the supported bracketed form (`:::note[Custom Title]`) and explicitly names the Docusaurus-style `{title="..."}` attribute as unsupported. The attribute form either fails the build with `ReferenceError: title is not defined` or silently drops the title, and the runtime error never points back at the directive that caused it (a1dfc8460)

## [4.4.6] - 2026-07-25

### Other Changes

- Bumped the zfb family (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`, `@takazudo/zfb-md-wasm`) to `0.1.0-next.96`, including the generator's scaffold pins and the zfb-md-wasm release-contract test version; the `?url` resource-import shape introduced in next.94 is unchanged (a63735de3)
- Adopted the published `4.4.5` lockstep floor for the `@takazudo/zudo-doc-history-server` peer and the target-manifest test fixture's `@takazudo/zudo-doc` pin (a63735de3)

## [4.4.5] - 2026-07-25

### Bug Fixes

- `create-zudo-doc` now scaffolds `@takazudo/zudo-doc-history-server` as an unconditional dependency, so a generated project installs cleanly regardless of which features were selected (7ace05fdb, ed8d16f0c)
- Gated the content-band flex gap to the `xl` breakpoint so mobile content spacing is symmetric; the fix is scoped to the default TOC wrapper and leaves the band gap unconditional elsewhere (f4a316d79, be9174a1f)

### Documentation

- Added an SEO/OGP + sitemap guide and a matching `seo` tag (ae249ab51)
- Reframed markdown-feature config documentation around the `zudoDoc()` preset instead of hand-wired plugin config, across `admonitions-preset`, `ruby`, `github-autolinks`, `link-validation`, `toc-export`, and the group-B pages (bd4583827, c03f0f615, 537237797)
- Rewrote the external-links page around the real `markdown.externalLinks` config (3efde3f8f)
- Corrected engine-contract accuracy for code-enrichment, code-title, and transclude — `wordHighlight`, title-bar dedup (code-title is core), and dropped the wikilink claim (ac8d3bc21)
- Fixed accuracy drift on `heading-links`, `cjk-friendly`, `image-dimensions`, and `reading-time` (d19bed14a)
- Reconciled the markdown-features index table with the Wave-1 outcomes (1b1a2d7af)
- Fixed guide accuracy drift across `configuration`, `footer`, `custom-components`, `i18n`, and `tags` (a295c0c93)
- Removed the stale MSW mock section and fixed file references in the AI assistant guide; dropped the dead `PUBLIC_ENABLE_MOCKS` env-var row from the ai-assistant-api reference (9a0368a93, 94000db09)
- Fixed component docs: admonition count, `maxDepth` claim, `sidebar_position` collision, and SiteTreeNav's MDX availability, stale example, and missing prop (c1d5664f0, ac0fab3f3)
- Documented that header search is array-configurable, corrected search-engine naming, and de-staled the preset-generator heading and getting-started page (f34db2ef7, 91f86b293)
- Corrected the b4push step count and a `paths()` overclaim in the develop docs, including the link-checker's 23 steps and allowlist (278d96c47, 58ca16de8)
- Added reciprocal See-also links between the image-enlarge and mermaid page pairs (1f55b165f)

## [4.4.4] - 2026-07-23

### Other Changes

- Bumped the zfb family (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`, `@takazudo/zfb-md-wasm`) to `0.1.0-next.94`, including the generator's scaffold pins and the zfb-md-wasm release-contract test for next.94's `?url` resource-import shape (52c7f50f9, 46d854315)

## [4.4.3] - 2026-07-23

### Other Changes

- Bumped the zfb family (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`, `@takazudo/zfb-md-wasm`) to `0.1.0-next.92` and first-party floors to `^4.4.2` (edcd4ab2f)

## [4.4.2] - 2026-07-22

### Other Changes

- Bumped the zfb family (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`, `@takazudo/zfb-md-wasm`) to `0.1.0-next.91` and first-party floors to `^4.4.1` (b9ef3f357)

## [4.4.1] - 2026-07-22

### Bug Fixes

- create-zudo-doc: removed the unused `@takazudo/zfb-adapter-cloudflare` dependency from the generated scaffold — fresh projects no longer install an adapter they never reference (eabda6fc2)

### Other Changes

- Bumped first-party `^4.0.0` dependency floors to `^4.4.0`: the `@takazudo/zudo-doc-history-server` peer floor in `@takazudo/zudo-doc`, and the target-manifest test fixture's `@takazudo/zudo-doc` pin (84d592cea)

## [4.4.0] - 2026-07-22

### Features

- Theme Batch 5 adds 10 new theme packs — academia, bauhaus, blueprint, botanica, eink, riso, sakura, scandi, tidepool, and timberline — bringing the catalog to 31 packs, each with full admonition/code/sidebar coverage and a rendered WCAG contrast audit (29bb3497f, 12665cdf1)
- A new `logo` setting renders a generated "auto" home-hero logo by default, alongside a `zudo-doc eject logo` CLI subcommand for taking full ownership of the logo markup (a2ba5188a, 3cedbee04)
- `scripts/theme-a11y-audit.ts` adds a rendered per-pack contrast audit tool, now wired into the nightly exam and documented for theme authors (4c969cd4a, 8ed913f9d)
- The top-page Tags section now renders tag chips, and the home hero gained a `heroLink` prop with an inline extras row (55be502c2, fc865e6be)
- Header, sidebar, overflow-dropdown, and doc-pager non-active nav elements now consistently turn accent color on hover/focus, with a shared class-token source of truth for the header nav (fafecc154, 274a8641f)

### Bug Fixes

- Resolved 10 rendered-a11y audit findings across 5 existing theme packs, plus follow-up contrast fixes for blueprint/sakura/tidepool and five additional deep-review findings (b694708dc, 2c2dcc858, 12f7964f9)
- Theme-CLI config scanning now correctly decodes `\uXXXX`, `\u{...}`, and `\xXX` escapes (2e58e3dc0)
- The default title-rule border is reset only where a theme pack owns its own title styling, keeping custom pack titles from double-bordering (9043b9439)
- Doc-history anchors now point at the actual generated heading slugs (9e3e62655)

### Other Changes

- Re-baselined the route-injection parity test's normalized-HTML sha256 snapshots twice this cycle, attributing every changed byte to its originating merged PR (5e46831d4, 4fd642c3b)
- Bumped the `@takazudo/zfb` family to `0.1.0-next.90`
- Expanded English and Japanese documentation for the logo/eject-logo feature, the Theme Gallery (31 packs), and the hover-accent interactive color rule

## [4.3.0] - 2026-07-19

### Features

- Syntax highlighting is now driven by semantic design tokens across document code fences and `HtmlPreview`. Browser previews lazily load the public zfb WASM highlighter, existing color schemes inherit compatible semantic aliases, and project-owned Shiki dependencies and theme-name configuration are no longer required (178f23321)
- Home pages can opt into the wide content layout with `home.wide`; the setting applies consistently to package-owned root and localized home routes (d068ac346)
- Doc history can exclude selected pages through configuration, with matching behavior threaded through rendering, history generation, package settings, and generated-project configuration (e18c2e528)
- The Hearth theme now provides complete admonition icon coverage (736c6c5e1)

### Bug Fixes

- Frontmatter status pills now meet WCAG contrast requirements across every shipped theme pack, light/dark mode, and semantic role while preserving their tinted backgrounds (2986d87c4)
- The showcase now consumes the package-owned theme contract correctly and emits literal semantic z-index utilities (2ca79ca6b, 8fb517df6)
- Theme-pack font validation is stricter, and the generated setup skill resolves main-worktree paths reliably (f9dd94d53, 4c2a508bb)

### Other Changes

- Expanded English and Japanese documentation for syntax-token migration, wide home layouts, doc-history exclusions, theme development, and network exposure caveats
- Added browser-level highlighting coverage, exact pill contrast checks, settings parity tests, and compatibility-contract guards

## [4.2.1] - 2026-07-19

### Other Changes

- create-zudo-doc: the shipped `zudo-doc-version-bump` skill's changelog guidance is now default-language-aware — its primary/secondary subsections are framed around default-language vs. other-locale and present both EN/JA heading sets, so a `defaultLang: "ja"` scaffold whose primary changelog page seeds `## 未リリース` gets guidance that matches the page in front of the reader (9fda96a6)
- create-zudo-doc: the shipped `zudo-doc-design-system` skill gained a "Palette index convention" section under Tier 1, reconciling the frontmatter's palette-index promise with an actual body section (166daedb)
- Tests: documented the scaffold-skill guard's by-design gaps — DENYLIST is a hand-maintained path-idiom guard that complements (not duplicates) the scaffold-refs integration guard — and retitled a stale parity describe block to reflect its byte-mirror mechanism (c7015fc6)

## [4.2.0] - 2026-07-18

### Features

- HtmlPreview gains a `fullHeight` opt-in prop for full-height embeds (18246fb7)
- HtmlPreview gains `externalStyles` / `externalScripts` / `preflight` / `showResources` props for embedding and disclosing external resources (20c679ed)
- New `DOC_HISTORY_SKIP_POSTBUILD` env var skips only the postBuild dropdown JSON step, leaving the preBuild Created/Updated/Author manifest intact (9234443c)
- Scaffolds with docHistory enabled now emit a `dev:network` script for LAN access (e0c0f9f6)
- The four preset-only config fields are now mirrored onto `CreateOptions` for scaffolding parity (a97ee2d0)

### Bug Fixes

- create-zudo-doc: the doc-history-server now starts alongside zfb dev when docHistory is enabled (7efda47e)
- create-zudo-doc: disable pnpm 11's `minimumReleaseAge` gate in scaffolds, and warn about a parent workspace's gate when skipping the nested pnpm-workspace (1b3fe1a0, 27375853)
- create-zudo-doc: ship claudeSkills content from `templates/`, not the monorepo root (103082e8)
- setup-doc-skill: resolve nested-subdir symlinks, make SKILL.md commands runtime-conditional, and detect a `format:md` script name (5b4a6416, f58ab17e)
- generator: add `.zfb-build/` to the generated `.gitignore`, and sync the tauri template CSP with the showcase (474f4f1a, da2f19b3)
- Docs: corrected the metaTags fragment link to the hierarchical heading id (0728d985)
- Mermaid: drop the semicolon from stateDiagram statement repair (3390d35d)
- Tests: strip ANSI codes in eject slow-test output assertions (c2aad778)

### Other Changes

- Skills: authored scaffold variants of design-system, translate, and zudo-doc-version-bump, completing the drift-guard transition (317e3449, 167fe424)
- Tests: added the generated-scaffold skill-reference integration guard, split the skills drift guard, and exempted scaffold-variant skills from the template-drift shell guard (ef233939, cd37d1c2)
- Tests: synced the target-manifest exam fixture to the 13-file scaffold and re-baselined route-injection parity hashes (16faafd3, b1eea45b)
- Docs: documented `dev:network` and zfb flag forwarding (9dbc4f4d)

## [4.1.0] - 2026-07-18

### Features

- Theme-pack fonts now reach the app shell (header, sidebar, TOC, breadcrumb, pager) via a global body font seam, with per-surface chrome font tokens for finer control (f84b2bd2)

### Bug Fixes

- Per-surface chrome font knobs anchor to the seam token instead of relying on inheritance (dbd95365)
- Docs: corrected the false claim that mobile chrome strips theme-pack font tokens — mobile hooks receive them like desktop (3cbe0d45, 493f76dc)
- E2E: theme-pack font specs assert the body font-family directly, target the bundled foundry pack, and wait for switcher hydration (d88e4c5a, 218e8844)
- Reverted a hand-edited generated CHANGELOG.md — it is corpus-generated (ef43274c)

### Other Changes

- Toolchain: @takazudo/zfb family (zfb, zfb-runtime, zfb-adapter-cloudflare, zfb-md-wasm) adopted through 0.1.0-next.89 (02268414)
- Bilingual docs for the chrome font seam tokens and the mobile reach caveat (58cf6fc2)
- Durable e2e regression spec for the chrome font seam (69af425e)

## [4.0.0] - 2026-07-17

### Breaking Changes

- Current-only compatibility contract: legacy integration subpaths, the tag alias/deprecation runtime, legacy token storage bridges, legacy Syntect markup support, legacy doc-history contracts, and the legacy link-checker entrypoints are removed (c8b6d3da, 08338a8f, 701b4aea, 16edbe8b, e8ce8929, cc2bb792, f2c9b925)
- Heading IDs are hierarchical-only; the legacy flat-ID fallback is gone (390064ff)
- Doc entries use the current zfb entry model exclusively (df048e30)

### Features

- Theme pack system: pack registry with config census and validator, asset delivery pipeline (build, npm tarball, dev), runtime switching engine with FOUC-safe bootstrap, bottom-right switcher flyout, browse-all theme grid dialog, and a `zudo-doc theme list|apply` CLI (aab0014f, 9eddd9ba, f5f83b43, adf81c9a, 07b77eb1, a33f66ef)
- 20 official theme packs shipped across four batches — foundry, swissgrid, broadsheet, ledger, manuscript, futura-editorial, washi, sumi, matcha, hearth, hollow, fjord, nocturne, drift, onyx, phosphor, observatory, solar, beacon, brutalist — with the full 21-pack catalog (including default) synced into create-zudo-doc and the preset generator (487b1761)
- Stable DOM hooks for theme packs: `data-footer`, `data-doc-pager`, `data-doc-description`, and `data-theme-pack-switcher` / `data-switcher-card` / `data-switcher-launcher`; all 20 packs retargeted onto the hooks and every changed pack's `meta.json` version bumped for the stylesheet cache buster (c8bb4421, ac654a8a, 2b2a46d5, b5fffb01, d7c67ca7)
- Restored pack styling that previously lacked hooks: foundry's pager hover wash and broadsheet's classified-ad flyout frame (850a30fb)
- Semantic syntax-highlight class mode: document fences render `hi-*` token classes with a stable token contract, mapped by `features.css` (c1237dcd, c305fdf8, 920be3d2)
- AI chat exact daily spend cap enforced via a Durable Object, with paid-call admission control and an operations runbook (0b46e23c, 15e3b891, 491116c5)
- Chrome customization: typed primary replacement slots (`Header`, `Footer`, `Sidebar`, `Toc`, `Breadcrumb`, `DocPager`), a named header-component registry, binding-aware eject warnings, and end-to-end proof (a3ae76cc, 9d8e7901, 5346b2ef, 0e92dbc2)
- create-zudo-doc: `footerCopyright` feature defaults to on; theme-pack scaffold prompt and programmatic `themePack` option (51307cd4, acf20690, b287e94d)

### Bug Fixes

- onyx: the decorative gold outline on the switcher card and browse-all dialog no longer masks the keyboard focus-visible ring (11d5cc0f)
- ledger: DocPager selector no longer over-matches NavCardGrid on auto-index pages (eff8e1b8)
- Light-mode WCAG contrast corrections across several packs after review (46e1e6b2)

### Other Changes

- Theme pack architecture ADR, hardened Decisions 6.5/6.6 (stable-hook list, h2–h4 gradient carve-out), and a new durable `theme-pack-authoring.md` pack-author reference (4f5cc90c, ed287e1a, 4856c44b)
- Theme gallery reference docs (EN+JA) covering the full pack catalog (2b73cffa, 3068fbca)
- Scaffold customization docs overhaul: customization ladder, chrome bindings, custom components guide, route injection, color-token guidance (8a54b3df)
- Toolchain: zfb family adopted through next.87; zdtp 0.4.8 (151f09bb, efc3afdc)

## [3.3.0] - 2026-07-12

### Features

- **Minimal Scaffold (epic #2651).** `create-zudo-doc` now emits a locked ~12-file minimal manifest — a generated project is one config file (`zfb.config.ts` using the diff-from-defaults `zudoDoc({...})`) plus Markdown content, extended via eject. The package now owns the defaults that were previously copied into every scaffold: default `@theme` tokens ship as `@takazudo/zudo-doc/theme.css`, and i18n, color schemes, docs schema, z-index, frontmatter-preview, and directives ship as package-default data modules. (98a56931, 257fa9aa, 5f45bf15, 2056824f)
- Added the `zudoDoc()` single-entry config API returning a full `ZfbConfig`; the showcase and generated scaffolds migrate their `zfb.config.ts` and the four doc-route stubs to the self-contained form. (a06f5990, 1fc470f0, 6e4a6d08)
- Added the `defineChromeBindings` widening adapter — a typed helper that replaces chrome-binding casts; the generator now injects it instead of a `DocHistory` cast. (5915707b, aa29e479, 0e49a6ad)
- Absorbed the Tauri find-in-page island (Cmd/Ctrl+F find bar) into `@takazudo/zudo-doc/find-in-page`, mounted from the package's body-end islands behind a new `findInPage` setting (default `false`). The island self-gates on `window.__TAURI_INTERNALS__`, so it stays a safe no-op outside a Tauri shell. `create-zudo-doc`'s tauri feature now emits `findInPage: true` for generated Tauri scaffolds. (97885c5d, cc1bc846, f5e4c953)
- Added a package-owned `DesignTokenPanelBootstrap` island, mounted from the package's routes. (5f75a9ed, 105a3b40)
- The package now ships `tsconfig.base`, a `zfb-config` shim, and generated virtual-module types. (3de2b209)

### Bug Fixes

- Corrected the `create-zudo-doc` Node engine floor and documented the built-in MDX components (#2702, #2703). (edf5cc4f)
- Exported the `./find-in-page` subpath so hosts can mount `FindInPageInit`. (a4c4f8e5)
- Stopped the generator dropping unlisted config keys and guarded `DEFAULT_MIRROR` drift. (ac0c6afa)
- The i18n locale doc stub now threads `isFallback` and a per-locale content directory. (8355e537)
- Routed package-manager script commands through a single `pmRunCommand` helper. (cb88bde6)
- Made the `pages` typecheck project Preact-native. (a24dfef4)
- Warn on a missing color scheme, and clarified the `zudoDoc` shallow-merge docs. (8f913319)
- Tightened `frontmatterRenderers`/`buildFrontmatterPreviewEntries` slot types so drift is detected for real. (d9d9b828)
- Fixed the default header chrome background. (f0245086)

### Other Changes

- Retired `packages/md-plugins` and dropped the showcase Design Token Panel config copy in favor of the package default. (e99ebe7d, c74c481a)
- Patched transitive security advisories via pnpm overrides and bumped `@takazudo/zdtp` 0.4.5 → 0.4.6. (24013cd1, 731c8677)
- Rewrote the core structure docs for the minimal→extend model (EN + JA). (f57d092e)

## [3.2.0] - 2026-07-08

### Features

- Added the `minifyHtml` setting, preset support, generator output, and documentation so zudo-doc projects minify production HTML by default (4201484d).

### Bug Fixes

- Packaged `setup-doc-skill.sh` inside the create-zudo-doc template and copied it from the published package, so scaffolded `skillSymlinker` projects work from npm installs (9797f2d0).

### Other Changes

- Updated CI and e2e assertions for minified HTML output and hardened minification coverage (24b2a1eb, 379da331, abe41685).

## [3.1.0] - 2026-07-08

### Features

- Generate package changelog entries from the authored MDX release notes, with real-corpus coverage for the generated output. (e2b2e499, cda16169)
- Add a `"wide"` full-width content layout option for documentation pages. (4678f945)
- Add a Codex target to the doc skill symlinker. (4f019b1e)

### Bug Fixes

- Align `create-zudo-doc`'s generated zfb pins with the next-77 dependency line. (5faade5c, a28a2d32)
- Preserve code-fence syntax in the generated changelog sanitizer and mirror the related Japanese docs. (33a41543)
- Include the changelog setting in generated scaffolds. (02b2e499)

### Other Changes

- Type the real-corpus changelog test config against `ChangelogConfig`. (ed12dd40)
- Mirror the changelog setting in fixtures. (9859713d)
- Rebless route-injection parity hashes for the nightly zudo-doc slow-hash path. (4fac7851)
- Merge the concepts docs into the develop section and remove the standalone concepts category. (b70f86f8)

## [3.0.0] - 2026-07-07

This is a **major** release. The color-scheme system was rewritten from the legacy 16-slot ghostty ANSI palette to a purpose-built ramp-native model, then minimized to **base 5 / accent 3** stops with aggressive semantic-role merging, and the ~40-name preset catalog was dropped entirely in favor of a direct ramp + semantic-tweak customization story via the zdtp Design Token Panel.

### Breaking Changes

- `@takazudo/zudo-doc`: color-scheme engine rewritten onto a ramp-native model — `ColorScheme = { ramps, map }` replaces the legacy `palette[16]` / numeric `ColorRef` / `cursor` shape. `resolveColor` → `resolveRampRef`, `SEMANTIC_DEFAULTS` → `SEMANTIC_RAMP_DEFAULTS`. (47a7fb5f, ca61a9c5, #2585, #2586)
- Design-token JSON export/import serde rewritten to the ramp-native shape; a persisted legacy payload has its color slice reset (not remapped) to the default scheme. (364d626f, #2591)
- Palette minimized from base 12 / accent 7 to **base 5 / accent 3** (state unchanged at 4), with semantic roles aggressively merged onto shared stops (`surface`, `codeBg` (light), `chatAssistantBg`, `imageOverlayBg` → `bg`). Both `Default Light` / `Default Dark` re-authored and re-gated to WCAG threshold+0.1. (04c64685, #2601, #2602)
- The ~40-name legacy scheme preset catalog (Dracula, Nord, Catppuccin, …) is removed entirely — `create-zudo-doc` now scaffolds only `Default Light` / `Default Dark`. The CLI flag surface (`--color-scheme-mode`, `--scheme`, `--light-scheme`, `--dark-scheme`) survives with a 2-value validation set. (b71d702b, #2619, #2620)
- Design-token JSON schema bumped `v2` → `v3`: a `v2`-labeled export (pre-5/3-minimize) now resets its color slice to the default scheme on import instead of crashing — the schema label alone triggers the reset, since an out-of-range ramp ref can't otherwise be distinguished from an intentionally-tolerated one. (#2599)

### Features

- zdtp Design Token Panel: new **Palette** (curve-editor) tab for live ramp editing, and a mode-scoped semantic Color tab reflecting the ramp-native `RampRef` model. (cf534f27, 97916fc5, 9d487b4c, 95fea60c, d6d73c49, #2592)
- Bumped `@takazudo/zdtp` 0.4.3 → 0.4.5 across the release, adopting per-instance color-scheme ownership and removing the host's inline `color-scheme` re-assert workaround for the panel-open toggle-repaint bug. (2fbc8659, 869c7d2a, #2617, #2626)

### Bug Fixes

- `createZudoDoc()` programmatic API now validates scheme names instead of accepting anything silently. (b67a3c58)
- Panel open-state key now derives from the panel instance prefix. (c285e89e)
- Ported contrast/a11y audit tooling off the retired numeric palette API onto the ramp-native resolver. (e75a73f7, #2590)

### Other Changes

- e2e regression guard for the panel-open toggle-repaint fix (#2617), proven RED against 0.4.4 without the host workaround and GREEN on 0.4.5 with it removed. (f7fc58a6)
- CSS consumers repointed off retired palette slots; `create-zudo-doc`'s template `global.css` migrated to ramp-native with a legacy-token drift guard in `check-template-drift.sh`. (01fb960f, c00339bf)
- EN + JA docs, skills, and `CLAUDE.md` rewritten from the "scheme catalog" story to the ramp + semantic-tweak customization model. (0e42abc5, 80c84179, b6b46e97, 4168c708, 3139405e, #2596, #2597, #2619)

## [2.5.1] - 2026-07-04

### Bug Fixes

- Hoist the sidebar visibility pre-paint script to `<head>` to kill the hard-reload flash (591ae6ad)
- Mint default-locale hrefs for `defaultLocaleOnly` docs (958fda0f)
- Drop overview body prose duplicating the frontmatter description in claude-resources (4cd097ac)

### Other Changes

- Harden test coverage for the sidebar hard-reload no-flash fix with a frame-sampling e2e spec, plus a null-guard for the rAF probe against pre-parse frames (86b072fd, 6517d619)
- Run template claude-resources tests in the default vitest run for create-zudo-doc (cc972f12)
- Close deep-review findings on the bug-triage fixes (251ee7e4)

## [2.5.0] - 2026-07-04

A feature release for the `claudeResources` integration: it can now scan CLAUDE.md
files from a wider repo root while writing generated output into its own content
collection, plus a boundary-matching fix for `excludeDirs` and a test-suite
reliability improvement.

### Features

- `claudeResources`: add an optional `scanRoot` setting that decouples the CLAUDE.md discovery root from the generated-output base. Previously a single `projectRoot` controlled both, which conflicted when a doc site lives in a repo subdirectory — `scanRoot` (defaults to `projectRoot`) now governs CLAUDE.md discovery and relative-path resolution independently, so a subdirectory doc site can scan repo-wide while still writing into its own collection. Unset `scanRoot` is byte-identical to before (ff425ef8, zudolab/zudo-doc#2558, #2559, #2560)

### Bug Fixes

- `claudeResources`: `excludeDirs` matching is now path-boundary-aware — an exclude entry for `dist` no longer wrongly matches a prefix-colliding sibling like `dist-extra`. Applied identically to both the package and the `create-zudo-doc` template copy (2036ba79, zudolab/zudo-doc#2561)
- `claudeResources`: fix a follow-up edge case where a trailing-separator `excludeDirs` entry (e.g. a `docsDir` passed as `"docs/"`) could bypass the new boundary-aware compare; entries are now normalized before comparison (3c860181)

### Other Changes

- Strengthen `claudeResources` test coverage: the runner's no-self-rescan test now drops a decoy CLAUDE.md inside the output dir to directly exercise the `docsDir` exclude (previously only asserted idempotency, which passed vacuously), and the `scanRoot` field is mirrored into all five e2e fixtures' settings casts (0f9ef5a4, zudolab/zudo-doc#2560)
- Deflake subprocess-heavy root unit tests under CPU load: `scripts/__tests__/**` now runs as a dedicated vitest project with a 60s per-test budget (previously rode vitest's 5s default, which could time out under host contention), and `pnpm b4push`'s root-unit-tests step caps vitest workers to reduce self-inflicted contention (7daa6260, zudolab/zudo-doc#2563, #2565)

## [2.4.1] - 2026-07-04

A bug-fix release focused on keeping the persisted header's switchers correct
across SPA / view-transition navigation, plus two developer-workflow smoke fixes.

### Bug Fixes

- Re-wire the persisted-header VersionSwitcher menu (anchor hrefs, active row, and trigger label) on every SPA / view-transition swap, so it no longer serves stale per-page SSR targets after client-side navigation (4b58f4f9)
- Re-wire the header language switcher hrefs across SPA navigation so they always point to the equivalent page in each other locale instead of going stale (bb93457a, zudolab/zudo-doc#2551)
- `b4push`: skip the manual visual smoke step (neutral) instead of failing when stdin has no TTY, so non-interactive / agent-driven runs no longer register a spurious "Manual smoke (aborted)" failure (42cb4ae6)
- `smoke-preview`: force chokidar polling (`CHOKIDAR_USEPOLLING`) so the preview server boots under low inotify limits (WSL `EMFILE: too many open files`), with a longer ready timeout to absorb the startup stat-sweep (466241df)

### Other Changes

- Bump the `@takazudo/zfb` stack (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) to `0.1.0-next.76`; routine toolchain bump with no upstream API/config change (e60134d8)

## [2.4.0] - 2026-07-03

An internal **test-strategy sweep** — E2E/CI hardening, wait-pattern guards, shared-fixture
consolidation, and test retargeting. No user-facing or generated-scaffold behavior changes.

### Features

- Zero-tolerance wait-debt guard for E2E specs (with `wait-ok` markers), wired into b4push alongside per-step timing (2394139a, c5ed932c)
- Shared E2E fixture now auto-asserts console errors on teardown (dfb4dfea)
- `makeDistReader(fixture)` helper generalized from the smoke dist helper for L3 dist-read tests (608bc289)
- Real `claude-resources` template-drift parity guard (91136223)
- Exam CI hardening: trace-on-first-retry with retry-report/artifact wiring, `file-exam-issue.sh --green` mode, and a pass-on-retry annotation consumer (2b3b3e37, 03589668, 197f3eea)

### Bug Fixes

- `create-zudo-doc`: sync the `claude-resources` template with package source (615b4e0b)
- Guard a null baseline route-list in parity-diff `diff()` (25de9d73)
- Recursive E2E spec-naming guard + fixture/config parity check (c64d787a)
- Retry-flake dedup: gh pagination limit and in-run duplicates (a84ca256)
- Search refetch guard: replace the absence-window `expect.poll` with a debounce-spanning wait (7d96cffd)
- Strengthen the version-banner dist-read visibility assertion (756b072d)

### Other Changes

- Migrated E2E specs (sidebar, versioning, header-dropdown, doc-history, design-token-panel, HTML-preview) to the shared console-error fixture; demoted static-markup assertions (versioning, frontmatter-preview, TOC) to L3 dist reads
- Added coverage: markdown-feature goldens, PresetGenerator hydration, llms.txt static emission, `doc-route-paths`/`nav-data-prep` L1 suites, and deterministic sidebar-resizer width-restore
- Refactors: extract `filterTree`/active-slug helpers and a shared `normalizeHtml`/`sha256` module, dedupe `extractTrackingIssueUrl`, and retarget mirror tests at real implementations
- Docs: reconcile TESTING.md / CLAUDE.md / b4push step counts, document the `wait-ok` marker convention, and refresh stale test-flow notes

## [2.3.0] - 2026-07-03

### Features

- **Host chrome-binding seams** — new extension points let a host project inject
  markup and callables into the framework chrome without forking layout code: a
  `chromeBindingsModule` host-callables channel (ffedd8f4, #2501), `docContentHeaderExtras`
  and `homeExtras` binding slots (8e553706, #2500), and a `createHomePageView` factory
  exposed via the `./home-page` subpath export with its own extras seam (20d728e8 /
  34dfa5e7, #2502). `HomePageView` is re-exported from the host chrome adapter and adopted
  across package, showcase, and template home routes (40f88971 / 2f371ba6 / 3b9cea8d, #2503).
- **Accessibility contrast audit tooling** — a contrast guard that checks the full
  color-pair matrix, with a `--suggest` mode that proposes OKLCH tweaks to clear WCAG
  floors (0f9668ad / 29d585e5, #2490, #2492).

### Bug Fixes

- **doc-history:** scope the rename-chain seal to the chain's physical path so unrelated
  files no longer share history (2520270b, #2517).
- **home-page:** honor `categoryMetaDir` on the default locale (28da87c4, #2519).
- **chrome bindings:** raise a loud error for an empty `chromeBindingsModule` and guard
  against a directory-valued path (8cea6c2b / 86c35b5d, #2518).
- **accessibility:** burn down contrast failures across the dark presets and light schemes,
  retune 261 marginal pairs to a threshold+0.1 headroom, and audit muted/accent tokens on
  their real rendered backgrounds (57a16896 / d518d546 / 87a1d6b1, #2493, #2497, #2510).
- **e2e:** randomize the workerd inspector port per fixture preview to fix a race under
  `wrangler dev` (fe9eceb6, #2084), and migrate fixture wrangler configs to Workers
  static-assets (a1c2f330).

### Other Changes

- **doc-history:** single-pass `--name-status` walk for the preBuild meta generation
  (07a98c11, #2517).
- **home-page:** extract `prepareHomeData` and shrink six adapters (c9c4e765, #2519).
- **deps:** bump the zfb family to `0.1.0-next.75` (9e305f5d, #2511).
- **docs:** document the host chrome-binding seams (EN + JA) and add the
  `color-scheme-a11y` project skill (31a69ce5 / 33c04519).

## [2.2.2] - 2026-07-02

### Other Changes

- Bump the zfb toolchain (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) to `0.1.0-next.74`, and the `@takazudo/zudo-doc-history-server` dependency of `@takazudo/zudo-doc` to `^2.2.1`. (e77b323f)

## [2.2.1] - 2026-07-01

### Bug Fixes

- Register the DocHistory island under package-owned routes so the History button hydrates on injected doc pages. Previously, with `packageOwnedRoutes: true` and `docHistory: true`, the injected doc route resolved the DocHistory slot to a no-op stub, so the History button never hydrated and every doc page emitted a build warning. The injected chrome shim now mirrors the host adapter's island-scanner contract. (6bf10c0a, #2480)

## [2.2.0] - 2026-07-01

### Features

- Design Token Panel: upgraded to zdtp 0.4.2 and surfaced the OKLCH color tweaker for editing colors in the perceptually-uniform OKLCH space. (fa27e5ac)
- Colors: migrated the color configuration from hex to OKLCH and added a hex→OKLCH converter script. (e64d2963)
- Colors: converted the package fallback color scheme (`chrome/derive.tsx`) to OKLCH. (2bb1e7d6)

### Bug Fixes

- Page loading: mount `PageLoadingOverlay` on package-owned routes so the loading overlay appears on those pages too. (c744e4cc)
- Mermaid: make `parseLightDark` and `resolveColor` OKLCH-aware so diagrams resolve correctly against OKLCH color values. (918faee3)

### Other Changes

- Page loading: keep `dynamicPageTransition` optional on the exported settings subset. (b18d4442)
- Contrast test: make the WCAG contrast test OKLCH-aware via culori. (40366382)
- Add `culori` + `@types/culori` devDependencies for the OKLCH migration. (156693ea)
- Tests: re-bless the route-injection byte-hash baseline on the final merged state. (5ca3b685)
- Bump `@takazudo/zudo-doc-history-server` to `^2.1.2`. (8e1f1ac1)

## [2.1.2] - 2026-06-30

### Other Changes

- Bump the first-party `@takazudo/*` build toolchain: the zfb family (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) to `0.1.0-next.72`, and `@takazudo/zudo-doc-history-server` to `2.1.1`. (c9be6e37)

## [2.1.1] - 2026-06-30

This patch release fixes a release-pipeline deadlock in the first-party pin-parity guard.

### Bug Fixes

- Relaxed the lockstep peer-floor check to satisfies-based comparison. The `@takazudo/zudo-doc-history-server` peer floor in `@takazudo/zudo-doc` is now judged against the root version with caret/satisfies semantics — a same-major lag (e.g. floor `^2.0.1` at root `2.1.0`) passes with a non-fatal advisory, and only cross-major drift or a floor above root fails — while the pinned `@takazudo/zdtp` peer stays exact. This unblocks the lockstep release and publish workflows, which previously deadlocked because the floor can only name an already-published version under `--frozen-lockfile`. (2bb3ca98, #2470)

### Other Changes

- Documented the intentional prerelease handling in the pin-parity caret comparator: the core-version comparison strips prerelease suffixes by design, so a prerelease lockstep root is treated as in-range — applying strict prerelease semantics would reintroduce the publish-lag deadlock this guard removes. (ee20574b, #2470)

## [2.1.0] - 2026-06-30

This release introduces the `--zdc-*` **component-token customization surface** — a new layer of CSS custom properties that lets you retheme zudo-doc's content typography and chrome without ejecting components.

### Features

- `@takazudo/zudo-doc`: new `--zdc-*` component-token surface, exposed at the public `@takazudo/zudo-doc/component-tokens` subpath. Tokens cover content (doc title, h2/h3/h4 typography, admonition shape) and chrome (card radius, content max-width, TOC width, SSR sidebar-tree nav-active identity); codegen routes each token by surface (content vs chrome). (76cb91bf, 17301261, b3ed71bd, 47de0260, f0723040, 35831532, #2447–#2462)
- `@takazudo/zudo-doc`: added a `--tracking-*` letter-spacing scale to the `@theme`. (615c5732, #2459)
- `@takazudo/zudo-doc`: new `gen-component-tokens` generator with a build-time drift check that keeps the token registry and emitted CSS in sync. (c940dbc6, #2448)
- `@takazudo/zudo-doc`: page-level factories now assert they received a real `ChromeContext` at runtime, giving a clear error (instead of a downstream crash) when a 2.0 migration is incomplete. (6b38362a, #2455)

### Bug Fixes

- `@takazudo/zudo-doc`: the `ChromeContext` guard now takes `unknown` and is null-safe across all page-level factories, fixing package `tsc`. (9a0ec16d, f9e95458, #2455)
- `@takazudo/zudo-doc`: widened the `@takazudo/zudo-doc-history-server` peer floor to `^2.0.1` and added a first-party peer-parity guard. (21a06be7, #2455)
- `@takazudo/zudo-doc`: made `gen-component-tokens.mjs` executable and fixed the drift guard that was silently no-op'ing via the pnpm bin shim. (f3299413, 6d1d9b85)
- `@takazudo/zudo-doc`: corrected stale `_chrome-context.ts` comment references. (f6b708e2, #2436)

### Other Changes

- Docs: added a bilingual `--zdc-*` token reference covering all 17 registry tokens, a "Customizing zudo-doc" strategy/ladder page, and a components-doc summary table. (a5ca31f5, 97111cfb, 131132c4, #2451, #2464, #2465)
- Bumped `@takazudo/zdtp` to 0.4.1. (87fad196, #2444)

## [2.0.1] - 2026-06-29

This is a **patch** release. It adds the `settings.head` site-`<head>` injection hook — the host-level seam that 2.0.0 "Collapse Wiring Shells" left missing — and bumps the zfb toolchain to `0.1.0-next.71`. With no `settings.head` configured, rendered output is **byte-identical** to 2.0.0.

### Features

- `@takazudo/zudo-doc`: new optional `settings.head: SiteHeadConfig` field that injects custom `<head>` content — `preconnect`, `preload`, `stylesheets`, `alternateLinks`, and `meta` descriptors — on every page type (homepages, doc pages, tags, versions, 404) via the single live head emitter. `stylesheets` entries accept `async: true` for non-render-blocking loading (the `media="print"` + `onload` media-swap pattern with a `<noscript>` fallback). The field is serializable data only, so it also reaches package-injected routes. Absent `settings.head` emits nothing, keeping output byte-identical to 2.0.0. (0c50a080, 32bae945, #2435)

### Other Changes

- Bumped the `@takazudo/zfb` toolchain — `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare` — from `0.1.0-next.70` to `0.1.0-next.71`. (d0fe255f, #2435)

## [2.0.0] - 2026-06-29

This is a **major** release. The `@takazudo/zudo-doc` host-wiring surface was collapsed onto a unified `ChromeContext`. Rendered HTML/CSS is **byte-identical** to 1.3.0 — the break is in the factory API, not in output.

### Breaking Changes

- `@takazudo/zudo-doc`: the public chrome/render/data factories (`createHeadWithDefaults`, `createHeaderWithDefaults`, `createSidebarWithDefaults`, `createFooterWithDefaults`, `createRenderDocPage`, `createNavSourceDocs`, the `createDoc*` family, …) now take a single unified `ChromeContext` instead of wide parameter bags. Host code that called these factories must build a `ChromeContext` (via the new `createRouteContext` + `createChrome` builders) and pass it. Rendered output is unchanged — see `API.md`. (df2a57f6, #2424)

### Features

- `@takazudo/zudo-doc`: new public builders `createRouteContext(payload)` and `createChrome(context, hostBindings)`, exported at `@takazudo/zudo-doc/route-context` and `@takazudo/zudo-doc/chrome`. The package-side chrome reconstruction is now a shared, public builder consumed by both injected package routes and the host adapter. (9f0ac9a0, b14c3226, #2423)
- `create-zudo-doc`: generated projects now scaffold a single `pages/lib/_chrome.ts` host adapter (plus a vitest-safe `_route-context.ts` seam) instead of ~34 per-component wiring shells. (791caf87, #2429)

### Other Changes

- Collapsed the host's ~35 factory-wiring shells onto the unified adapter (−648 lines of host code), guarded by a byte-parity + island-reachability gate proving rendered HTML/CSS is identical. (#2427, #2428)
- Rewrote `@takazudo/zudo-doc` `API.md` for the 2.0 contract; updated public-API and eject snapshots. (5ed727c1, #2425)
- Removed dead/duplicated files and dedup'd tag-vocabulary types onto `@takazudo/zudo-doc/settings`. (b0f7bf80, 48634b5a, #2422)

## [1.3.0] - 2026-06-29

### Features

- **create-zudo-doc now initializes a git repository** (`git init` + an initial commit) after scaffolding, so the doc-history feature shows real Created/Updated/Author metadata out of the box. It skips automatically when the target is already inside a git repository or when git is unavailable; opt out with `--no-git`. (37ecd2fa)

### Bug Fixes

- **doc-history no longer crashes outside a git repository.** A freshly scaffolded project that had not been `git init`-ed would throw in the doc-history `preBuild` hook (`git rev-parse` ran outside a `try`/`catch`), taking `pnpm dev` / `pnpm build` down with it. Repo-root resolution now degrades to empty history instead, with a one-time hint to run `git init`. (7f3ace71)
- claude-resources: resolve broken intra-doc links in the mirror generator. (95091add)
- claude-resources: also protect tilde-fenced code blocks during link downgrade. (8a587df9)
- content: add inner flow spacing and roomier bottom padding to admonitions. (9c6cc1d2)

### Other Changes

- Bump the @takazudo toolchain — zfb family to `next.70`, history-server pin to `^1.2.0`. (b5489acf)
- create-zudo-doc: align scaffold zfb pins with the root (`next.70`) and sync the claude-resources template with the mirror-link fix. (c97ad5e2, ba9b2cb9)

## [1.2.0] - 2026-06-28

### Features

- The generator now forwards `translations` and `colorSchemes` into the emitted `zfb.config.ts`, so a scaffolded project carries its i18n strings and color schemes through to the build. (be97f874, #2408)
- Host wiring passes `translations` and `colorSchemes` through to `zudoDocPreset()`, making both configurable via the preset rather than by hand. (18d3a072, #2407)
- Package-provided routes now render their own body-end islands, so package docs routes hydrate their interactive islands without extra host wiring. (92dbf20f, #2406)
- Thread `colorSchemes` through the virtual module so the host theme resolves the active scheme at build time. (b20bd484, #2405)

### Bug Fixes

- `zudoDocPreset()` now defaults `packageOwnedRoutes` on and warns when it is explicitly turned off while content exists, preventing silently-empty doc routes. (4a3a6473, #2402)
- `standalone` frontmatter now implies `hide_sidebar` and `hide_toc`, so standalone pages render chrome-free as intended. (311be086, #2395)

### Other Changes

- Bump the first-party `@takazudo/*` build toolchain: `@takazudo/zfb`, `@takazudo/zfb-runtime`, and `@takazudo/zfb-adapter-cloudflare` to `0.1.0-next.69`, and `@takazudo/zudo-doc-history-server` to `^1.1.0`. (c2ac69f1, 38b5d15a)

## [1.1.0] - 2026-06-27

### Features

- Wire host-only MDX component overrides into the package-provided docs route, so the package docs route renders content typography consistently with host pages. (37458437, #2390)
- Add 6 island swizzle points to the `EJECTABLE` map, expanding which interactive islands downstream projects can eject and customize. (2eba7863, #2388)
- Wire the `cjkFriendly` setting through `zudoDocPreset()`, so CJK-friendly typography is configurable via the preset rather than requiring manual config. (bf0a94c7, #2387)

### Bug Fixes

- Apply the accent-on-hover treatment to card description spans for visual consistency with the rest of the nav-indexing cards. (341b52fa)
- Bump the scaffolded `zod` floor to `^4.3.6` in generated projects so a fresh scaffold installs a compatible validator. (ff2317f5)

### Other Changes

- Bump the first-party `@takazudo/*` build toolchain: `@takazudo/zfb`, `@takazudo/zfb-runtime`, and `@takazudo/zfb-adapter-cloudflare` to `0.1.0-next.67`, and `@takazudo/zudo-doc-history-server` to `^1.0.2`. (30d9e187)

## [1.0.2] - 2026-06-27

### Other Changes

- Align the `@takazudo/zudo-doc-history-server` optional peer dependency in `@takazudo/zudo-doc` to the `1.x` line (`^0.2.21` → `^1.0.1`). The stale pin was unsatisfiable by the published `1.x` package, so installs silently pulled the outdated `0.2.21`; the peer contract now matches the workspace package and the `create-zudo-doc` scaffold pin (c86861e6).

## [1.0.1] - 2026-06-26

A patch fixing barebone (all-features-off) scaffold builds. Since
`packageOwnedRoutes` is on by default, the always-copied host base template
statically pulls `@takazudo/zudo-doc/doc-history` — and its `import("diff")` —
into every generated bundle, even with doc history disabled. The scaffold only
declared the `diff` peer when doc history was enabled, so a barebone `zfb build`
failed at esbuild with `Could not resolve "diff"`.

### Bug Fixes

- Provide the `diff` peer dependency unconditionally in generated projects so a barebone (all-features-off) `zfb build` resolves the always-bundled `@takazudo/zudo-doc/doc-history` import instead of failing at esbuild. (1c777e32, #2342)

### Other Changes

- Add a true-barebone scaffold → install → `zfb build` slow test that locks the regression, with shared install/build plumbing extracted into `slow-build-helpers.ts`; serialize the slow-test tier and clarify the optional-peer comment. (1c777e32, ff2cd958)

## [1.0.0] - 2026-06-26

**1.0.0 — the package-first milestone.** zudo-doc graduates to a package-first
architecture: the framework's routes, rendering layer, structural islands, eject
CLI, and content styles all ship from `@takazudo/zudo-doc`, and a scaffolded
project's `pages/` is now nearly empty. This completes the Package-First Finale
(#2356) and the Stub-Deletion Fast-Follow (#2369).

### Breaking Changes

- Package-owned routes are now **ON by default** (`packageOwnedRoutes`): `@takazudo/zudo-doc` injects the site's routes at build time, and 26 redundant route stubs (13 showcase + 13 generator-template — 404, sitemap, robots, tags, versions, and their locale variants) were deleted. A scaffolded project no longer carries those `pages/` files. The four `docs/[[...slug]]` catch-all routes remain host-owned for now. (#2370, #2372, #2374)
- The copy-public plugin is gone — projects rely on zfb's native `publicDir` instead of `./plugins/copy-public-plugin.mjs`. Generated `zfb.config.ts` no longer references it, so a fresh scaffold's `pnpm build` no longer fails on a missing plugin file. (#2358)
- The 1.0 public API surface of `@takazudo/zudo-doc` is frozen and snapshot-guarded — the export set is now a stability contract. (#2356)

### Features

- `zudo-doc eject <component>` per-component swizzle CLI, shipped from `@takazudo/zudo-doc` so it is reachable in generated projects post-scaffold; a `.zudo-doc.json` provenance marker is seeded at scaffold time. (#2362, #2367, #2373)
- Package-owned route layer: route `.tsx` sources ship as `routes-src/`, with a typed route-context seam and a routes plugin behind the `packageOwnedRoutes` gate (now default-on). (#2357, #2363, #2370)
- New `/l-migrate-to-preset-style` skill to migrate existing projects onto the preset-based `zfb.config.ts`. (#2364)
- Generated templates now re-export content components from the package, forward `settings-types` to the package, adopt the `createMdxComponents()` factory, and use reconciled `global.css` semantic tokens — reducing per-project copy drift. (#2360)

### Bug Fixes

- Fixed generated-project `pnpm build` failure caused by the published preset still emitting the removed copy-public plugin; resolved by the native `publicDir` migration in this release. (#2358, #2342)
- Keep the `docs/[[...slug]]` catch-all routes host-owned where the injected route cannot yet render host-only MDX components (`Details`, `HtmlPreview`, `Island`). Completing this is tracked separately. (#2377)
- Cleared island marker-name collisions by removing local island duplicates and repointing the `SiteTreeNav` island in the index templates.
- Made the `zudo-doc` bin tsx-free so it runs in generated projects without a `tsx` dependency.
- Taught the pin-parity check to resolve the `ZUDO_DOC_PIN` scaffold constant; e2e fixtures now copy root `public/` instead of symlinking it (native `publicDir`).

### Other Changes

- Bumped the `@takazudo/zfb` stack to `0.1.0-next.65`.
- Pinned the route-injection seam and eject-contract ADRs; added a build-time proof for no-stub package-owned routes and expanded eject / `packageOwnedRoutes` test coverage. (#2357, #2359, #2363)

## [0.2.22] - 2026-06-25

Package-First Wave 3: the remaining `pages/lib/*` rendering/data modules and the
structural islands now live in `@takazudo/zudo-doc` behind injected-context
factories, so a scaffolded project's `pages/lib/*` files are thin re-export stubs.
No zfb engine change.

### Features

- `@takazudo/zudo-doc` ships the doc-page rendering and data layer as injected-context factories taking `{ settings, i18n, components, navSource }` (no generic `utils` bag): shell wrappers (header/footer/head/sidebar/doc-page-shell/search-widget), data layer + route enumeration (nav-source/locale-merge/doc-route/route-enumerators), doc-page rendering internals, and index/tag/version renderers. (#2350, #2351, #2352, #2353)
- The eight structural islands moved into the package as `"use client"` exports with pinned `displayName`s: `SidebarTree`, `SidebarToggle`, `DesktopSidebarToggle`, `SiteTreeNav` (`when:"idle"`), `ImageEnlarge`, `MermaidEnlarge`, `AiChatModal`, `DocHistory`. Their coupled CSS (`.zd-enlarge*`, `.zd-mermaid*`, `.ai-chat-md`, `.diff-*`) moved into `@takazudo/zudo-doc/features.css`. (#2347, #2348, #2349)
- New foundation exports: `factory-context` (the typed context + allowed `components` slot allowlist), `render-markdown`, `slug`, `smart-break`, `use-modal-dialog`, `island-types`, and `url-helpers` (`makeUrlHelpers`). (#2345, #2346)
- New `check:no-host-alias-in-package` guard (b4push + CI) fails if `packages/zudo-doc/src/**` imports a host `@/` alias, structurally enforcing the package's host-independence. (#2345)

### Bug Fixes

- `buildNavTree` no longer serves a stale default-href tree from cache when a custom `buildHref` is injected. (#2345)
- create-zudo-doc generator: restored the W6A no-op stubs (and body-end-islands feature gating) for `image-enlarge` / `ai-chat-modal` / `doc-history` so a scaffold with the feature off ships a render-nothing stub rather than pulling the island in. (#2348, #2349)
- Aligned the factory injection-boundary types surfaced by the stricter `check:pages` / package typecheck gates (locale param variance, `readonly` vocabulary arrays, factory-specific settings shapes). No runtime change.

### Other Changes

- Package declaration output moved from tsup's rollup-DTS to a linear `tsc --emitDeclarationOnly` pass (`tsconfig.build.json`); tsup still emits the per-file JS (`bundle:false`, `"use client"` preserved). The previous rollup-DTS was combinatorial in memory and OOMed at ~200 entries — the package now builds under the default Node heap, keeping CI green.

## [0.2.21] - 2026-06-23

### Features

- Scaffold a `setup:doc-skill-silent` variant in `create-zudo-doc` (3896602d)

### Bug Fixes

- Restore focus to the document-history trigger when the modal closes — keyboard and screen-reader users no longer lose their place (a11y) (bbfd15ef)
- Hide the desktop sidebar toggle on no-sidebar (`hide_sidebar`) pages (63751bbd)

### Other Changes

- Harden the Tauri apps: a restrictive Content Security Policy for the offline reader, a scoped capability that drops the unneeded `remote.urls` grant, and a documented Mode 2 trust assumption (846b1d74)
- Bump the `@takazudo/zfb` stack to `0.1.0-next.59` (e558b5ae)
- Apply the accent color to the category-nav card description on hover (c343afb7)
- Tighten the sidebar pre-paint script after review (d871e45f)

## [0.2.20] - 2026-06-22

### Other Changes

- Bumped the `@takazudo/zfb` stack from `0.1.0-next.57` to `next.58`. (474f23f)

## [0.2.19] - 2026-06-22

### Features

- `@takazudo/zudo-doc` now ships the page-loading overlay CSS as a standalone export, `@takazudo/zudo-doc/page-loading.css`. Standalone consumers that wire their own layout (not `DocLayoutWithDefaults`) can `@import` it alongside the `PageLoadingOverlay` component instead of hand-copying the overlay/spinner/pending-link rules into their `global.css`. (#2280, #2279)
- Added a decoupled scrim token, `--color-page-loading-overlay`, that controls the loading overlay background independently of the lightbox `--color-overlay`. It defaults to `color-mix(in oklch, var(--color-overlay) 60%, transparent)`, so existing projects are unchanged; override it to retone the loading scrim on its own. (#2280, #2279)
- Added a WCAG contrast guard test and corrected the **Default Light** color scheme so its text/background pairs meet AA contrast. (#2298)

### Bug Fixes

- Mirrored the **Default Light** palette AA darkening into the `create-zudo-doc` template, so freshly scaffolded projects ship the contrast-corrected palette too. (#2300)
- Hardened the image lightbox: restore focus to the trigger on close, support keyboard panning, and guard against stray text selection while dragging. (#2295)

### Other Changes

- Bumped the `@takazudo/zfb` stack from `0.1.0-next.55` to `next.57`. (#2299)
- `@takazudo/zudo-doc-history-server`: parallel directory walks, an `mtime` gate, a `maxBuffer` overflow warning, opt-in LAN exposure, and structured `git log` parsing for better performance and safety. (#2293)
- Added negative-cache + backoff to the search worker and the ai-chat docs fetch so transient upstream failures degrade gracefully.
- Design-token cleanup: tokenized transition durations and scroll-margin, documented highlight tokens, and marked the inert cursor token.
- Added unit-test suites for the ai-chat security modules and the legacy plugin transforms. (#2291)
- Test governance: a `@flaky` tracking-issue guard, parity-marker split, and step-count reconciliation. (#2292)
- Quarantined the legacy `md-plugins` package as a private fixture/parity-test asset. (#2289)
- CI hardening: single-sourced the wrangler version, pinned action digests, deduped the CSS smoke gate, and hardened the slow-test install retry with exponential backoff. (#2297)
- Review-sweep safe-batch cleanup of 2026-06-20 review findings plus a dependency bump. (#2302)

## [0.2.18] - 2026-06-21

### Features

- Added an `enableClientRouter` prop to `@takazudo/zudo-doc`'s `DocLayout` (default `true`). When set to `false`, the zfb SPA `ClientRouter` — together with its view-transition meta tags and route announcer — is omitted from the SSG output, so a project can ship fully static pages with no client-side soft navigation. (9316a23c)

### Bug Fixes

- The `dynamicPageTransition: false` setting now actually disables the SPA client router. Previously the prop existed but neither the showcase host nor generated projects forwarded `settings.dynamicPageTransition` to it, so the router stayed on regardless of the setting; it is now wired through every `DocLayoutWithDefaults` call site in both the host and the `create-zudo-doc` templates. (a72e5b90, 42305193)

## [0.2.17] - 2026-06-21

### Other Changes

- Bumped the `@takazudo/zfb` stack (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) to `0.1.0-next.55` — a dev-performance + bug-fix release (incremental `zfb dev` shadow materialise drops the live-reload tick from ~6.7s to ~2.5s; production builds are byte-for-byte unchanged). No breaking changes. (efc1b71d)

## [0.2.16] - 2026-06-21

### Features

- **Dynamic page transitions** are now a toggleable `create-zudo-doc` feature (`dynamicPageTransition`, default on). The SPA View-Transition page swap and the page-loading overlay/spinner are gated behind the feature and shipped to scaffolded projects, with EN + JA docs. (#2269)
- Added a baseline `:focus-visible` outline in `@layer base` so keyboard focus is visible on raw-CSS buttons (code copy, image-enlarge, mermaid tools, …) after the tight-token reset wiped Tailwind defaults; mirrored into the generator template. (#2256)

### Bug Fixes

- The generated `zfb.config.ts` now emits the `codeHighlight` dual-theme block, so scaffolded projects produce the `--shiki-light` / `--shiki-dark` tokens their `global.css` expects. (#2257)
- The page-loading overlay/spinner CSS now actually reaches scaffolded projects — it was previously never injected into the template. (#2269)
- `render-markdown` tokenizes bold spans before the italic pass, fixing stray `<em>` wrapping on inputs like `**a** and **b**`. (#2260)
- The desktop sidebar toggle re-applies `data-sidebar-hidden` after a soft SPA navigation, so a hidden sidebar no longer reappears. (#2255)
- The search worker adds a post-parse body-size cap (413) that closes a chunked-POST bypass, and whitespace-only queries now short-circuit with a 400 instead of reaching the index. (#2258)
- Three small hardening fixes: truncate Claude API error bodies to 500 chars, use a real `^0.2.15` semver range (not `workspace:^`) in `@takazudo/zudo-doc` peer dependencies so npm/yarn installs resolve, and stop reusing a stale Playwright dev server in CI. (#2259)

### Other Changes

- Bumped the `@takazudo/zfb` stack (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) to `0.1.0-next.54` — a bug-fix + perf release with no breaking changes. (#2271)
- Documentation: reframed the routing-conventions and trailing-slash pages around zfb (not Astro), corrected the `trailingSlash` default, documented the `category_no_page` / `category_sort_order` frontmatter fields and the `dev:zudo-doc` command, updated getting-started to Node 22+ / zfb framing, and restored JA parity for the component-first, doc-skill-symlinker, and introduction pages. (#2253)

## [0.2.15] - 2026-06-20

### Bug Fixes

- A scaffolded project with the `claudeResources` feature enabled now emits a "Claude" header-nav entry, so the generated site groups the Claude doc resources under a single "Claude" category instead of scattering claude-md/claude-skills/claude-commands/claude-agents as top-level cards. (#2234)
- Under `prefers-reduced-motion`, the root View Transition group is now neutralized as well, so reduced-motion users get an instant page swap instead of a brief frozen, non-interactive root snapshot. (#2235)

### Other Changes

- CI: the post-deploy CSS-shape smoke gate now retries its homepage and hashed-asset fetches, absorbing the brief Cloudflare edge propagation race that could transiently 404 a freshly-hashed CSS asset right after deploy. (#2237)

## [0.2.14] - 2026-06-19

### Features

- Added an `avoid robots indexing` capability: a new `noindex` toggle is selectable as a generator feature, and enabling it scaffolds a `robots.txt` page route that asks search engines not to index the site. (#2218, #2219)
- The PresetGenerator UI now shows a documentation link next to each feature, so you can jump straight to the relevant guide while configuring a scaffold. (#2220)
- The generator can now scaffold the category-top + `CategoryNav` navigation pattern, producing a category landing page wired up with its child docs. (#2230)

### Bug Fixes

- The sidebar resizer now preserves a manually dragged width across SPA (client-router) navigations, instead of resetting after a View Transition swap. (#2231)

### Other Changes

- Docs: added a bilingual (EN + JA) "avoid robots indexing" guide, with cross-links explaining the `noindex` feature and the generated `robots.txt` route. (#2221)
- Docs: documented the category-top + `CategoryNav` convention in the navigation-design skill and the structuring-navigations guide. (#2230)

## [0.2.13] - 2026-06-18

### Bug Fixes

- Header navigation now highlights the active item by its **big category**, not just an exact URL-path match, so a doc page correctly lights up its parent category in the nav. (#2213)
- The header's active-nav highlight now updates correctly across SPA (client-router) navigations, instead of staying stuck on the previously active item after a View Transition swap. (#2215)

### Other Changes

- Bumped the `@takazudo/zfb` stack (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) to `0.1.0-next.53`, which terminates GFM autolinks at CJK boundaries (zfb#1105) — relevant to Japanese and other CJK content. (#2216)
- CI: build output is handed between jobs via tarred artifacts (preserving colon-containing route paths) instead of a run-id cache, making the cross-job handoff reliable. (#2211)
- Docs: reconciled stale `desktop-sidebar-toggle` prose in the template-drift allowlist. (#2212)

## [0.2.12] - 2026-06-18

### Features

- Runtime `<html>` attributes — the collapsed-sidebar state (`data-sidebar-hidden`) and the active theme (`data-theme`) — now persist across SPA (View Transition) navigations via zfb's new `ClientRouter` `preserveHtmlAttrs` option. A collapsed sidebar no longer briefly flashes open on navigation, and the previous host-side flash workaround is retired in favour of the upstream mechanism. (#2200)

### Other Changes

- Bumped the `@takazudo/zfb` stack (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`) to `0.1.0-next.52`, which ships the `preserveHtmlAttrs` API. (#2200)
- Removed stale/redundant dependencies and refreshed the lockfile.

## [0.2.11] - 2026-06-17

### Bug Fixes

- Suppress the desktop sidebar flash during SPA (client-side) navigation, so the sidebar no longer flickers between route changes (#2198, 3da4ec2f)
- Enlarge the mermaid zoom toolbar 2×, move it to the bottom-right, and disable text selection while panning (#2202, 4dd984e6)

### Other Changes

- Add e2e regression coverage for the sidebar SPA-nav flash and settle the collapse animation before snapshotting the sidebar baseline (#2198, 9455cab7)

## [0.2.10] - 2026-06-17

### Features

- Mermaid diagrams now have an enlarge button that opens a zoom/pan dialog for inspecting large flowcharts (#2186, ad08b5b5)

### Bug Fixes

- Keep mermaid diagrams rendered across SPA soft navigation so they no longer disappear after client-side route changes (#2181, a37b4907)
- Contain the enlarged mermaid diagram and stop edge-label clipping in the zoom/pan dialog (#2193, 63e2f82f)
- Strip JSX/MDX block comments from `llms.txt` output so generated text no longer leaks raw comment markers (#2192, edd361e4)
- `create-zudo-doc`: gate the generated `.gitignore` doc-skill block on the `skillSymlinker`/`i18n` features so barebone scaffolds omit it (#2182, 1dc8de35)
- `create-zudo-doc`: gitignore the generated doc-lookup skill deterministically (#2173, 10d0b183)
- `create-zudo-doc`: drop a duplicate settings import in the `imageEnlarge` feature (#2172, ba66300f)

### Other Changes

- Ship the `.zd-content` content typography stylesheet from `@takazudo/zudo-doc` as `content.css`, imported by both the host `global.css` and the generated template — retiring the copy-drift between the two (#2196, 44eb0dfe)
- Bump `@takazudo/zfb` 0.1.0-next.49 → 0.1.0-next.51 (#2171, d91aae48)

## [0.2.9] - 2026-06-16

### Features

- Gate zdtp (Design Token Panel) scaffolding behind the `designTokenPanel` feature in `create-zudo-doc` — when the feature is off, the generated project no longer emits any zdtp wiring (#2165, fa6b23aa)

### Bug Fixes

- Resolve pnpm `ERR_PNPM_TRUST_DOWNGRADE` during the scaffold's `pnpm install` in `create-zudo-doc` (#2150, e43b7f3e)

### Other Changes

- Scrub residual zdtp mentions from barebone `create-zudo-doc` output so a panel-less scaffold has no stray references (#2165, a22725f0)
- Recommend the `@takazudo/zudo-doc/theme-toggle` subpath for custom theme toggles and correct the ThemeToggle customization scope in the theming docs (#2164, de7f31bd)
- Bump `@takazudo/zfb` 0.1.0-next.47 → 0.1.0-next.49 (#2167, #2168)

## [0.2.8] - 2026-06-16

### Features

- Dual-theme syntect code highlighting — code blocks now follow the light/dark toggle with no client JS. `codeHighlight.themeLight`/`themeDark` (`base16-ocean.light` / `base16-ocean.dark`) emit `--shiki-light`/`--shiki-dark` CSS custom properties that `global.css` resolves via `light-dark()`, fixing the previously near-invisible code on the light theme (#2160, 491652dc)

### Other Changes

- Bump `@takazudo/zfb` 0.1.0-next.44 → 0.1.0-next.47 and `@takazudo/zdtp` 0.2.0-next.2 → 0.2.3 to enable the dual-theme syntect mode; align workspace pin parity across `packages/zudo-doc` and the `create-zudo-doc` scaffold (#2160, 491652dc)
- Purge stale "zdtp re-highlights code via Shiki" claims across CLAUDE.md, source comments, and EN/JA content — zdtp's Shiki integration is a no-op stub and `shikiTheme` is now optional (zdtp 0.2.3) and vestigial (#2160, 491652dc)

## [0.2.7] - 2026-06-15

### Features

- Adopt a semantic z-index token system — a single source-of-truth token set with codegen, a drift check, and a generated `@theme` block; migrate every z-index usage onto the tokens and add a lint rule that prohibits raw numeric `z-{n}` Tailwind utilities (#2148, 1ba07ea1)
- Generator now emits a search header item by default (#2139, 45d496f4)
- Wire the `mermaid`, `onBrokenLinks`, and sitemap settings through config, and document the reserved ones (#2140, 7c56eee3)

### Bug Fixes

- Close the search dialog on result click and harden its overlay z-index (#2148, 794827f1)
- Apply the dialog SPA-swap z-index defense (`z-modal` / `z-modal-backdrop`) to the doc-history, ai-chat, and image-enlarge dialogs (#2157, 0f91b276)
- Restore `lint:tokens` enforcement via a symlink-tolerant pnpm patch (#2156, e16e122e)
- Use `onInput` for the sidebar live filter so it works under non-compat Preact builds (348ae115)
- Islands: fix modal-nav churn, image-enlarge gating/teardown, and accessibility issues (#2136, 03a6a36d)
- Harden the ai-chat API with a locale guard plus input/URL validation (#2142, f240b64e)
- doc-history / search: add timeouts, bound fan-out, and guard batch parsing (#2141, 1c4c39be)
- Harden doc-history postBuild and locales validation, and fix header casing (#2137, 68221856)
- Bound the `claude-resources` CLAUDE.md walk to `claudeDir` when `projectRoot` is omitted (#2115, dfb4c28b)

### Other Changes

- Bump the `@takazudo/zfb` family from 0.1.0-next.44 to 0.1.0-next.47 — additive (dual light/dark syntect themes, dev boot-lazy mode, client-router timer fixes), no consumer-facing breaking change (#2159, 650b17fb)
- Decouple zdtp from the public type surface and guard the package safelist (#2138, feeb0d40)
- Add icon-size tokens, tokenize literal sizes, and clean up the lint config (#2143, fcfb3d91)
- CI: pin wrangler, disable `workers_dev`, add a production link check, and guard fork PRs (#2144, 283b1963); drop the stale npm `next` dist-tag on stable graduation (#2121, 08c8f6ef); fix the exam Full-E2E reporter passthrough and make issue filing jq-free (#2122, 509176d5)
- Expand documentation — code-group name/groupId and custom directive registration; configuration options (`defaultLocale`, `defaultLocaleOnlyPrefixes`, `metaTags`, `bodyFootUtilArea`, `headerRightItems`, tag settings); advanced resolve-links `dirs`/`routePrefix`; the admonitions `important` variant; i18n `defaultLocale`; and the available color schemes — plus fixes to stale counts, grammar, and references (#2134, #2145)
- Make the create-zudo-doc preset-swap test resilient to registry flakes (#2123, bda63e20)

## [0.2.6] - 2026-06-14

### Other Changes

- Bump the `@takazudo/zfb` family to 0.1.0-next.44 — the SDK surface is unchanged from next.43 (no consumer-facing breaking changes), so a fresh scaffold now pins the latest engine (781a57bc)
- Add a web session bootstrap for the `claude-resources` profile (6f98ff8f)

## [0.2.5] - 2026-06-14

### Features

- Add a `metaTags` settings object and gate head emissions through it, so downstream projects can configure (or disable) the doc page's meta description, Open Graph, and Twitter Card tags (f5d292b9)
- Add a meta-tags area to the preset generator UI and wire the corresponding CLI preset plumbing (5b556792)

### Bug Fixes

- Honor `prefers-reduced-motion` for view-transition cross-fades so animation-sensitive users get instant page swaps (eca934f8)
- Cross-fade lone chrome snapshots on cross-type page transitions, fixing the sidebar flash when navigating between page types (78072d5b)
- Inject the diff-viewer CSS into the scaffolded `global.css` via the `docHistory` feature so a fresh scaffold renders the history diff correctly (1667369a)
- Gate the plain meta description through `metaTags.description` in the doc page shell (9f1be44c)
- Resolve the `.zd-content` flow-space vs Tailwind utility cascade and keep flow spacing layered above the preflight reset (2ecd68b8, 75ab7210)
- Render the pager's upper spacing at `vsp-2xl` via a `--flow-space` override (ec663543)
- Align the preset generator's default state with the target JSON (46635753)
- Lower the diff-viewer per-line separator opacity from 30% to 15% (f29eb4cd)

### Other Changes

- Add `TESTING.md` documenting the test levels, tiers, tag taxonomy, and quarantine pipeline (8236dc91)
- Testing-strategy refactor: `E2E_FIXTURES` fast path with scoped servers and skip-rebuild-when-fresh, a shared `consoleErrors` fixture, a spec-to-fixture naming guard, deflaked sleep-driven specs, and shared SPA-nav helpers (1366a4f9, 7d9ddd65, 627db2d6, f7d05014, be277c34)
- CI: add the `exam.yml` nightly T3 scheduled tier and surface pass-on-retry as GitHub Actions warnings (903c2309, c988ddee)
- b4push/docs truth-up: wire package tests and a root `pnpm test`, and fix stale documentation claims (de0a3765)
- Stagger the e2e web-server startup to avoid the wrangler inspector-port race (7e952cc9)
- Bump the `@takazudo/zfb` family to 0.1.0-next.43 (609b8ef9)
- Bump `actions/cache` 4.3.0 → 5.0.5 for the Node 24 runtime (2433d1da)

## [0.2.4] - 2026-06-12

### Bug Fixes

- Switch the scaffolded `_toc-title.ts` template to a re-export from `@takazudo/zudo-doc/toc`, dropping the hand-mirrored `TOC_TITLES` map that was stale-by-construction now that the package exports `getTocTitle` (f3a9b058)
- Key `DiffViewer` by the compared revision pair so picking a new Compare pair on desktop remounts the viewer — the new header hashes no longer briefly render over the previous pair's stale diff rows (e6d39bb9)

### Other Changes

- Bump the zfb family to 0.1.0-next.41 — adds a URL-space fallback for dir-style hrefs written from non-index pages and makes the data-file skip warning respect collection include/exclude globs (cbab69c5)

## [0.2.3] - 2026-06-12

### Features

- Export `getTocTitle` (the locale→TOC-title resolver) from the public `@takazudo/zudo-doc/toc` barrel (aa3741eb)

### Bug Fixes

- Stop the search widget flickering and re-fetching the index on every keystroke after `search-index.json` fails to load — it now shows a stable "Search unavailable" message and recovers cleanly on retry (47334892)
- Gate the AiChatModal and ImageEnlarge body-end islands on their feature flags so feature-off consumers no longer ship dead island markers and a misleading screen-reader "AI Assistant" landmark (29417afa)
- Make the closed mobile sidebar drawer `inert` so its off-screen links and filter input no longer stay in the tab order and accessibility tree (6caa7f80)
- Suppress dead Sidebar island markers and restore Toc/MobileToc hydration in synced consumers (d27c653d, c2cb4f83)

### Other Changes

- Retire the scanner-visible Toc/MobileToc/ThemeToggle shims — zfb ≥ 0.1.0-next.39 scans npm-dist `"use client"` modules, so the package islands register directly and the shims caused marker-name collisions (241b8a41)
- Bump the zfb family to 0.1.0-next.40 (cc7ec7c8, f31e0ea2)
- Add a 0.2.0 → 0.2.1 consumer migration note to the changelog (9ee33dbf, d69d225d)
- Drop the Cloudflare 10013 incident notes from CI docs and re-float wrangler to `@4` (d050c9cb)

## [0.2.2] - 2026-06-11

### Bug Fixes

- Wire the Tauri FindInPageInit island into body-end islands so Cmd/Ctrl+F works in generated Tauri desktop apps (9d9ec662)
- Clear find-in-page state on zfb SPA navigation — the find bar no longer stays open with stale match state across in-app navigation (81ac79e3)
- Make generated projects pass `zfb check` out of the box: type the non-i18n `locales` as `Record<string, LocaleConfig>` and ship `zfb-shim.d.ts` in the base template (4fcb5953)
- Add `"use client"` to island component templates and enforce host/template directive parity (5217290d)
- Add a scanner-visible ThemeToggle shim so synced consumers hydrate the header theme toggle (4cf95525)
- Use `e.currentTarget.value` in the sidebar-tree filter input handler (dd281916)

### Other Changes

- Harden the directive-parity check: tolerate BOM/CRLF, guard stale exempt entries, and fix an early-return aborting the scan under `set -e` (d0a055b0, 13c48cf9)

## [0.2.1] - 2026-06-11

Maintenance release. Aggregates two full-project review waves, a batch of agent-found hardening fixes, the zfb `0.1.0-next.38` engine bump, and dev-experience fixes. `@takazudo/zudo-doc`, `@takazudo/zudo-doc-history-server`, and `create-zudo-doc` are released together in lockstep.

### Migrating a 0.2.0 consumer

If you maintain a downstream site scaffolded from `create-zudo-doc`, the jump from 0.2.0 to 0.2.1 is more than a version bump. The template wiring evolved in interlocking ways, and the zfb `0.1.0-next.38` engine bump that ships with this release surfaces a pre-existing island-hydration gap. This section collects what three real consumer upgrades ran into, so you can do the migration in one pass.

#### The new island warnings expose islands that were already dead

zfb `0.1.0-next.38` adds an island-marker registry warning (zfb #984 / #990). On a 0.2.0-era wiring you will suddenly see up to seven of them — one per emitted-but-unregistered marker: `ThemeToggle`, `Toc`, `MobileToc`, `Sidebar`, `DocHistory`, `ImageEnlarge`, and `AiChatModal`. These islands server-render correctly but never hydrate, because the island registry under-registers against the markers the page emits. The build still exits 0.

> **Warning**
next.38 did not break these islands — it **revealed** them. On any zfb release below next.38 the same toggles and TOCs ship dead (non-interactive) with no warning at all. Read the warnings as a diagnosis of a long-standing gap, not as a regression introduced by this release.

#### Adopt the 0.2.1 template changes as one wave

Run `pnpm check:template-drift`. On a 0.2.0 baseline it flags the full interlocked set — roughly 17 to 31 files, depending on which template generation you last synced — spanning:

- #2010 — doc route consolidation (new `_doc-page-renderer` / `_doc-route-entries` modules)
- #2030 — nav-data dedupe (new `_nav-data-prep` module)
- #2012 — bare `theme-toggle` subpath export
- #2016 — `docs-schema` extraction (a single zod source of truth)
- #2022, #2024, #2037 — versioned-page metadata, search-index / llms-txt dedupe, and zdtp state survival

These changes reference one another, so **partial adoption leaves dead glue behind**. Sync them together.

One field data point (zudolab/zudo-css-wisdom#103): a full adoption synced 31 flagged files plus 4 new modules cleanly in a single wave. The only build break was a new `getLocaleConfig` export now expected from `src/config/i18n.ts` — if you have customized that file, add the export.

#### Keep a scanner-visible `ThemeToggle` shim on next.38

Adopting the 0.2.1 templates makes `ThemeToggle` **newly** dead on next.38. The 0.2.1 `_header-with-defaults.tsx` switches from a local `src/components/theme-toggle.tsx` copy to `import { ThemeToggle } from "@takazudo/zudo-doc/theme-toggle"` (the npm dist). The next.38 island scanner does not register islands that live inside a `node_modules` package (zfb #999), so a consumer that syncs templates goes from "six dead, ThemeToggle still works" to "seven dead."

Workaround until you are on a zfb release with the forward fix (below): keep a local, scanner-visible pass-through shim and point the header import at it. Make it a **local wrapper component** with a pinned `displayName` — a bare `export { ThemeToggle } from …` re-export does not give the next.38 scanner a local binding to register, so the toggle stays dead.

```tsx
// src/components/theme-toggle.tsx
"use client";
import type { ComponentProps } from "preact";
import { ThemeToggle as PackageThemeToggle } from "@takazudo/zudo-doc/theme-toggle";

// Local wrapper (not a bare re-export) so the next.38 island scanner sees a
// component binding it can register; displayName names the island marker.
export function ThemeToggle(props: ComponentProps<typeof PackageThemeToggle>) {
  return <PackageThemeToggle {...props} />;
}
ThemeToggle.displayName = "ThemeToggle";
```

#### Sync the residual layout-island shims (#2061)

On released next.38, consumers of zudo-doc ≤ 0.2.2 still see three dead layout islands: `Toc` and `MobileToc` on docs pages, and an empty-data `Sidebar` on `hide_sidebar` pages. These have been silently dead since at least 0.2.0.

PR #2061 fixes this for template consumers with scanner-visible `Toc` / `MobileToc` shims and an empty-fragment `sidebarOverride` on `hide_sidebar` pages. Hand-sync those files, or wait for the next `create-zudo-doc` release, which ships them by default.

#### Prune the now-orphaned local modules

0.2.1 stopped shipping local copies of several modules that the package now owns. After you sync the templates, the old full local implementations are unreferenced — delete them: the rehype plugins, hast-utils, url-utils, docs-source-map, use-active-heading, sidebar-resizer, and the doc-history util. (Counting the replaced theme-toggle / Toc copies, the zudo-css-wisdom upgrade removed 13 such files.)

> **Warning**
Do **not** delete `src/components/theme-toggle.tsx`, `src/components/toc.tsx`, or `src/components/mobile-toc.tsx` on next.38. Those filenames now hold the thin scanner-visible shims from the two sections above, and the header and page shell still import them — pruning them reintroduces the dead-island warnings. They can go once you are on next.39 or later (see below).

#### The forward fix: zfb `0.1.0-next.39`

Every scanner-visible shim above is interim debt for the next.38 scanner. zfb `0.1.0-next.39` (released 2026-06-12, after both 0.2.1 and 0.2.2 had shipped against next.38) adds `"use client"` island scanning for npm-dist packages (zfb #999 / PR #1001): islands inside a regular package under `node_modules` are registered and hydrated, resolved through that package's `exports` map.

> **Tip**
The scanner-visible `ThemeToggle` / `Toc` / `MobileToc` shims are no longer needed, and the interim shim debt can be retired. Note that 0.2.1 itself shipped against next.38 — next.39 is the follow-on engine fix, not part of this release.
> **Consumers**

### Features

- **Optional HMAC IP hashing for the AI-chat endpoint.** When the `IP_HASH_SECRET` Cloudflare secret is set, rate-limit and audit-log keys derive from HMAC-SHA-256(ip) instead of unsalted SHA-256, defeating hash reversal by IPv4 enumeration. Without the secret, behavior is unchanged — the step is optional and non-breaking (#2038).
- **Configurable `sandbox` prop on HTML Preview.** The preview iframe's sandbox attribute can now be configured per call site instead of being hardcoded (#2035).
- **Theme toggle: bare subpath, cross-instance sync.** `@takazudo/zudo-doc` ships the theme toggle as a bare subpath export with cross-instance state synchronization and a shiki peer dependency (#2012).
- **`pages/` and `plugins/` typecheck coverage.** The host's file-routed `pages/` and all six zfb engine plugins are now type-checked (`check:pages`; `check:plugins` via `@ts-check` JSDoc + `checkJs`), wired into both `b4push` and CI (#2018).

### Bug Fixes

- **zfb engine bumped to `0.1.0-next.38` with a warning-clean build.** Pins move from `0.1.0-next.35` across the host and generator. Two broken hierarchical anchors were fixed, e2e fixture trees are excluded from the host bundler walk (the now-functional `imageDimensions` feature otherwise stats fixture image refs against the host `public/`), and the `linkValidation` / `imageDimensions` docs were rewritten for the new behavior — the no-op `allowExternal` option was removed upstream, and `imageDimensions` now actually injects `width`/`height` (#2045).
- **Design-token panel state survives color-scheme toggles.** The theme toggle no longer wipes zdtp tweak state, and per-scheme `shikiTheme` survives the `toZdtpColorSchemes` conversion (#2037).
- **AI-chat history trust policy hardened and documented.** Strict `user`/`assistant` role whitelist, entry-count and per-entry length caps, smuggled-field stripping, and a recorded decision on the forged-assistant-turn residual risk (#2036).
- **Versioned-page metadata correctness.** Stale metainfo/tag chips are hidden on `/v/` pages, EN-fallback metainfo parity restored, tag URL segments are percent-encoded at every emitter, and view-source links honor the recorded source extension instead of assuming `.mdx` (#2022).
- **Sidebar and navigation fixes.** The root docs-index node is preserved through the sidebar-tree delegation (#2030), unsectioned pages fall back to the full nav tree, and content centers correctly when the sidebar is hidden via the toggle (#2002).
- **Generator input validation.** `create-zudo-doc` rejects a non-string preset `projectName` before the grammar check, dead template plugins were deleted, and project-name validation is centralized (#2013).
- **doc-history-server robustness.** Malformed percent-encoded slugs return HTTP 400 instead of crashing the server, `getDocHistory` remains exported as an async alias, and the server binds to localhost by default (#2011).
- **Theme-toggle island hydration.** The compiled island uses a named export so it actually hydrates (#2012).
- **Dev server: pinned port, watcher loop fixed.** `pnpm dev` pins port 4321 (failing fast on `EADDRINUSE`) and the `.claude/` watcher no longer triggers a symlink feedback loop (#2044).
- **Two full-project review waves.** Dozens of small correctness fixes: empty-slug falsiness sites, hook-order issues, header toggle mode, template i18n, an 8-item small-fixes batch, `Locale` literal-union type hygiene, and ai-chat route-handler fixture tests (#2008, #2020, #2025, #2034).

### Performance

- **Client hydration and search.** `SidebarToggle` hydration is gated with `when=visible`, sidebar node components are memoized, and search-index fields are pre-lowercased once at load time.
- **Build-time memoization.** Tag-map, footer taglist, and the md-plugins source-map are memoized, and the `check:links` dist walk was merged into a single pass.

### Security

- **`shell-quote` advisory resolved.** The transitive `shell-quote` dependency is overridden to `>=1.8.4` (GHSA-w7jw-789q-3m8p).
- **`.npmrc` trust policy tightened** from `any` to `no-downgrade`, with the rationale documented inline (#2039).

### Other Changes

- **Host-wide consolidation.** The nav-tree builder is deduped into the sidebar-tree package behind a bounded LRU cache (#2030), the sidebar resizer is consolidated to a single canonical implementation (#2029), the four doc catch-all routes share one module (#2010), a `useModalDialog` hook replaces four-way dialog plumbing, the ai-chat endpoint is split into focused modules, search-index/llms-txt utilities are deduped and honor frontmatter `slug` overrides (#2024), docs frontmatter has a single zod source of truth (#2016), and seven unused root dependencies were pruned.
- **CI: wrangler pinned to 4.98.0** while the Cloudflare `/subdomain` API failure (error 10013) on production deploys is handled by Cloudflare support (#2007). The failure is Cloudflare-side; uploads succeed and content deploys.
- **Documentation.** The stale pre-publish dev-workflow README section was replaced (#2005) and the consumer Tailwind safelist import is documented.

## [0.2.0] - 2026-06-09

First stable release of the `0.2.0` line. It promotes the `0.2.0-next.1` → `0.2.0-next.9` prerelease series to stable and moves the `latest` npm dist-tag from `0.1.0` to `0.2.0`, so a plain `npm install` / `pnpm dlx create-zudo-doc` now resolves the `0.2.0` line. `@takazudo/zudo-doc`, `@takazudo/zudo-doc-history-server`, and `create-zudo-doc` are released together in lockstep. The sections below aggregate the headline changes from the prerelease line; see the individual `0.2.0-next.N` notes for full detail.

### Breaking Changes

- **Removed the deprecated `colorTweakPanel` settings alias.** Projects must use `designTokenPanel` in `src/config/settings.ts`; configs still setting `colorTweakPanel` no longer have any effect (#1862).
- **Removed three unused public-surface vestiges from `@takazudo/zudo-doc`** (#1866): the `DesignTokenTweakPanel` theme stub (the panel UI lives in `@takazudo/zdtp`), the no-op `disableInlineVisibilityStyle` prop on `VersionSwitcherProps`, and the `TocItem` type alias (use `HeadingItem`).
- **Removed the deprecated `ai-chat-worker` package.** The AI chat API is served by the SSR `/api/ai-chat` endpoint; the standalone Cloudflare Worker package has been dropped.

### Features

- **`@takazudo/zudo-doc/icons` subpath export.** A shared icon module ships as a dedicated subpath export adopted across the framework; generated projects import `@takazudo/zudo-doc/icons` directly from npm (#1906).
- **Category metadata via `index.mdx` frontmatter.** The claude-resources generator emits `index.mdx` with `category_no_page` / `sidebar_position` frontmatter instead of `_category_.json` sidecars, eliminating the `unsupported data-file extension` build warning for consumers of the published package (#1980, #1978, #1985).
- **Package-generated CSS safelist.** `@takazudo/zudo-doc` generates `dist/safelist.css` at build and exposes it via a `./safelist.css` export, so Tailwind v4 builds in downstream projects keep dynamic classes (#1993, #1994).
- **Canonical root docs URL `/docs/`.** The root documentation page serves at a canonical `/docs/` via an optional-catchall route; search, llms.txt, and doc-history all canonicalize the bare root consistently (#1891).
- **Generic versioned + locale routing.** Versioned non-default-locale pages route through `/v/{version}/{locale}/docs/...` instead of a hardcoded `ja` path.
- **Hierarchical TOC heading IDs.** Adopted zfb's hierarchical heading-ID strategy and slugify so TOC anchors match rendered headings; TOC depth is configurable (#1943, #1946).
- **`noUncheckedIndexedAccess` enabled across the board** — root tsconfig, `packages/zudo-doc`, the standalone packages, and the `create-zudo-doc` templates, so fresh scaffolds inherit the stricter guards.
- **Hardened AI-chat API for non-demo deployments.** Added an origin allowlist, a global daily request limit, and prompt caching on the system corpus block so the endpoint is safe and cheaper to deploy beyond the demo (#1889).
- **OGP meta tags.** `HeadWithDefaults` emits `og:type`, `og:url`, and `og:site_name` (#1975).
- **b4push / CI parity meta-check.** A guard detects silent drift between local `b4push` and CI gates; fixture-drift, tags-audit, and design-token-lint are wired into `pr-checks.yml` (#1967, #1982).

### Bug Fixes

- **HTML Preview now hydrates into the correct vertical-stack layout.** Fixed an island double-wrap (an Astro→zfb migration regression) so host, template, and existing downstream scaffolds hydrate into the title-bar / preview / code stack with no call-site change (#1925).
- **CategoryNav no longer emits dead links for no-page categories.** In `categories=` mode, `category_no_page` cards now link to the category's first routed descendant (or are skipped); CI's `check:links` is strict (`--strict-broken`) to match `b4push` (#1985).
- **doc-history correctness.** Git commands run with the repo root as CWD; CI passes a clean repo-root-relative `--content-dir`; the `generate` command fails loud (non-zero) on partial git failures; and a generator semaphore deadlock was fixed (#1907, #1913).
- **Versioned-docs link & display correctness on `/v/` routes,** including localized nav on versioned-locale pages and history/cross-link resolution (#1916, #1909).
- **doc-history postBuild made opt-in** (`GEN_DOC_HISTORY=1`), so a plain `pnpm build` no longer risks exceeding zfb's postBuild budget on large corpora; CI and dev are unaffected (#1986).
- **nav-source-cache memoization** now registers legitimately `undefined` results as cache hits (`sub.has(key)`), and **AI-chat audit-log keys** use `crypto.randomUUID()` to avoid same-millisecond collisions.
- **Scaffold-template parity fixes** across sidebar-toggle / theme-toggle templates, `@source` for the `zudo-doc` dist + inlined safelist, a real client-router bootstrap, and new `vsp-3xs` / `shadow-lg` tokens (#1991, #1990).

### Performance

- **doc-history.** Collapsed N+1 git spawns into batched calls and parallelized git-history walks via a new async path, cutting build time on large doc sets (#1875, #1930).
- **Navigation cache.** Identity-memoized the nav source and nav tree to cut redundant recomputation (#1902).

### Security

- **Resolved all 31 `pnpm audit` advisories (31 → 0).** Audit-driven cleanup of dev/build tooling transitives via `pnpm.overrides` and direct bumps, including `vitest` `3 → ^4.1.0` (the critical advisory has no 3.x patch). Verified green on typecheck, the full unit/package suites, and the production build (a5010712).

### Changes

- **New release pipeline + lockstep versioning.** The three publishable packages move together and a freshly scaffolded project pins the matching `@takazudo/zudo-doc` / `@takazudo/zudo-doc-history-server` release; prereleases publish under `next`, stable under `latest`.
- **Migrated design-token-lint** from the vendored `file:` dependency to the published `@takazudo/zudo-design-token-lint@^1.0.0` npm package; the `design-token-lint` bin name is unchanged (#1863).
- **Bumped zfb** across the host and generator pins through the prerelease line to `0.1.0-next.35` (CSS-pipeline, islands-scanner, and bare in-content `#anchor` resolution fixes).
- **Documentation-drift sweep & dead-code removal** across configs, docs, and orphaned Astro→zfb host files, plus added type-safety refactors and behavioral tests for the versioned routes and async doc-history path.

## [0.2.0-next.9] - 2026-06-08

A security-maintenance prerelease: an audit-driven cleanup that clears every open `pnpm audit` advisory. No product-facing behavior changed.

### Security

- **Resolved all 31 `pnpm audit` advisories (31 → 0).** Audit-driven cleanup of dev/build tooling transitives, since this repo has no Dependabot configured (a5010712).
  - Tier 1 — transitive leaves pinned via `pnpm.overrides` plus direct bumps: `picomatch>=4.0.4`, `postcss>=8.5.10`, `undici>=7.24.0`, `ws>=8.20.1`; scoped pins for dual-major trees (`yaml@2>=2.8.3`, `brace-expansion@2>=2.0.3`, `brace-expansion@5>=5.0.6`) to avoid force-upgrading the other major line; root `vite` `^7.3.1 → ^7.3.2`; search-worker `wrangler` `^4.0.0 → ^4.85.0` (dedupes miniflare onto patched `undici`/`ws`) and `@cloudflare/workers-types → ^4.20260424.1`.
  - Tier 2 — the critical `vitest` advisory has no 3.x patch (fixed `>=4.1.0` only), so `vitest` was bumped `3 → ^4.1.0` in `doc-history-server`, `md-plugins`, `search-worker`, and `zudo-doc` (matching root + `create-zudo-doc`, and dropping the vite-6 chain those pulled in).
  - Verified green on the final state: typecheck, 1336 unit/package tests, and the 260-page build.

## [0.2.0-next.8] - 2026-06-08

The Consumer Parity Fixes prerelease (epic #1974): the published `@takazudo/zudo-doc` package and `create-zudo-doc` scaffolds now match the showcase site. The headline change is the claude-resources generator switching from `_category_.json` sidecars to `index.mdx` frontmatter, which clears the `unsupported data-file extension` build warnings that downstream consumers saw against earlier prereleases (#1985). Also includes a package-generated CSS safelist, doc-history postBuild made opt-in, OGP meta tags, and several scaffold-template parity fixes.

### Features

- **Category metadata via `index.mdx` frontmatter.** The claude-resources generator now emits `index.mdx` with `category_no_page` / `sidebar_position` frontmatter instead of `_category_.json`, and the read side resolves category metadata from that frontmatter — eliminating the `unsupported data-file extension` warning for consumers of the published package (#1980, #1978, #1985). Hand-authored `_category_.json` files in the showcase were migrated to `index.mdx` to match.
- **Package-generated CSS safelist.** `@takazudo/zudo-doc` now generates `dist/safelist.css` at build and exposes it via a `./safelist.css` export; the scaffold template `@import`s it and a repurposed drift guard keeps it honest, so Tailwind v4 builds in downstream projects keep dynamic classes (#1993, #1994).
- **OGP meta tags.** `HeadWithDefaults` now emits `og:type`, `og:url`, and `og:site_name` (#1975).
- **b4push / CI parity meta-check.** Added a guard that detects silent drift between local `b4push` and CI gates, and wired fixture-drift, tags-audit, and design-token-lint into `pr-checks.yml` (#1967, #1982).

### Bug Fixes

- **CategoryNav no longer emits dead links for no-page categories.** In `categories=` mode, a `category_no_page` category has no route of its own, but the wrapper fabricated a `docsUrl(slug)` href — producing broken links (the Claude overview's `/docs/claude-md/`, `/docs/claude-skills/`, `/docs/claude-agents/`). Each such card now links to the category's first routed descendant page (and is skipped when the category has no reachable page). CI's `check:links` step is now strict (`--strict-broken`) to match `b4push`, so this class of regression fails CI instead of false-greening (#1985).
- **doc-history postBuild made opt-in.** Local builds now skip the per-page history-dropdown JSON generation by default (gated behind `GEN_DOC_HISTORY=1`), so a plain `pnpm build` no longer risks exceeding zfb's postBuild lifecycle budget on large corpora; CI and dev are unaffected (#1986).
- **`category_no_page` enumeration leaks.** Excluded `category_no_page` docs from tag aggregation, frontmatter preview, and (after locale merge) the tag/footer/sitemap enumerators; mirrored the same filter into the footer template twin (#1978).
- **claude-resources generator robustness.** Guarded against a reserved `index` slug collision, and restored `concepts` as a real landing page rather than a `category_no_page` header.
- **i18n doc-history fallback.** EN-fallback locale pages now use `defaultLocale` for their history data paths so history resolves correctly.
- **Scaffold-template parity.** Re-synced the sidebar-toggle / theme-toggle templates and re-armed the drift check; added `@source` for the `zudo-doc` dist plus an inlined safelist in the scaffold's `global.css`; collapsed multi-line `@source inline()` to a single line in the consumer template; shipped a real client-router bootstrap instead of the no-op stub; and added the `vsp-3xs` spacing + `shadow-lg` theme tokens (registered in the design-tokens manifest) (#1991, #1990).

### Changes

- **doc-history parallelization.** Made `getDocHistory` async so the CLI semaphore can parallelize git-history walks, with matching test mocks (sync child_process `spawn` export, E2E smoke fixture built with `GEN_DOC_HISTORY=1`).
- **Docs.** Documented the `GEN_DOC_HISTORY` local opt-in (EN + JA), the Tauri Mode 1 offline-reader build with `GEN_DOC_HISTORY=1`, and reconciled stale doc-history CI notes.

## [0.2.0-next.7] - 2026-06-07

A broad prerelease: hierarchical TOC heading IDs ported from zfb, `noUncheckedIndexedAccess` turned on across every package, versioned-docs link correctness, the zfb bump to `0.1.0-next.35`, and a large documentation-drift sweep.

### Features

- **Hierarchical TOC heading IDs.** Adopted zfb's hierarchical heading-ID strategy and ported its exact slugify so the TOC anchors match the rendered headings; the TOC slugger now shares a single counter, and TOC depth is configurable (restriction-only) (#1943, #1946).
- **`noUncheckedIndexedAccess` enabled across the board.** Turned the flag on in the root tsconfig, `packages/zudo-doc`, and the standalone package tsconfigs, fixing every resulting error; the same guards were synced into the `create-zudo-doc` templates so fresh scaffolds inherit them.
- **AI-chat prompt caching.** Added a prompt-caching breakpoint on the system corpus block to cut repeat-request cost.

### Bug Fixes

- **zfb `0.1.0-next.35` — bare in-content `#anchor` resolution.** Bumped the zfb pins (next.31 → next.35, via next.33/next.34) in lockstep; next.35 fixes resolution of bare `#anchor` links inside content (#1948).
- **Versioned-docs link & display correctness on `/v/` routes.** Fixed link resolution and display on versioned routes, and added the versioned directories to `resolveMarkdownLinks` and the doc-history base so cross-links and history resolve there too (#1916).
- **`extract-headings` slug fidelity.** Strip inline markdown before slugging for slug/text fidelity, and only slug `h2`–`h6` to match the renderer.
- **`preset-generator` constants.** Mirror the shared constants instead of importing across packages, avoiding a fragile cross-package dependency (#1919).
- **`escape-for-mdx`.** Restored compact self-closing tag escaping.
- **Request-boundary hardening.** Hardened the request boundary in the search worker and AI-chat handler, and documented the rate-limit/CORS/security divergences between them (#1931).
- **JA footer taglist anchor.** Repointed the Japanese footer-taglist i18n anchor to the translated heading.

### Changes

- **Parallelized doc-history git walks.** The pre-build doc-history pass now walks git history in parallel via a new async path, cutting build time on large doc sets (#1930).
- **Type-safety & route refactors.** Removed `as unknown as DocsEntry/DocPageEntry` casts, extracted a shared doc-route prop-builder + render shell (dedup canonical URL), and single-sourced the preset-generator scheme/lang/label constants (#1917, #1942).
- **Documentation-drift sweep.** Applied 10 reviewed doc improvements plus a t1–t8 batch correcting config/settings, AI-search, CI/deploy (Pages → Workers), b4push, component, markdown-feature, and reference docs (#1953–#1960, #1963).
- **Cleanup & tests.** Deleted orphaned Astro→zfb host files, and added behavioral URL-builder tests for versioned routes plus an `execFile` mock for the new async doc-history git path (#1916, #1917, #1920, #1928).

## [0.2.0-next.6] - 2026-06-06

A focused prerelease that fixes the HTML Preview component's post-hydration layout — an Astro-to-zfb migration regression — with a backward-compatible approach that keeps existing scaffolds working on upgrade.

### Bug Fixes

- **HTML Preview now hydrates into the correct vertical-stack layout.** On `/docs/components/html-preview/` the component re-parented its preview and code sections inside the title bar after hydration, producing a broken side-by-side layout. The root cause was an island double-wrap: the bare hydration target carried the outer wrapper's `displayName`, so the SSG island marker resolved to the self-wrapping export and the client hydrated one level off (the same class of bug fixed for Toc/MobileToc/Sidebar in #1355). The bare inner now carries its own name and marker (`HtmlPreviewWrapperInner`) while `HtmlPreviewWrapper` stays the public `` export — so host, template, and existing downstream scaffolds keep working with no call-site change and now hydrate into the correct vertical stack (title bar / preview / code) (#1925).

## [0.2.0-next.5]

Prerelease folding in the first round of the latest review-loop sweep — CI fail-loud hardening plus two correctness fixes — and the zfb bump to `0.1.0-next.31`.

### Bug Fixes

- **doc-history `generate` now fails loud on partial git failures.** The CI `generate` command counted per-file git errors but always exited 0, and its top-level call was unawaited — so a partial git failure shipped incomplete doc-history JSON behind a green CI. It now returns the error count, exits non-zero when any file fails, and surfaces a top-level rejection, matching the established fail-loud policy (#1907, #1913).
- **nav-source-cache memoization missed `undefined` results.** `memoizeDerived` keyed cache hits on `hit !== undefined`, so a legitimately `undefined` computed result never registered as a hit and recomputed on every call; switched to `sub.has(key)` (host file and the create-zudo-doc template kept in sync).
- **AI-chat audit-log key collisions.** Replaced the `Math.random()` collision suffix with `crypto.randomUUID()` to avoid silent same-millisecond key overwrites.

### Changes

- **zfb `0.1.0-next.31`.** Bumped the zfb pins across all sources (next.30 → next.31): CSS-pipeline and islands-scanner fixes — authored-CSS path when Tailwind is disabled, reproducible CSS-Modules scoped names (project-relative paths), dev-mode git-restore detection, Tailwind temp-file cleanup, and a near-miss `"use client"` directive scanner. No consumer-facing breaking change.

## [0.2.0-next.4]

Prerelease consolidating the Epic #1884 review-backlog sweep and the #1891 canonical `/docs/` root work, plus the latest zfb bump. Headline: `@takazudo/zudo-doc` now ships a published `./icons` subpath export, so freshly-scaffolded projects resolve `@takazudo/zudo-doc/icons` from npm.

### Features

- **`@takazudo/zudo-doc/icons` subpath export.** A shared icon module is published as a dedicated subpath export and adopted across the framework's components; generated projects import `@takazudo/zudo-doc/icons` directly (#1906).
- **Canonical root docs URL `/docs/`.** The root documentation page now serves at a canonical `/docs/` via an optional-catchall route; search, llms.txt, and doc-history all canonicalize the bare root to the empty slug so links target `/docs/` consistently (#1891).
- **Hardened AI-chat API for non-demo deployments.** Added an origin allowlist and a global daily request limit so the AI-chat endpoint is safe to deploy beyond the demo (#1889).
- **Generic versioned + locale routing.** Versioned non-default-locale pages route through `/v/{version}/{locale}/docs/...` instead of a hardcoded `ja` path.

### Bug Fixes

- **doc-history CLI returned 0 entries via `pnpm --filter`.** Git commands now run with the repo root as their working directory, so the generator produces entries regardless of invocation CWD (#1907).
- **Versioned nav ignored per-version locales.** The versioned branch of nav resolution now applies the locale-first + base-fallback merge, so header/sidebar nav on versioned-locale pages show localized labels and locale-only version pages (#1909).
- **doc-history content-dir resolution.** CI now passes the clean repo-root-relative `--content-dir` form (resolved via `INIT_CWD`), and a path that doesn't resolve to an existing directory fails loud instead of silently producing empty history (#1913).
- **doc-history concurrency.** Fixed a semaphore double-increment deadlock in the generator.
- **AI-chat modal accessibility.** Closed three screen-reader gaps in the modal.
- **Dependencies.** Bumped mermaid to 11.15.0 and added overrides to clear transitive advisories.

### Performance

- **doc-history.** Collapsed N+1 git spawns into batched calls (#1875).
- **Navigation cache.** Identity-memoized the nav source and nav tree to cut redundant recomputation (#1902).

### Changes

- **zfb `0.1.0-next.30`.** Bumped the zfb pins across all sources (next.29 → next.30).
- **Pin-parity coverage.** `check-pin-parity` now also covers the `packages/zudo-doc` zfb pins (#1885).
- **Dead-code removal & typing.** Removed orphaned content-override and plugin-shim code (#1893) and tightened types across content components and doc props.

## [0.2.0-next.3]

Compat-cleanup prerelease: removes the deprecated settings alias and vestigial public-surface stubs left from the zdtp migration, moves design-token-lint to a published npm package, and updates zfb to `0.1.0-next.28`.

### Breaking Changes

- **Removed the deprecated `colorTweakPanel` settings alias.** Projects must use `designTokenPanel` in `src/config/settings.ts` — the alias is gone and configs still setting `colorTweakPanel` no longer have any effect (#1862).
- **Removed three unused public-surface vestiges from `@takazudo/zudo-doc`** (#1866): the `DesignTokenTweakPanel` theme stub (the panel UI lives in `@takazudo/zdtp`), the no-op `disableInlineVisibilityStyle` prop on `VersionSwitcherProps`, and the `TocItem` type alias (use `HeadingItem`).

### Changes

- **Migrated the design-token-lint dependency** from the vendored `@zudolab/design-token-lint` (`file:`) to the published **`@takazudo/zudo-design-token-lint@^1.0.0`** npm package. The bin name is unchanged (`design-token-lint`), so existing lint scripts keep working (#1863).
- **Bumped zfb to `0.1.0-next.28`** across the host project and the generator pins (#1870). `0.1.0-next.27` is deliberately skipped — its published `zfb-adapter-cloudflare` tarball omitted `emit-worker.mjs` and crashed every adapter consumer at build time; the packaging fix shipped in next.28.
- **Docs cleanup.** Purged dead historical/migration narration from configs and docs (#1861, #1867) and removed the reference pages for the deleted `ai-chat-worker` package (#1860).

## [0.2.0-next.2]

Maintenance prerelease focused on internal cleanup and release-pipeline hardening. No user-facing API changes.

### Changes

- **Removed the deprecated `ai-chat-worker` package.** The AI chat API is served by the SSR `/api/ai-chat` endpoint; the standalone Cloudflare Worker package has been dropped from the repository.
- **Release-pipeline hardening.** Internal `@takazudo/zudo-doc*` scaffold pins are now guarded against drift, publishable-package unit suites and the root unit suite run in PR CI, and the pin-parity check restores its file-path guidance on failure.

## [0.2.0-next.1]

First prerelease published on the project's new release pipeline. It supersedes the earlier `0.1.0` publish and re-launches versioning on the `X.Y.Z-next.N` prerelease scheme.

### Changes

- **npm release channels.** Prereleases are published under the `next` dist-tag. During the prerelease phase, `latest` also tracks the newest prerelease so `npm install` is never left on a stale version; this self-disables automatically once a stable release is published.
- **Lockstep versioning.** `@takazudo/zudo-doc`, `@takazudo/zudo-doc-history-server`, and `create-zudo-doc` move together, and a freshly scaffolded project pins the matching `@takazudo/zudo-doc` release.

## [0.1.0]

Initial release of zudo-doc.

### Features

- zfb static site generator with MDX content collections
- Tailwind CSS v4 design token system with 16-color palette
- Sidebar navigation with auto-generated tree from file structure
- i18n support (English and Japanese)
- Admonition components (Note, Tip, Info, Warning, Danger)
- Code highlighting with Shiki
- Table of contents with scroll spy
- Color scheme switching with multiple built-in themes
- Search functionality
