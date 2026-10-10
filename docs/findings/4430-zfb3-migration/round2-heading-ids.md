# Round 2 heading IDs — #4483 / #4428

Classification: `intentional-fix`, for the migration release. The extractor now recognizes homogeneous CommonMark fences with up to three spaces, rejects backtick info containing backticks, and closes only on a sufficiently long same-character run followed by whitespace. Four-space/tab indented code is excluded from heading extraction and JSX state scanning.

Character references decode exactly once in ordinary masked heading text before restoring protected code spans and backslash escapes. The declared parse5 decoder supplies the full named table; parse errors preserve unknown names rather than decoding legacy prefixes. Numeric references use Markdown's scalar/control validity rules, including U+FFFD for C1 controls instead of HTML Windows-1252 remapping.

## Actual published native oracle

On 2026-10-09, the public `@takazudo/zfb-md-wasm/render` API reported version **4.2.1**, matching the selected published engine pin. Command, run before changing the helper:

```sh
PATH=/tmp/zudo-tools/node_modules/.bin:$PATH node docs/findings/4430-zfb3-migration/4483-heading-ids/native-probe.mjs
```

The permanent test fixture `src/__tests__/pages-lib/fixtures/heading-ids-4483/probe.mdx` holds named/multi-codepoint, numeric/invalid controls, unknown/incomplete, Unicode, escaped references/punctuation, inline code/spans, real fences and invalid closers, mixed runs, indented code, duplicates, nesting and h5/h6. The adjacent permanent `native-output.json` records the complete ordered **27 native IDs** and raw rendered HTML. This is native renderer evidence, not helper-generated expectations.

The pre-fix regression run returned **3 failures / 87 passes**: the helper returned only nine IDs, including `gt-1000ms`, `lt-2mm`, and the false `code-block-target`. Its full mismatch was captured in the temporary `_temp-resource/4430-zfb3-migration/4483-heading-ids/prefail.log` (not preserved; see `2026-10-10-probe-summaries.md`). After the fix the same focused suite passed **90/90**, comparing all ordered IDs against a fresh native render and the recorded native oracle.

```sh
PATH=/tmp/zudo-tools/node_modules/.bin:$PATH ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run src/__tests__/pages-lib/extract-headings.test.ts
PATH=/tmp/zudo-tools/node_modules/.bin:$PATH ZFB3_SOURCE_RESOLVE=1 pnpm --filter @takazudo/zudo-doc test src/toc/ src/toc-prepaint/ src/desktop-toc-toggle-island/ src/doc-page-shell/__tests__/toc-toggle.test.tsx src/doclayout/__tests__/doc-layout-with-defaults-toc-gating.test.tsx
```

The focused existing TOC regressions passed **62 tests across nine files**. Durable logs beside the migration probe: `focused.log` and `toc-focused.log`. An earlier argument-forwarding attempt began a broader package suite and was terminated; `/tmp/zudo-headings4483-toc.log` is not successful verification evidence.

## Manager built and packed proof — PASS

On 2026-10-09 the manager built and packed combined source head `05c35801` (heading integration commits `3f35` / `4337`, from worker commits `90fad516` / `e61fafca`). The package prepack contract passed. The actual candidate was `takazudo-zudo-doc-5.28.2.tgz`, SHA-256 **816d652b7c20b34412c9c03f368506168ef3b42e36de7fbb4847420b50102272**. The candidate version is still the migration checkout's 5.28.2; this is local candidate proof, not a release publication.

The no-stub scratch site's frozen install and native build passed: **four pages built in 2.84 seconds**, guard `verdict=PASS exit=0`. Actual built output and the installed packed public helper matched the complete **27 ordered native IDs**. Both actual TOC views yielded **46 links / 23 unique depth 2–4 targets**, all resolving to emitted IDs. The strict scaffold checker accepted all 27 authored valid anchors (including h5/h6), inspected 112 built internal links / 28 IDs, and separately returned exit 1 for planted `genuinely-missing` and `code-block-target` anchors with `missing target id`. Planting was undone after each check.

A subsequent cheap verifier run also asserted installed manifest names/4.2.1 engine versions and resolved real paths for `@takazudo/zudo-doc`, `@takazudo/zfb`, `@takazudo/zfb-md-wasm`, and `@takazudo/zfb-runtime`. Every path is inside `/tmp/zudo4483-native-probe/project/node_modules/.pnpm/`; none uses the workspace. The candidate manifest declares a local tarball, not a workspace dependency. `packed-provenance-verify.log` records those paths and the repeated passing assertions.

Raw evidence (temporary `_temp-resource/4430-zfb3-migration/4483-heading-ids/`, not preserved after #4476; the reproduction scripts now live in `docs/findings/4430-zfb3-migration/4483-heading-ids/`): `manager-build-pack.log` (workspace/prepack/guard), `packed-install.log` (initial resolution), `packed-build-verify.log` (frozen install/build/strict proof/guard), and `packed-provenance-verify.log` (installed paths plus complete proof). These are actual runs, not planned commands.

Manager commands used this environment:

```sh
export PATH=/tmp/zudo-tools/node_modules/.bin:$PATH
export NODE_USE_ENV_PROXY=1 NODE_OPTIONS=--disable-warning=UNDICI-EHPA
export npm_config_store_dir=/tmp/zudo-pnpm-store npm_config_cache=/tmp/zudo-npm-cache
```

From `/workspace/zudo-doc`:

```sh
bash "$HOME/.codex/scripts/heavy-guard.sh" -- bash -c 'set -e; pnpm build:workspace; pnpm --filter @takazudo/zudo-doc pack --pack-destination /tmp/zudo4483-native-probe; E2E_FIXTURES=smoke E2E_FORCE_REBUILD=1 bash e2e/setup-fixtures.sh' > /tmp/zudo4482-4483-build.log 2>&1
```

After setting the scratch manifest candidate dependency to `file:/tmp/zudo4483-native-probe/takazudo-zudo-doc-5.28.2.tgz`, the manager ran `pnpm install` from its project directory into `install.log`. Then, from `/tmp/zudo4483-native-probe/project`:

```sh
bash "$HOME/.codex/scripts/heavy-guard.sh" -- bash -c 'set -e; pnpm install --frozen-lockfile; pnpm build; node ../verify.mjs' > /tmp/zudo4483-native-probe/build-verify.log 2>&1
```

## Reproduction

The archived `project-template/` retains the tested manifest, lockfile, config, stylesheet, and actual scaffold checker; its candidate path is normalized to `file:../candidate.tgz`. No tarball, installed dependencies, or build output is committed. `setup-packed-probe.mjs` takes an explicit candidate tarball and a **new** scratch destination, copies the single canonical permanent probe/oracle there, and generates the 27 authored links from that oracle. Thus there is no second maintained fixture source. For the recorded tarball the archived lock integrity applies; a different candidate needs one `pnpm install` to update integrity before freezing.

From the repository root, with the environment above:

```sh
node docs/findings/4430-zfb3-migration/4483-heading-ids/setup-packed-probe.mjs /path/to/candidate.tgz /tmp/heading-4483-reproduction
pnpm --dir /tmp/heading-4483-reproduction/project install --frozen-lockfile
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm --dir /tmp/heading-4483-reproduction/project build
node docs/findings/4430-zfb3-migration/4483-heading-ids/verify-built-packed.mjs /tmp/heading-4483-reproduction
```

The verifier accepts the assembled scratch root, reads its copied canonical oracle, asserts real installed package provenance, and repeats complete ordered built/packed parity, both TOC views and positive/negative strict checking. Assembly and syntax checks passed without another heavy build; the manager's original build evidence above remains the build proof.

#4475 must recheck the final merged build. The permanent tests depend only on their adjacent fixtures; deleting `_temp-resource` in #4476 cannot break the suite. The native reproduction script reads those fixtures and writes the oracle only with explicit `--capture`; ordinary native reproduction is read-only. No archived headings, allowlists or compatibility shims changed.
