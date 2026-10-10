# Search shortcut placeholder regression (#4482 / #4478)

## Finding and fix

The generated search script originally serialized the results placeholder before
writing the platform shortcut into `[data-kbd-shortcut]`. Clearing a query restores
that earlier snapshot, so the shortcut badge comes back empty. The generator now
sets the platform label before capturing the placeholder; the committed generated
script is regenerated from that source.

This is an `intentional-fix` for #4478 and ships in zudo-doc 6.0.0. The platform
check also matches the documented `navigator.userAgentData.platform`
value `"macOS"` case-insensitively. Chrome's [User-Agent Client Hints guide](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints)
uses that exact spelling. The prior case-sensitive `Mac` check missed it when the
client-hints platform value was present, even though the fallback user-agent string worked.

## Behavioral matrix

| Platform / transition | Expected | Evidence |
| --- | --- | --- |
| macOS (`userAgentData.platform = "macOS"`), first open | `⌘K` | `packages/zudo-doc/src/search-widget-script/__tests__/runtime.test.ts` |
| macOS, type a matching query then delete it | Placeholder returns with `⌘K` | Pre-fix test failed with an empty badge; post-fix test passes |
| macOS, shipped `type=text` input with Escape | Dialog closes and query remains; delete-clear restores placeholder with `⌘K` | Browser case in `e2e/smoke-search-shortcut.spec.ts` |
| Windows, first open and delete-clear | `Ctrl+K` survives placeholder restore | Unit and browser cases |
| Either platform, close/reopen and `zfb:after-swap` | Badge remains correct | Unit and browser cases |
| Either platform, disconnect/reconnect while results are populated, then clear | Original placeholder and platform badge return | Pre-fix runtime regression fails; post-fix unit and browser cases pass |
| Either platform, result activation | Dialog closes, SPA navigation completes without a main-frame document request | Strict browser case and navigation-request assertion |
| Loading, unavailable, and no-results states | Existing messages and retry behavior remain intact | Runtime unit compatibility test; existing smoke search coverage remains in place |

`e2e/smoke-search-shortcut.spec.ts` is the strict browser case for #4475 to run.
It covers the complete open → type → delete-clear → Escape-close-preserving-query →
reopen → populated disconnect/reconnect → clear → SPA result navigation path under
both Mac and Windows platform strings. It asserts that SPA result navigation does
not issue a main-frame document request. The regular smoke search specs continue to
cover no-results, unavailable, and result navigation behavior.

## Reproduction and verification

With documented macOS platform detection enabled but before the placeholder-order
fix, the focused runtime test failed after the first query was deleted on both
platform cases. The observed text was `""`; expected values were `"⌘K"` and
`"Ctrl+K"`. First-open checks passed, and the loading, unavailable, and no-results
compatibility test passed. This isolates the original failure to restoration of
the pre-shortcut placeholder snapshot.

The reconnect regression was added while the generator still recaptured results;
the focused runtime test failed for both macOS and Windows because clearing after
reconnect could not restore the placeholder. The one-time snapshot fix preserves
the original platform-populated HTML across reconnects. The focused generated-script
and runtime tests and E2E spec typecheck are recorded with the follow-up commit.
The worker did not run browsers; the manager ran the combined source through both
the heavy and Playwright guards on 2026-10-09. Product source `dab099db`, final
browser spec `066cc6b5`: **12/12 passed**, including both new platform cases and
the existing search/dialog suites. Chromium 151 on Linux used explicit macOS and
Windows navigator values. This verifies both platform branches, not native macOS
hardware or Japanese IME behavior.

The first browser run was **10 pass / 2 fail** because the new reconnect test
assumed one result link while the actual query returns three. The corrected test
preserves the original parent/sibling position and compares the complete results
HTML before/after reconnect, then requires visibility after reopening. No product
behavior assertion or console-error policy was removed. Earlier review also
rejected changing the shipped text input into a search input to invent an
Escape-clear behavior; the final test exercises native dialog close and retained
query instead.

The real fixture was rebuilt from the generated source (43 pages, guard PASS).
The browser command was `pnpm exec playwright test --config
/tmp/zudo4482-playwright.config.ts e2e/smoke-search-shortcut.spec.ts
e2e/smoke-search-dialog-close.spec.ts e2e/smoke-search.spec.ts`, with
`E2E_FIXTURES=smoke`, no retries, system Chromium and serial workers. The temporary
config only selects the browser executable and output paths; it imports the
repository fixture/server configuration. Raw failed/passing logs and reports plus
review evidence are summarized in `docs/findings/4430-zfb3-migration/2026-10-10-probe-summaries.md` (raw logs were in the temporary `_temp-resource/4430-zfb3-migration/4482-search/`, not preserved).
Final combined #4475 verification remains required.
