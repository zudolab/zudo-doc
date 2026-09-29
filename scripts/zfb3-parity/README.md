# Zfb 3 parity harness

The v2 reference is `main` at `337b9f110`, built CI-faithfully with `scripts/parity-build.sh`. Its `dist/` and every report belong under `$HOME/.cache/zudo-doc-zfb3-parity/v2-337b9f110/`. Keep screenshots and reports outside the repository.

## Static layers

Run `node scripts/zfb3-parity/compare.mjs --baseline "$HOME/.cache/zudo-doc-zfb3-parity/v2-337b9f110/dist" --current dist --output "$HOME/.cache/zudo-doc-zfb3-parity/current/static"` after each v2-prep or v3 verification build. The command emits JSON and Markdown, and exits 1 for route, island, normalized DOM, per-element class-set, or CSS inventory differences. Run the same command with the baseline dist as `--current` to prove a zero-diff reference. `normalize.test.mjs` covers protocol and quote normalization. Add approved class renames to `CLASS_RENAMES` or exact `route|DOM path|class` exceptions to `CLASS_ALLOWLIST` in `compare.mjs`, each with an issue reference.

The DOM layer parses HTML with parse5, sorts attributes, and excludes classes, zfb transport/protocol/build metadata, props JSON, and zudo-react markers. Islands retain their name, DOM location and key-sorted props. CSS records selector and custom-property sets, media rules, and layer order. A changed DOM route should be reviewed before updating any allowance.

## Browser layers

Run `node scripts/zfb3-parity/browser.mjs --dist dist --output "$HOME/.cache/zudo-doc-zfb3-parity/current/browser"` on each built tree. It serves `dist/` on an ephemeral local port using the same static-server and Chromium pattern as `theme-a11y-audit.ts`. It captures computed styles on curated routes at mobile/desktop and light/dark settings, breakpoint boundaries, hover/focus, and available dialogs. Screenshots are advisory. Compare `browser-report.json` files with `node scripts/zfb3-parity/compare-browser.mjs --baseline <v2/browser-report.json> --current <v3/browser-report.json> --output <external-report-prefix>`; it emits JSON and Markdown and fails on computed-style or state-coverage differences. Inspect omitted states and screenshots manually. The hydration probe specs provide behavior coverage across all six e2e fixtures before and after client navigation. The hostpanel fixture includes a media-scheduled island that is deliberately inactive at 1280px, then mounts with an observable ready state at 375px; the smoke probe also visits an HtmlPreview page to exercise visible and skip-SSR paths.

The v2-prep topics must compare against the frozen v2 dist and investigate hard differences. Verification topics must run the same static and browser layers on the integrated v3 build, review intended deviations explicitly, and rerun hydration probes. Never update the frozen v2 reference to make a v3 difference disappear.
