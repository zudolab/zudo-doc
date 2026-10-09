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
| macOS, clear a `type=search` input with Escape | Placeholder returns with `⌘K` | Unit input-event regression and browser case in `e2e/smoke-search-shortcut.spec.ts` |
| Windows, first open and both clear paths | `Ctrl+K` survives each placeholder restore | Unit and browser cases |
| Either platform, close/reopen and `zfb:after-swap` | Badge remains correct | Unit and browser cases |
| Either platform, result activation, disconnect/reconnect | Dialog closes, link remains navigable, one keyboard listener remains | Unit behavior and strict browser case |
| Loading, unavailable, and no-results states | Existing messages and retry behavior remain intact | Runtime unit compatibility test; existing smoke search coverage remains in place |

`e2e/smoke-search-shortcut.spec.ts` is the strict browser case for #4475 to run.
It covers the complete open → type → delete-clear → Escape-clear → close/reopen →
result navigation → same-node reconnect path under both Mac and Windows platform
strings. The regular smoke search specs continue to cover no-results, unavailable,
and result navigation behavior.

## Reproduction and verification

With documented macOS platform detection enabled but before the placeholder-order
fix, the focused runtime test failed after the first query was deleted on both
platform cases. The observed text was `""`; expected values were `"⌘K"` and
`"Ctrl+K"`. First-open checks passed, and the loading, unavailable, and no-results
compatibility test passed. This isolates the original failure to restoration of
the pre-shortcut placeholder snapshot.

After the fix, the focused generated-script and runtime tests passed: 2 test files,
7 tests. The new E2E spec typechecks with `tsc --noEmit -p e2e/tsconfig.json`.
The strict browser run is delegated to #4475; no browser suite was run in this
worktree.
