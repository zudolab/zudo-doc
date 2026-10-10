# Port the SiteTreeNav island to zudo-react

Owner: [#4445](https://github.com/zudolab/zudo-doc/issues/4445). Status: **implementation verified; browser parity pending #4468/#4475**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. The locked #4445 spec targets zfb 3.1.0 and supersedes the original issue's 3.0.0 wording.

## Files and symbols

| File | Symbol | v2 construct → v3 form | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `padLeft` | Retained as a pure helper returning explicit CSS text for root/indented rows. | Verified; R-JSX and W-CATALOG; SSR tests cover the emitted padding values and corrected calc class. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `reorderTree` | Retained as a pure helper; root rendering uses a signal-backed list and `<For by={node => node.slug}>`. | Verified; R-REGIONS; SSG test proves requested roots precede unmatched roots. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `SiteTreeNavProps` | Kept the existing serializable tree and optional presentation props. State is seeded from those props; component setup does not inspect storage or location. | Verified; R-PROPS/R-HYDRATE; the island harness serializes the fixture props and reports no hydration diagnostics. Existing call sites omit absent optional values. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `SiteTreeNav` | Preact rendering became zudo-react setup. Root rows use `<For>` keyed by slug; empty note trays and category/leaf branches use `<Show>`. The two wrappers still request `when: "idle"`. | Verified; R-REGIONS/R-PROPS; SSG boundary test checks `data-when="idle"`; interaction tests cover SSR→hydrate and navigation hrefs. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `NodeList` | Recursive `.map()` became a keyed `<For>`; each row receives its readonly item signal and a computed last-row flag. `<Show>` selects category or leaf nodes and the corresponding shared connector clipping. | Verified; R-REGIONS; expand/collapse test checks children appear and disappear while an unrelated keyed root row retains its DOM node. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `CategoryNode` | `useState` became one `signal` per category, initialized from `initiallyCollapsedCategorySlugs` during SSR and client setup before activation. Stable click closures read the current signal. Open children, connector, and link/button branches use `<Show>`; changing text, href, ARIA, class, and transform values use computed bindings. | Verified; R-SCOPE/R-REGIONS/R-HYDRATE; hydration starts in the prop-selected state, then tests expand and collapse it. No effect or browser resource is used. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `NoteTrayNodeList` | Grouped and flat rows use keyed `<For>` lists (`group.key` and `item.slug`); group mode and headings are computed from the item signal. Mutually exclusive list branches use `<Show>`. | Verified; R-REGIONS; SSG note-tray and date-format cases pass for flat, month, and year layouts. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `NoteTrayRow` | Row href, date, label, and rank are computed from the readonly item signal. `<Show>` omits rows without hrefs and selects `<time>` versus rank text. `datetime` is emitted with the accepted HTML spelling. | Verified; R-JSX/R-REGIONS/R-PROPS; six date-format cases and the escaped-label case pass. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `LeafNode` | Uses computed href/label/class bindings and a `<Show>` link region. Root and nested utility classes retain their original layout and focus treatment. | Verified; R-JSX/R-REGIONS/W-CATALOG; exact SSG and link-color assertions pass. |
| `packages/zudo-doc/src/site-tree-nav-island/state.ts` | `initialCategoryOpenState` | Retained as a pure boolean initializer; no hook or runtime import. | Verified; covered by the unchanged two-case state test. |
| `packages/zudo-doc/src/site-tree-nav-island/state.ts` | `toggleCategoryOpenState` | Retained as a pure boolean toggle; the component applies it to the current signal value. | Verified; covered by the unchanged two-case state test and hydrated category interaction. |

## Raw HTML sites to review

| File/site | Payload, trust, parser context, cleanup and test |
| --- | --- |
| No `rawHtml` or `dangerouslySetInnerHTML` site in the owned component or tests (confirmed by final source scan). | No markup string is inserted. `SidebarNavNode.label` and date text remain ordinary JSX children in valid `a`, `button`, `span`, and `time` contexts; zudo-react escapes text. The test hydrates a label containing `<script>bad()</script>` and confirms it stays text with no script element. Imported tree connector and chevron icons render ordinary SVG descriptions. There is no raw-HTML payload or external resource to clean up. R-RAW. |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `py-[calc(var(--spacing-vsp-xs)+0.15rem)]` | Keep the #4435 canonical underscore-space form `py-[calc(var(--spacing-vsp-xs)_+_0.15rem)]`; its mathematical value stays unchanged. | Verified; W-CATALOG/W-GRAMMAR; exact SSG fixture asserts the final token. `css-prep.md` § #4435 records v2 CSS and `wind explain` evidence plus zero differences in the manager's 65-state comparison. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | `2xl:w-[24px]` | Keep it removed per #4435: no matching declaration existed in baseline v2 CSS; retain `w-[18px]` at all breakpoints. | Verified; W-CATALOG; SSG test asserts `w-[18px]` remains and `2xl:w-[24px]` is absent. `css-prep.md` § #4435 records the dead-utility audit and zero-difference browser comparison. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | Conditional `rotate-90` on the chevron SVG | Keep the shared `ChevronRight` icon and rotate an inline-flex wrapper through a computed `transform` string. This preserves the open/closed rotation without passing a signal through the shared icon's plain-string `class` prop. | Verified at SSR and in interaction state; R-JSX/R-SCOPE. The wrapper adds one span and moves the transform to it; browser-computed transition parity is handed to #4468/#4475. |
| `packages/zudo-doc/src/site-tree-nav-island/index.tsx` | Style objects and `datetime` | Use CSS-spelled keys (`grid-template-columns`, `padding-left`, `left`, `top`, `bottom`); emit the reactive rank `width` through a CSS string with explicit `ch`. Use explicit `0px` and `deg` units where required. Use `datetime`, not a disallowed camel-case alias. | Verified; R-JSX/R-PROPS and #3375 style typing decision; port check has no owned diagnostics and SSG/date-format tests pass. |

## Tests and completion evidence

| Test file | Coverage / result |
| --- | --- |
| `packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-date-formats.test.tsx` | Ported from Preact renderer to `renderSsr`; six locale/date-role cases pass. |
| `packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-interaction.test.tsx` | New zudo-react harness coverage: collapsed prop hydrates without diagnostics or storage reads; expansion/collapse keeps standard href navigation; keyed sibling identity survives branch changes; disposal detaches the click binding; text labels are escaped. Four cases pass. |
| `packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-ssg.test.tsx` | Ported to zudo-react SSR and v3 `islandRoot`; preserves idle activation, exact output and note-tray/date markup, plus root order/filter and #4435 utility assertions. Twenty-two cases pass. |
| `packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-state.test.ts` | Pure state tests retained; two cases pass. |

Commands run from the worktree against zfb 3.1.0:

```sh
node scripts/zfb3-port-check.mjs \
  packages/zudo-doc/src/site-tree-nav-island/index.tsx \
  packages/zudo-doc/src/site-tree-nav-island/state.ts \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-date-formats.test.tsx \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-interaction.test.tsx \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-ssg.test.tsx \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-state.test.ts

ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run \
  --config packages/zudo-doc/vitest.config.ts \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-date-formats.test.tsx \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-interaction.test.tsx \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-ssg.test.tsx \
  packages/zudo-doc/src/site-tree-nav-island/__tests__/site-tree-nav-state.test.ts
```

Result: port check reports **0 owned diagnostics** and **443 unrelated migration-window diagnostics** across the package/host projects; focused source-resolution Vitest reports **4 files, 34 tests passed**. The harness exercises real v3 props serialization from source and reports no structured hydration diagnostics for these fixtures. No package rebuild was needed. No full package/site build, Playwright/e2e, or b4push was run, per #4445's leaf-topic limit.

The exact SSR assertion now records zudo-react's `class=""` serialization where Preact emitted a valueless empty `class` attribute. The open/closed chevron also has the span wrapper described above; all link, label, date, and note-tray text output remains covered by the existing exact or focused assertions.

`SiteTreeNav` has no location/storage read or document/window subscription, so no activation callback or global cleanup is required. The tree uses standard `href` anchors and does not infer current location. The disposal test verifies its native click binding is detached. Browser route, breakpoint, hover/focus, theme-pack, and computed-transform checks are deferred to #4468/#4475; the new wrapper transform has not had an independent browser computed-style comparison.

Upstream issues or shims introduced: **none**. Remaining visual question: confirm the wrapper transform and transition match the prior chevron rotation in the verification topic.

Final topic status: implementation and owned checks verified; self-review completed in the foreground on 2026-10-02; committed locally on `topic/zfb3-4445-site-tree-nav` before reporting. Final commit SHA is in the worktree report.

## Remaining Preact runtime imports after #4437

None in `site-tree-nav-island/index.tsx` or its tests. The component imports zudo-react signals/regions and uses the shared v3 tree primitives and icons; tests use the #4438 zudo-react harness.
