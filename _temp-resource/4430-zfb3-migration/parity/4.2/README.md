# Published zfb 4.2 parity checkpoint

Baseline: reconstructed exact main `337b9f110793dccb4759bddd5273eab38cd9d2f0`; historical sealed cache absent. Current: `84333fa7e14a84ed05c9c1bd20281e4ca3e070be`. Both use the CI-faithful `scripts/parity-build.sh`.

- Static: 2,366 raw hard differences, zero advisory, 787 shared HTML routes. `static-summary.json` summarizes the 249 MiB local full report; no raw oversized output or screenshots are committed.
- Browser: system Chromium 151, actual local site captures, 64 states each; 35 computed-style differences. `browser-v2.json` and `browser-v4.json` include one explicit Mermaid-enlarge timeout apiece. These are FAIL/INCOMPLETE, not accepted parity. Default capture is at load, not a universal mounted-state assertion; fixture hydration/E2E is a separate gate.
- Browser harness: temporary copy of the repository script sets the installed executable, records errors and continues independent states. It preserves failing exit status and saves partial reports. Screenshots remain local under `/tmp/zudo42-parity/browser-{v2,v4}/`.
- An explicit-proxy experiment returned a forbidden error page for loopback. Its misleading zero-difference captures are segregated under `/tmp/zudo42-parity/INVALID-proxy-*` and are **not** included here or accepted. Valid captures use the already-supported local connection; no network denial was bypassed.

See the permanent `docs/findings/4430-zfb3-migration/v4.2-integration.md` for implementation and release blockers. These measurements precede the frozen switcher-script fix and require affected-layer revalidation.


Follow-up controls: `child-styles-v2.json` / `child-styles-v4-before.json` identify the pre/code font-stack and versions-table padding differences. The initial triage is historical: the switcher watch gap is fixed in dee250e2, and the later child inspection supersedes its unexplained-code-height diagnosis. `validation-summary.json` records separate original full-browser and affected smoke/i18n/theme runs; these counts are not added into a fabricated full-suite pass. `zudo42-browser-ssr-repro.mjs` is a public-import reproduction for upstream4077, with its observed log.


Final stable product head: `b2ae738e4b4f22a9382874461e38a8af1f8c1c14`. `browser-v4-final.json` contains64states; comparison now has13differences (nine heading-link affordances and four navigation/sidebar size differences from added guides), down from35. Code geometry, admonition geometry and versions table differences are eliminated. Mermaid enlargement remains unavailable locally onbothversions; the capture correctly exits1, notPASS. `child-styles-v4-final.json` proves matching pre/code font and line boxes plus table padding/weight/heights.

A preceding build was contaminated by a concurrent git commit and produced HTML/client identity mismatch (7b3a8b626ce7420f versus3d5f98ad40630491). Its60state capture is excluded as invalid verification evidence. Holding HEAD unchanged, rebuilding and probing the actual root produced zeroerrors and6/6mounted home Islands; this final64state capture uses that stable output. Minimal repeated native static and adapter controls also passed. No upstream defect is claimed from the contaminated build. Keep manager integration and heavy verification serialized.
