# Port SidebarToggle (the mobile drawer that hosts SidebarTree inside the persisted header)

Owner: [#4462](https://github.com/zudolab/zudo-doc/issues/4462). Status: **ported; focused source checks pass**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](round2-3.1.0.md). Planned contract only; implementation and browser evidence remain pending. This overrides the named round-1 deviations.

Void the round-1 accepted #3362 remount/local-state reset limitation. Use #4442's simplified singleton idempotently, preserving body-overflow cleanup, Escape IME/defaultPrevented guards and focus return. Mutated unchanged nested state survives same-document navigation through native preservation; changed effective page props refresh through native recreation. Test cross-section tree refresh and same-locale expanded state, and hand nonzero-scroll/focus/browser proof to #4468/#4475. No nested Island wrappers or inner-button persistence.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/sidebar-toggle-island/index.tsx` | `SidebarToggleProps` | Existing JSON island props are passed unchanged to the direct child `SidebarTree`; no nested Island wrapper or signal crosses transport | complete; #4462 locked 3.1.0 spec and conventions “Props, identity and public stability”; checked by persisted cross-section hydration test below |
| `packages/zudo-doc/src/sidebar-toggle-island/index.tsx` | `SidebarToggle` state and lifecycle | `useState` → `signal`; `useEffect` → `scope.effect` for body overflow and open-only Escape listener, `scope.onActivate` for navigation close; `useRef` → `Ref`; callbacks use native `on:click` and narrow key events from `Event`; dynamic attributes/classes use computed scalar signals | complete; conventions “Runtime, lifecycle and types” and “Events and forms”; interaction harness covers activation, cleanup, scroll lock, Escape, inert, focus and navigation |
| `packages/zudo-doc/src/sidebar-toggle-island/index.tsx` | Persisted header setup | Module eagerly calls idempotent `ensureNestedIslandPropsRefresh()` through the transitions barrel; zfb 3.1 native reconciliation keeps unchanged roots and recreates changed props. No blanket remount, hand-authored root, or nested Island wrapper | complete; #4442 locked 3.1.0 semantics; same-locale native swap test proves changed page props refresh the tree; #4442's packed lifecycle test covers unchanged live handles |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in `sidebar-toggle-island/index.tsx`; no new `rawHtml` use | Drawer markup and hosted `SidebarTree` remain ordinary intrinsic/component children; payload is not injected HTML | reviewed; none introduced. The hosted tree's raw HTML label sites are owned and individually reviewed by #4447 in `sidebar-tree.md` |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/sidebar-toggle-island/index.tsx` | `h-[calc(100vh-3.5rem)]` → `h-[calc(100vh_-_3.5rem)]` | Keep the same panel height while using the zudo-wind canonical underscore encoding for spaces inside `calc()` | complete; engine-required candidate spelling from #4435; closed/open panel classes are covered by SSG and interaction tests. Computed-height/browser parity remains with #4468/#4475 |

## Tests and completion evidence

Owned test files:

- `packages/zudo-doc/src/sidebar-toggle-island/__tests__/sidebar-toggle-interaction.test.tsx` — zudo-react hydrate harness covers open/close, body scroll lock and cleanup, inert state, backdrop, Escape IME/default-prevented guards, focus return, closed-listener behavior, button elevation, same-locale changed-props native swap, cross-section tree refresh and stored category expansion.
- `packages/zudo-doc/src/sidebar-toggle-island/__tests__/sidebar-toggle-ssg.test.tsx` — zudo-react SSR covers static panel/tree/backdrop, closed inert state, marker identity and inline icon hiding.

Verification follows the source-resolution and port-check lane from the binding conventions. The harness covers initial SSR, active updates, cleanup/disposal and persisted navigation; computed-height browser parity remains with #4468/#4475.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | `node scripts/zfb3-port-check.mjs packages/zudo-doc/src/sidebar-toggle-island/index.tsx packages/zudo-doc/src/sidebar-toggle-island/__tests__/sidebar-toggle-interaction.test.tsx packages/zudo-doc/src/sidebar-toggle-island/__tests__/sidebar-toggle-ssg.test.tsx`: 0 owned diagnostics, 668 unrelated migration-window diagnostics. On Node 24.13.1, zfb 3.1.0 and Vitest 4.1.0, `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/sidebar-toggle-island/__tests__/sidebar-toggle-interaction.test.tsx packages/zudo-doc/src/sidebar-toggle-island/__tests__/sidebar-toggle-ssg.test.tsx`: 18 passed |
| Package artifact rebuild | Not run: #4430's red window keeps the package build under #4467; these tests use source resolution and do not consume `dist/` |
| RawHtml review verdict per site | Verified none in this topic; SidebarTree's label payloads are reviewed in #4447's `sidebar-tree.md` |
| Deliberate DOM/class/behavior differences and cause | No drawer DOM or interaction differences intended. The arbitrary height candidate uses #4435's zudo-wind-required underscore encoding inside `calc()`; its computed browser height is delegated to #4468/#4475 |
| Upstream issue/shim and removal version | No drawer-specific shim or new upstream issue. Uses #4442's native 3.1.0 persisted-island lifecycle; no remount workaround |
| Browser/visual cases handed to #4468/#4475 | Mobile viewport/breakpoint drawer and backdrop, scroll lock, inert/focus order and Escape return, nested Appearance Escape, same-locale cross-section navigation with expanded tree and nonzero scroll |
| Final commit / reviewer / date | Topic commit SHA recorded in the #4462 handoff; foreground self-review by owner; 2026-10-02 |

## Preact port status

No owned file retains a Preact runtime import. `SidebarToggle` and its interaction tests use zudo-react; the SSG test uses the zudo-react server harness. The repository keeps Preact only for the opaque zdtp bundle, per the locked convention.
