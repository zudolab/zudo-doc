// Type-level + runtime contract for `defineChromeBindings` (zudolab/zudo-doc#2694).
//
// The COMPILE assertions below (positive + `@ts-expect-error` negative) are the
// heart of this suite. Vitest does NOT typecheck, so they are validated by the
// package `typecheck` gate (`tsc --noEmit`, which — unlike `tsconfig.build.json`
// — includes `__tests__`). The two exported `_*CompileAssertions` functions are
// never called at runtime; their mere presence in a typechecked file is the
// assertion. The one `it(...)` block below is the runtime pass-through proof.

import { describe, it, expect } from "vitest";
import { defineChromeBindings } from "../chrome-bindings.js";

// A concrete, interface-typed sidebars object — crucially WITHOUT an index
// signature. It must be accepted by `sidebarsConfig` with NO caller-side cast
// (the friction the showcase's `sidebars as unknown as Record<…>` cast reveals:
// requiring a `Record`-shaped input would reject this).
interface ShowcaseSidebars {
  "!": unknown[];
  guides: unknown[];
}
const concreteSidebars: ShowcaseSidebars = { "!": [], guides: [] };

/**
 * POSITIVE compile assertions — every value below is provided WITHOUT a
 * caller-side cast. If any stops compiling, the adapter has over-tightened.
 */
export function _positiveCompileAssertions(): void {
  // All 13 slots at once, with narrow/concrete real-world values.
  defineChromeBindings({
    SearchWidget: (props) => props.searchLabel,
    BodyEndIslands: (props) => props.basePath,
    DocHistory: (props: { slug: string }) => props.slug, // reads a SUBSET of the passed props
    DesignTokenPanelBootstrap: () => null, // zero-prop component
    docHistoryMeta: {} as Record<string, unknown>,
    sidebarsConfig: concreteSidebars, // concrete object, no index signature — no cast
    tagVocabulary: [{ id: "topic" }],
    frontmatterRenderers: {} as Record<string, unknown>,
    mdxExtras: { Stub: (_p: unknown) => null }, // MdxStub edge — `unknown` props accepted
    buildFrontmatterPreviewEntries: (data) => Object.entries(data),
    loadTagsForLocale: (lang) => [{ tag: lang, count: 1 }], // (lang: string) => Tag[]
    docContentHeaderExtras: ({ locale }) => locale,
    homeExtras: ({ locale }) => locale,
  });

  // Focused restatements of the task's required positive cases (each isolated,
  // still cast-free).

  // A `(props: { slug: string }) => unknown` component in `DocHistory`.
  defineChromeBindings({ DocHistory: (props: { slug: string }) => props.slug });

  // A `(lang: string) => Tag[]` callable in `loadTagsForLocale`. Extra per-entry
  // fields (here `docs`, mirroring `collectTags`' `TagInfo`) are allowed.
  defineChromeBindings({
    loadTagsForLocale: (lang: string) => [{ tag: lang, count: 2, docs: [] }],
  });

  // A concrete typed sidebars object in `sidebarsConfig`.
  defineChromeBindings({ sidebarsConfig: concreteSidebars });

  // `Record<string, unknown>` in `frontmatterRenderers` / `mdxExtras`.
  defineChromeBindings({
    frontmatterRenderers: {} as Record<string, unknown>,
    mdxExtras: {} as Record<string, unknown>,
  });
}

/**
 * NEGATIVE compile assertions — each MUST error (guarded by `@ts-expect-error`;
 * an unused directive would itself fail the typecheck gate).
 */
export function _negativeCompileAssertions(): void {
  // (1) prop-drift: a component REQUIRING a prop the chrome never passes for
  //     that slot. The chrome renders `<DocHistory slug locale basePath />` —
  //     `revision` is not among them, so requiring it is drift, not a mere
  //     non-callable.
  defineChromeBindings({
    // @ts-expect-error DocHistory requires `revision`, which the chrome never passes
    DocHistory: (props: { slug: string; revision: string }) => props.revision,
  });

  // (2) an unknown slot name.
  defineChromeBindings({
    // @ts-expect-error `notASlot` is not a ChromeHostBindings slot
    notASlot: () => null,
  });

  // (3) a function slot with an incompatible RETURN type.
  defineChromeBindings({
    // @ts-expect-error loadTagsForLocale must return a tag array, not a number
    loadTagsForLocale: (_lang: string) => 123,
  });
}

describe("defineChromeBindings", () => {
  it("is a pass-through: returns the exact input object (runtime identity)", () => {
    const input = { DocHistory: (props: { slug: string }) => props.slug };
    const result = defineChromeBindings(input);
    // Runtime behaviour is PASS-THROUGH — the returned value IS the input.
    expect(result).toBe(input);
  });
});
