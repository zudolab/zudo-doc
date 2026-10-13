# Current-toolchain reconciliation — 2026-10-13

Baseline inspected: main 657bf97f6eda70382a715bb5940e0afc169f2205. Read-only preflight preceded the maintenance changes below.

## First-party report BEFORE edits

Public skill and resolve-bumps script fetched from Takazudo/claude-settings/main. Public script matches installed snapshot SHA256 05ead714531b976b8739f15c69b94a1a0012e308a844c1b9d28c3206187148ed. Read skill plus upstream-impact and provenance references. Ran unmodified resolver with --dry-run --json and writable temporary npm cache.

Evidence: /tmp/4575-first-party-resolution.txt (full 8-manifest report and JSON); /tmp/4575-public-bump-skill.md; /tmp/4575-public-resolve-bumps.mjs.

Result: 17 up-to-date rows, 4 skipped, 4 mechanically suggested bumps, zero errors after cache recovery. ALL 4 suggested bumps are excluded: three historical #4483 reproduction ZFB4.2.1 declarations and history-server ^6.0.0 minimum peer. No active first-party bump.

Current npm latest: ZFB/runtime/md-wasm/adapter 4.4.0; zdtp0.8.6; mdx-formatter1.3.0; design-token-lint2.1.0; zudo-doc/history-server6.1.1. Preserve workspace:* self-consumption and history-server devDependency; optional peers; zdtp ^0.5.2 || ^0.6.0 || ^0.7.0 || ^0.8.0; package release versions and internal scaffold ^6.1.1 pins.

Manifest census: root plus four packages; active scripts/migration-4097/fixtures/consumer-pins; target-manifest test fixture; archived docs/findings/4430-zfb3-migration/4483-heading-ids/project-template. Exactly three tracked independent pnpm lockfiles: root, #4097, archived #4483. Active #4097 has ZFB/runtime4.4.0 and Hono4.13.13 already. Do not normalize its descriptive historical project name or approvedBaseline.

Scaffold constants in packages/create-zudo-doc/src/scaffold.ts match active manifest pins: ZFB family4.4.0, zdtp0.8.6, ZUDO_DOC_PIN ^6.1.1 and history-server ^6.1.1. No root ZUDO_DEPS_PINS.md, no newly copied upstream artifact requiring one. Repository-owned generator/template provenance remains its own source and parity checks.

## Read-only verification

PASS node scripts/check-pin-parity.mjs (explicitly validates preserved peer floor), node scripts/check-fixture-settings-drift.mjs, node scripts/check-chrome-bindings-fixture-drift.mjs, bash scripts/check-template-drift.sh (two existing ignored-null-byte warnings).

First pnpm audit used unintended shell fallback11.19.0; repeated with /tmp/zudo-toolchain/node_modules/.bin/pnpm10.30.3 and reproduced identical nine advisory IDs. Authoritative evidence: /tmp/4575-prod-audit-pnpm10.json. The production-only audit includes these paths; its finding records omit dev/optional flags. Direct SDK and parser paths are production dependencies; KaTeX is a direct showcase dependency and optional package peer. Classification is dependency reachability, not proven exploitable application paths.

- hono moderate GHSA-gqvv-2mrq-wpjv: Hono: Incomplete fix for CVE-2026-39408: `toSSG()` still writes files outside the output directory; vulnerable <4.13.5; patched >=4.13.5. Locked 4.13.1; paths .>@modelcontextprotocol/sdk>hono. 
- hono moderate GHSA-g6gw-c38x-mqfc: Hono: Unbounded dot-notation nesting in `parseBody()` can cause memory exhaustion; vulnerable <4.13.5; patched >=4.13.5. Locked 4.13.1; paths .>@modelcontextprotocol/sdk>hono. 
- hono moderate GHSA-crvj-82cr-hjcx: Hono: Query parser reads parameters after the URL fragment, causing cache-key and proxy interpretation differentials; vulnerable <4.13.5; patched >=4.13.5. Locked 4.13.1; paths .>@modelcontextprotocol/sdk>hono. 
- fast-uri high GHSA-qw65-cvwx-89v3: fast-uri vulnerable to authority injection via an unvalidated port in serialize; vulnerable >=3.0.0 <3.1.7; patched >=3.1.7. Locked 3.1.6; paths .>@modelcontextprotocol/sdk>ajv>fast-uri. 
- fast-uri high GHSA-58mr-gqgx-xq4g: fast-uri vulnerable to host confusion via an unclosed bracket in the URI authority; vulnerable =3.1.6; patched >=3.1.7. Locked 3.1.6; paths .>@modelcontextprotocol/sdk>ajv>fast-uri. 
- fast-uri moderate GHSA-hrr3-gc8f-f4qj: fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets; vulnerable >=3.0.0 <3.1.8; patched >=3.1.8. Locked 3.1.6; paths .>@modelcontextprotocol/sdk>ajv>fast-uri. 
- hono moderate GHSA-hxh3-vqpv-xpqv: hono/jsx renders plain strings unescaped in boundary components, leading to XSS; vulnerable <4.13.7; patched >=4.13.7. Locked 4.13.1; paths .>@modelcontextprotocol/sdk>hono. 
- smol-toml moderate GHSA-r4xh-jqrq-34v2: smol-toml: Quadratic-time parse() from parseKey rescanning to end of document on each key line; vulnerable <=1.8.0; patched >=1.9.0. Locked 1.8.0; paths packages__zudo-doc>smol-toml. 
- katex low GHSA-238p-pmpm-9mq7: KaTeX: Existing prototype pollution can bypass trust restrictions; vulnerable >=0.11.0 <0.18.2; patched >=0.18.2. Locked 0.16.38; paths .>katex. 

## Minimal supported maintenance recommendation

1. Tighten root existing fast-uri@3 override from >=3.1.5 <4 to >=3.1.8 <4; do not migrate latest4.2.2.
2. Bump package smol-toml compatible runtime range ^1.8.0 to ^1.9.1 so new npm consumers receive fixed parser. The reproduced advisory reports >=1.9.0; 1.8.1 is not published. Supported versions are 1.9.0/1.9.1.
3. Target root lock Hono4.13.13, fast-uri3.1.8, smol-toml1.9.1. Hono is compatible with ZFB runtime ^4.12.25, SDK ^4.11.4 and node-server ^4. No upstream major migration. Existing active #4097 Hono4.13.13 needs no lock change.
4. Use bounded Hono/fast-uri overrides and normal `pnpm install --lockfile-only --ignore-scripts`, then frozen and ordinary installations. A recursive update refreshed unrelated optional packages and was discarded.
5. Run package codex-resources generate/index tests (TOML owner), MCP/worker contracts (SDK/Ajv/Hono owner), relevant package/build/type/prepack/pin/template tests and required b4push/CI. Keep #4576 hold intact; do not change its KaTeX declarations.

## Published tarball review

Downloaded exact published archives under /tmp/4575-tarballs; metadata /tmp/4575-candidate-metadata.json. No first-party bumps thus no first-party old/new surface delta.

- fast-uri3.1.6→3.1.8: package metadata only version changed. No engines/export/peer/dependency changes. Actual index.js fixes port authority injection, malformed/unclosed bracket host validation and percent-encoded reg-name lowercase normalization. No CSS or generated template assets.
- Hono4.13.1→4.13.7: minimum advisory floor, stable existing exports and Node>=16.9.0. Hono4.13.13 additionally reviewed because #4097 already resolves it: no removed or changed export mappings, one new ./mount entry; same engines, no dependencies/peers. Tooling scripts/dev dependencies change, no imposed consumer build config/CSS changes.
- smol-toml1.8.0→1.9.1: same exports/main/types/engines(Node>=18), no deps/peers. New optional parse options useLegacyDate defaults true and unsafeKeyBehaviour defaults keep; all tables now Object.create(null). Consumer isRecord permits null-prototype records; config renderer retains TomlDate default. New parser bounds key scan and supports BOM. Existing named APIs retained, default export deprecated. No consumer config migration required, but owning-path tests essential due parser behavioral changes.

No claim of complete upstream security audit or browser CDN dependency graph audit. Nine findings apply to the unmodified baseline SHA above, before maintenance or held KaTeX work is integrated. No independent installation or b4push done by read-only agent.

## Supplemental integrity and full-dependency classifications

- SHA256 fast-uri/3.1.6/archive.tgz: `264af0e32c4b7b7bcb9ce5b4623c82469ee3e69ba5d171920f1762d626db1064`
- SHA256 fast-uri/3.1.8/archive.tgz: `86be033b406a7737c0521edc8fe3e15c7ac0cb6b5e509478cc9539a2efaa086c`
- SHA256 hono/4.13.1/archive.tgz: `4cbe6e7fa266e186e972c1d7ac36157ad8f202da1031dc68a2c3b9ad226cf96e`
- SHA256 hono/4.13.13/archive.tgz: `3c656fb527641e841e1c4dae1d2faa238a4e17dde37f1620d5b72172caaddac0`
- SHA256 hono/4.13.7/archive.tgz: `f65df37793984664c02158c11575ebaf922bc50ef2de36dfa96f311519c5e95d`
- SHA256 smol-toml/1.8.0/archive.tgz: `1fc995be91cdb777fc13e20c2edfebaaf60ef4e4d2d5331caef2837b04d37892`
- SHA256 smol-toml/1.9.0/archive.tgz: `4909da857f775ea729461e552fdc85966e7825c1020605066b3a9ad29642dbdc`
- SHA256 smol-toml/1.9.1/archive.tgz: `4ac8392f1918c22a4366be19047cf53aa42646077d4c711b2ef73263beefb172`

Full audit evidence /tmp/4575-all-audit-pnpm10.json (root lock while manager may be preparing edits; do not infer final lock state).

GHSA-gqvv-2mrq-wpjv: 4.13.1 dev=None optional=None paths=['.>@modelcontextprotocol/sdk>hono']

GHSA-g6gw-c38x-mqfc: 4.13.1 dev=None optional=None paths=['.>@modelcontextprotocol/sdk>hono']

GHSA-crvj-82cr-hjcx: 4.13.1 dev=None optional=None paths=['.>@modelcontextprotocol/sdk>hono']

GHSA-hxh3-vqpv-xpqv: 4.13.1 dev=None optional=None paths=['.>@modelcontextprotocol/sdk>hono']

Actual owning paths: smol-toml is a declared zudo-doc production dependency but its inspected consumers parse local project .codex/config.toml and agents/*.toml at build-time (plugins/internal/codex-resources/config.ts and agents.ts). Hono is reached through zfb-runtime and MCP SDK production graph; SDK Ajv schema validation reaches fast-uri. Any Wrangler/miniflare path is development/build infrastructure. No direct owned parseBody/toSSG/Hono JSX use demonstrated; audit path alone does not prove remote exploitability.

Baseline `git show 657bf97f:pnpm-lock.yaml` confirms NO Hono edge from miniflare: miniflare4.20260710.0 and5.20261006.1-alpha depend on source-map-support/sharp/undici/workerd/ws/youch. All baseline `hono: 4.13.1` edges are node-server, MCP SDK, ZFB runtime. Thus no additional Hono dev-only miniflare path demonstrated here. Full audit captured during manager maintenance and omitted fixed fast-uri/smol-toml; use pre-edit production report as baseline and manager final audit for completion, not this intermediate snapshot.

## Maintenance implementation

Normal pnpm install resolved Hono 4.13.13, fast-uri 3.1.8 and smol-toml 1.9.1. Added a bounded `hono@4: >=4.13.7 <5` override and tightened existing fast-uri 3 floor; smol-toml runtime declaration is `^1.9.1`. A recursive update attempt refreshed unrelated optional dependencies; it was discarded in favor of ordinary installation from the original lock. Only the three reviewed package resolutions changed. No first-party pins, historical locks or KaTeX declarations changed.

## Candidate verification

Node 22.23.3 / npm 10.9.9 / pnpm 10.30.3. Frozen baseline ignore-scripts install passed; patched normal frozen installation including lifecycle builds passed under heavy guard. Normal reinstall also passed with byte-identical workspace lock (`sha256sum -c`). Codex-resource generate/index plus MCP handler tests: 29 passed. Post-change `pnpm audit --prod --json`: only GHSA-238p-pmpm-9mq7 remains, KaTeX 0.16.38 at `.>katex` (one low; zero moderate/high). PR #4576 remains separately held at b11a06b221131eeb891c302879d5081fc088cdde; its changes are not on main. All 35 local b4push steps were attempted. Initial format failure passed after the commit hook formatted the notes; the published scaffold-pin check passed on rerun with `NODE_USE_ENV_PROXY=1`. Four unchanged run-parallel process-cleanup assertions fail locally and reproduce identically on clean main 657bf97f (6 pass/4 fail); candidate package tests otherwise report 3,570 passes. This local lane is deferred under existing issue #4534, not counted as passed. The separately rerun plugin-resolution/lifecycle smoke passed. Manual interactive smoke was skipped. Hosted run 38374018425 at candidate 66bfc3b passes all jobs except A2 (three strict fingerprint assertions, 17 functional assertions pass); its Package Unit Tests and E2E pass. A2 causal review and final current-head verification remain pending.

Root Hono/fast-uri overrides protect this workspace; they are not published downstream dependency constraints. The smol-toml floor ships only with a future authorized package release. Published 6.1.1 is unchanged. Audit snapshots below are retained with this report; temporary command logs are local evidence only.

Candidate workspace lock SHA-256: `8159313ba75f1299e56e841a95a2ae40ff72b8a6a858b551274e26450586cf0f`.
