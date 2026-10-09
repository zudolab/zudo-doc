# Search shortcut lifecycle follow-up (#4482 / #4478)

## Ownership and commit

- Worktree: `/workspace/zudo-doc/worktrees/4482-search421`
- Branch: `topic/4482-search421`
- Prior implementation: `f7ef485dd69e246e7de6934cfa1d9a921a7cc117`
- Follow-up commit: `f8326b54a3310ba94bbf9e99dbfce230e2af7a81`
- Scope: generator + committed generated script/hash, lifecycle runtime regression, strict browser case, findings matrix. No dependency changes, no push.

## Reconnect regression

Added a regression before changing the generator: on both `macOS` and Windows, type a matching query, remove/reappend the custom element while its results container contains an article, then clear. Against the old unconditional reconnect snapshot, both platform cases failed because the empty-query placeholder was absent. Initial first-open badge values were correct; loading/unavailable/no-results compatibility passed.

The generator now captures the shortcut-populated placeholder exactly once. Reconnects preserve that original snapshot even if the results area currently contains search results. `generated-script.ts` was regenerated through `pnpm --filter @takazudo/zudo-doc gen:search-widget-script`, and the CSP pin was updated to `sha256-zrm1SXKXHE5cZoETiYV+zyWOBhIjBNDI31NxMPKvINU=`.

The browser case now uses the shipped `type=text` input. Escape closes the native dialog and preserves the query; reopening and deleting clears the query and restores the badge. It also reconnects while populated, clears, then follows a search result and asserts no main-frame document request occurred during SPA navigation.

## Verification

Passed after the follow-up commit:

```sh
PATH=/tmp/zudo-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/zudo-pnpm-store npm_config_cache=/tmp/zudo-npm-cache ZFB3_SOURCE_RESOLVE=1 pnpm --filter @takazudo/zudo-doc exec vitest run --config vitest.config.ts src/search-widget-script/__tests__/index.test.ts src/search-widget-script/__tests__/runtime.test.ts
# 2 test files passed; 7 tests passed

PATH=/tmp/zudo-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/zudo-pnpm-store npm_config_cache=/tmp/zudo-npm-cache pnpm --filter @takazudo/zudo-doc typecheck
# passed

PATH=/tmp/zudo-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/zudo-pnpm-store npm_config_cache=/tmp/zudo-npm-cache pnpm exec tsc --noEmit -p e2e/tsconfig.json
# passed

PATH=/tmp/zudo-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/zudo-pnpm-store npm_config_cache=/tmp/zudo-npm-cache pnpm check:e2e-spec-naming
# passed; 90 specs recognized

PATH=/tmp/zudo-tools/node_modules/.bin:$PATH npm_config_store_dir=/tmp/zudo-pnpm-store npm_config_cache=/tmp/zudo-npm-cache pnpm check:search-widget-drift
# passed; committed generated script matches fresh generation
```

No browser suite was run in this worktree; the strict spec is delegated to the manager's browser verification. Reviewer `parity_final_review421` was sent the follow-up commit for read-only review.

## Strict-browser assertion follow-up

- Follow-up E2E assertion commit: `dfa57f6aa4bf6c80f375443792d18104fd43ea7f` (HEAD), on top of `f8326b54a3310ba94bbf9e99dbfce230e2af7a81`.
- A result retained inside a closed native dialog is asserted by DOM count before reopening; the same result is explicitly asserted visible after the dialog opens. This avoids checking visibility while the dialog is closed without weakening the visible-after-open behavior.
- Re-ran `pnpm exec tsc --noEmit -p e2e/tsconfig.json`, `pnpm check:e2e-spec-naming`, and `git diff --check`; all passed. Latest worktree status is clean.

## Browser-run follow-up

- Latest commit: `0f8800b8d98a77377a1d99c3b2383df5bc8b7eeb` (HEAD), after `dfa57f6aa4bf6c80f375443792d18104fd43ea7f`.
- The populated result set can contain multiple links, so the browser test now captures the exact result-container HTML instead of assuming one result. It removes/reinserts the search widget at its original parent and next sibling, verifies identical result DOM while the dialog is closed, then verifies a result is visible after reopening. The later listener-reconnection check also preserves the original parent position.
- Re-ran E2E TypeScript, naming guard, and diff check; all pass. Worktree is clean. The manager is rerunning the strict browser case; no browser run in this worktree.
