# Installed three-package acceptance (2026-10-10)

Evidence file for sub-issue #4509 (epic #4502, owner #4475). The candidate source is `3632c7482fbaf3eb49167c8946c2ca1691ecee75` on `base/zfb3-migration`, which includes #4503–#4508 and the #4507 sidebar fix. The harness lives in `scripts/zfb3-parity/installed-consumer/`. Tarballs, the CLI prefix and both consumers were kept outside the repository in a session scratch directory (`.../scratchpad/closeout-4509/`). The JSON reports and logs are copied to `$DROPBOX_CCLOGS_DIR/zudo-doc/closeout-4509/`.

## Required checks pass on both consumers; one extra non-root check fails (#4513)

The barebone run passed 12/12 checks and the all-feature run passed 19/19. The non-root control passed every required check: assets, navigation and search. One extra check failed: agent-export URLs under the relocated base return 404. That is a genuine product defect, filed as #4513. It is not fixed here.

## Commands and exits

Every build, pack, install and browser step ran in the foreground through `bash $HOME/.claude/scripts/heavy-guard.sh --wait 540 -- <cmd>`. The guard never denied a step. Each step got `verdict=PASS`, apart from the runs whose own checks failed, listed below.

| Step | Command (cwd) | Exit |
| --- | --- | --- |
| Build workspace + generator | `pnpm build:workspace && pnpm --filter create-zudo-doc build` (worktree) | 0 |
| Pack | `pnpm pack --pack-destination <tmp>/tarballs` in `packages/{doc-history-server,zudo-doc,create-zudo-doc}` | 0 |
| Install initializer | `npm i -g --prefix <tmp>/cli <tmp>/tarballs/create-zudo-doc-5.28.2.tgz` | 0 |
| Generate barebone | `<tmp>/cli/bin/create-zudo-doc barebone --yes --lang en --color-scheme-mode light-dark --pm pnpm --no-install --git` + every `--no-<feature>` flag | 0 |
| Generate all-feature | `<tmp>/cli/bin/create-zudo-doc allfeat --yes --lang en --additional-langs ja --color-scheme-mode light-dark --pm pnpm --no-install --git --github-url https://github.com/example/allfeat` + every feature on except `--no-mcp --no-tauri --no-tauri-dev` | 0 |
| Point at tarballs | `node prepare-consumer.mjs <consumer> <tmp>/tarballs` (both) | 0 |
| Install | `pnpm install` (each consumer) | 0 / 0 |
| Build | `GEN_DOC_HISTORY=1 pnpm build` (barebone 16 pages, all-feature 48 pages) | 0 / 0 |
| Isolation/versions | `node inspect-consumer.mjs <consumer> <tmp>/tarballs [--zdtp-ref <tmp>/zdtp-ref]` | 0 / 0 |
| Browser, barebone | `node run.mjs preview <tmp>/consumers/barebone barebone <json> --port 4391` | 0 |
| Browser, all-feature | `node run.mjs preview <tmp>/consumers/allfeat allfeat <json> --port 4392` | 0 |
| Non-root build | `node build-mount-control.mjs <tmp>/consumers/allfeat /nested/docs/ <tmp>/mount-docroot` | 0 |
| Non-root browser | `node run.mjs mount <tmp>/mount-docroot /nested/docs/ allfeat <json> --port 4393` | 1 (#4513) |

The generated content is one flat category, so `prepare-consumer.mjs` adds the nested tree from `e2e/fixtures/sidebar/src/content/docs/guides` and a `Guides` headerNav entry. Broaden/Restore and branch focus need a configured nested tree. MCP and Tauri were left off the all-feature consumer. MCP is a Cloudflare deployment preset and would change the output into an adapter build. Tauri is a platform-bound macOS wrapper.

Some early browser runs failed because of bugs in the harness itself, not in the product:

- Back navigation was asserted before the client router's popstate swap had landed. The check now waits for the swapped URL and heading.
- The teardown leak scan counted the harness's own `heavy-guard` launcher processes as leaks. It now excludes them.
- The mount assets check referenced `location` in Node.

Each fix made the assertion more precise. None weakened it. The final runs above used the committed harness.

## Candidate hashes

| Tarball | SHA-256 |
| --- | --- |
| `takazudo-zudo-doc-history-server-5.28.2.tgz` | `23a7ba872fcda70c4addedc118c626b63606b2a00573a3cef9e298c27b273893` |
| `takazudo-zudo-doc-5.28.2.tgz` | `c4ce5d5e1a305467c648dd2639f4e160a29ca9f78d547decbfcab43f614a3757` |
| `create-zudo-doc-5.28.2.tgz` | `27e1d335a29d88efb94cb276e8d8708de563e13ba91097a66a98767e6e081c63` |

Version 5.28.2 is already on npm, so `prepare-consumer.mjs` sets `file:` tarball dependencies **and** `pnpm.overrides` for both packages. Without that, a registry copy of the same version could win. In each lockfile, the `@takazudo/zudo-doc` (and, for the all-feature consumer, `@takazudo/zudo-doc-history-server`) resolution integrity equals the SHA-512 of the candidate tarball.

## No workspace links: everything else comes from the registry

`inspect-consumer.mjs` passed every check on both consumers: 10 for barebone and 11 for all-feature.

- Neither lockfile contains `link:` or `workspace:`, and neither contains the repository path.
- `pnpm ls --depth Infinity` walked 73 nodes (barebone) and 80 nodes (all-feature). No path pointed inside the repository.
- There is a single `@takazudo/zfb@4.3.0` and a single `@takazudo/zfb-runtime@4.3.0` on disk. `@takazudo/zfb` owns zudo-react.
- The consumer root, the installed `@takazudo/zudo-doc` and `@takazudo/zfb-runtime` all resolve the same zfb realpath. That gives a single runtime identity. In the browser, exactly one `islands-<hash>.js` entry module loaded on each consumer.

| Consumer | pnpm / Node | zfb family | `@takazudo/zudo-doc` | history-server | zdtp (root / resolved from installed zudo-doc) | preact |
| --- | --- | --- | --- | --- | --- | --- |
| barebone | 10.30.3 / v24.13.1 | zfb, zfb-runtime, zfb-md-wasm, linux-x64-gnu, slugify all 4.3.0; CLI `zfb 4.3.0` | 5.28.2 (candidate tarball) | not installed (feature-gated) | not installed | not installed |
| all-feature | 10.30.3 / v24.13.1 | same, all 4.3.0 | 5.28.2 (candidate tarball) | 5.28.2 (candidate tarball) | 0.8.5 / 0.8.5 (single store dir `@takazudo+zdtp@0.8.5_preact@10.29.8`) | 10.29.8 |

## The built panel loads zdtp 0.8.5

- **On disk:** the all-feature consumer has exactly one zdtp copy, 0.8.5. The bare `@takazudo/zdtp` import in the installed `zdtp-loader` resolves to that copy. There is no workspace symlink, so the 0.8.0 split in the showcase cannot occur in a published install.
- **In the bundle:** the extracted `npm pack` trees of 0.8.0, 0.8.5 and 0.8.6 were compared by their word-like string literals. The 0.8.5 and 0.8.6 `dist/` directories are **byte-identical**: they differ only in `package.json`, CHANGELOG, README and PORTABLE-CONTRACT. A bundle therefore cannot tell them apart; the installed copy (0.8.5) settles it. The 0.8.5/0.8.6-only literal `tokenpanel-palette-check-base-row tokenpanel-palette-check-row--modes` appears in `dist/assets/islands-chunk-SDUIQ3KF.js`. No 0.8.0-only literal appears anywhere in `dist/`.
- **At runtime:** the first panel open fetched exactly `islands-chunk-YAVNACDL.js` and `islands-chunk-SDUIQ3KF.js`. So the browser loads the 0.8.5 bundle lazily, on first toggle. The barebone `dist/` contains no `tokenpanel` code.

## Per-check results

Chromium 145.0.7632.6 (repository Playwright). Every run ended with no console or page errors and no failed same-origin requests.

| Check | Barebone | All-feature |
| --- | --- | --- |
| Hydration: every island marker mounts | PASS (4: SidebarToggle, ThemeToggle, SidebarTree, MermaidEnlarge) | PASS (9: adds DesktopSidebarToggle, DocHistory, DesignTokenPanelBootstrap, ThemePackSwitcher, ImageEnlarge) |
| Single runtime identity (one islands entry; one zfb on disk) | PASS | PASS |
| Hard reload re-mounts islands | PASS | PASS |
| Navigation to Installation re-mounts islands | PASS (full document navigation; dynamicPageTransition off) | PASS (client swap, `zfb:after-swap`) |
| Back navigation | PASS | PASS (popstate swap) |
| 06R Broaden → highest tree (Broaden disabled, Restore shown) → Restore | PASS (15 → 16 → 15) | PASS (15 → 18 → 15) |
| 06R branch focus narrows, Restore undoes, URL/article unchanged | PASS (15 → 12 → 15) | PASS (15 → 12 → 15) |
| Search | PASS: absent as configured (no dialog) | PASS: Ctrl+K, result → 200, Escape closes |
| Theme Dark/Light, persisted across reload and navigation | PASS | PASS |
| DTP opens exactly one panel, zdtp loaded on first open | n/a | PASS |
| DTP token edit applied (`--spacing-hsp-lg` 1rem → 3rem) | n/a | PASS |
| DTP persistence: hard reload with panel closed re-applies with no click | n/a | PASS |
| DTP reconfiguration: color-scheme change keeps one open panel; override back on return | n/a | PASS |
| DTP reconfiguration: theme-pack switch hides the override (academia = 1rem), restores it on return | n/a | PASS |
| DTP close/reopen ×3 + client navigation never duplicates the mount (shell counts 1,0,1,0,1,0,1,1) | n/a | PASS |
| i18n `/ja/` route hydrates with `lang=ja` | n/a | PASS |
| No console/page errors; no failed same-origin requests | PASS | PASS |
| Teardown: preview process group gone, port free | PASS | PASS |

Barebone still serves a `/search-index.json` (200) with search off. Nothing references it, and it is not counted as a failure.

## Every server was torn down and its port freed

`run.mjs` starts the server detached in its own process group and records the tree while it runs. It then sends SIGTERM to the group and proves four things:

1. No member of the group survives.
2. No process has its cwd or argv in the served directory (the harness's own launchers excluded).
3. The port can be bound again.
4. A connection is refused.

| Run | Tree while running | Signal needed | Survivors / leaked holders | Port free / refused |
| --- | --- | --- | --- | --- |
| barebone :4391 | `zfb.mjs preview`, native `zfb-linux-x64-gnu/zfb preview`, `plugin-host.mjs` | SIGTERM | 0 / 0 | yes / yes |
| all-feature :4392 | same three processes | SIGTERM | 0 / 0 | yes / yes |
| mount :4393 | `static-mount-server.mjs` | SIGTERM | 0 / 0 | yes / yes |

An independent check after all runs found nothing listening on 4391–4393 (`ss -ltn`) and no running `zfb preview`, `static-mount-server` or `zfb-plugin-host` process.

## Non-root control: assets, navigation and search resolve; agent export 404s (#4513)

`build-mount-control.mjs` builds the all-feature consumer with `base: "/nested/docs/"` and `copyPublicWithBase: false`. This is zfb's documented whole-output relocation contract; see `parity/4.2.1/base-path-controls.md`. The script restores the original `zfb.config.ts` afterwards and relocates the whole output under `<docroot>/nested/docs/`. `static-mount-server.mjs` serves it, because native preview does not strip base. That is a known limitation, not a task.

| Check | Result |
| --- | --- |
| Stylesheet/script refs under the base; 9 islands mount | PASS |
| Sidebar navigation stays under the base (client swap, 12 islands) | PASS |
| Search index loads; result link `/nested/docs/docs/getting-started/introduction` → 200 and navigates | PASS |
| Header site-name link `/nested/docs/` → 200 | PASS |
| No console/page errors; no failed same-origin requests | PASS |
| Teardown | PASS |
| Extra: `llms.txt` / agent-export links resolve under the base | **FAIL**: `/nested/docs/agent/v1/manifest.json` and the page links → 404 |

The failure is a real product defect. `emitAgentCorpus` always writes `outDir/<base>/agent/v1` and ignores `copyPublicWithBase: false`, so after relocation the export is served at `/nested/docs/nested/docs/agent/v1/`. Filed as #4513 (`agent-found`). It is not fixed here because this topic is verification only.

## Fix for #4513

Source SHA `db8e8495d` (branch `zfb3-closeout/4513-agent-export-base`). `emitAgentCorpus` now takes `copyPublicWithBase`; the `agent-export` plugin passes `ctx.config.copyPublicWithBase`. When it is `false`, `agent/v1` is written to `<outDir>/agent/v1` (unprefixed, like the search index and llms.txt). Unset or `true` keeps `<outDir>/<base>/agent/v1`, and root base is unchanged. Advertised URLs keep the `<base>agent/v1/` form, so they resolve after whole-output relocation. The dev middleware already serves at the base route and needed no change.

| Step | Command | Result |
| --- | --- | --- |
| Unit | `pnpm exec vitest run src/plugins/internal/agent-export` (in `packages/zudo-doc`) | 12 passed (root, non-root unset/true, non-root false) |
| Rebuild + pack | `pnpm build:workspace`, `pnpm --filter create-zudo-doc build`, `pnpm pack` x3 | `compiled.css` unchanged |
| Non-root build | `node build-mount-control.mjs <consumer> /nested/docs/ <docroot>` | `dist-mount/agent/v1/manifest.json` (before: `dist-mount/nested/docs/agent/v1`) |
| Non-root browser | `node run.mjs mount <docroot> /nested/docs/ allfeat <json> --port 4393` | before: exit 1 (#4513); after: 8/8 PASS, `llms.txt / agent-export page links` 11 links, manifest 200 |
| Root sanity | `pnpm build` + `run.mjs preview` | `dist/agent/v1/manifest.json` present; 13 PASS |

Harness notes. All runs went through `heavy-guard.sh --wait 540 --`. When the served docroot path appears literally in the guard's argv, the teardown leak scan counts the guard's watcher subshells and fails; passing the paths through `sh -c '... "$S/..."'` avoids it. The root sanity run showed 6 DTP failures because the consumer generated for this check did not get the design-token-panel feature (the feature flags did not take effect here and `agentExport` was added to `zfb.config.ts` by hand); those are unrelated to the agent export.
