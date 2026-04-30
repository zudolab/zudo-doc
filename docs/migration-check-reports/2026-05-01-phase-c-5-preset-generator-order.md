# Phase C-5: PresetGenerator h3 Alphabetization — Verification Report

**Date:** 2026-05-01
**Cluster:** C-5 — setup-preset-generator h3 ordering
**Affected routes:** `/docs/getting-started/setup-preset-generator`, `/ja/docs/getting-started/setup-preset-generator`
**Status:** ✅ Already resolved — no new code changes required.

---

## Background

The post-B-16 triage analysis (`2026-05-01-phase-c-input-post-b16-analysis.md`) flagged
C-5 as a 2–4 point content-loss cluster where `<PresetGenerator>` h3 children
appeared in source order on A (Astro) but alphabetically on B (zfb).

The root cause identified was that `pages/lib/_preset-generator.tsx` — the SSR
fallback component that renders the 8 section headings as static HTML for the
migration-check harness — was emitting headings without enforcing a stable iteration
order. When the zfb JSX emitter encountered the component, it produced headings in
a different sequence than Astro's renderer, resulting in an apparent alphabetisation
in the B snapshot.

---

## Investigation

### Step 1: Host component review

`pages/lib/_preset-generator.tsx` (current state after the post-B-17 super-epic
merge at `3918d6e`) already contains an explicit `SECTION_HEADINGS` array:

```ts
const SECTION_HEADINGS = [
  "Project Name",
  "Default Language",
  "Color Scheme Mode",
  "Color Scheme",
  "Features",
  "Header right items",
  "Markdown Options",
  "Package Manager",
] as const;
```

The component maps over this array in declaration order, so the iteration order is
fully deterministic and cannot be affected by any JSX-emitter reordering. A comment
in the file explicitly states: _"Order must mirror the JSX source order in
preset-generator.tsx — do NOT sort alphabetically."_

This fix was introduced in commit `601dfbd fix(b-15-4): force explicit source-order
iteration in PresetGenerator` and carried into the Phase C epic base via the
`3918d6e` merge.

### Step 2: MDX source review

`src/content/docs/getting-started/setup-preset-generator.mdx` uses a simple single
`<Island when="load"><PresetGenerator /></Island>` invocation — there are no
per-section props or child elements that could be reordered by the MDX emitter. The
h3 headings are emitted entirely by the `PresetGeneratorFallback` component, which
iterates `SECTION_HEADINGS`.

### Step 3: Snapshot comparison

H3 headings extracted from the round-11 snapshots:

**A (Astro) — EN `/docs/getting-started/setup-preset-generator/index.html`:**
1. Project Name
2. Default Language
3. Color Scheme Mode
4. Color Scheme
5. Features
6. Header right items
7. Markdown Options
8. Package Manager

**B (zfb) — EN same route:**
1. Project Name
2. Default Language
3. Color Scheme Mode
4. Color Scheme
5. Features
6. Header right items
7. Markdown Options
8. Package Manager

**A (Astro) — JA `/ja/docs/getting-started/setup-preset-generator/index.html`:**
Same 8 headings in same order.

**B (zfb) — JA same route:**
Same 8 headings in same order.

A and B are **fully aligned** on both locale routes. The alphabetisation regression
that C-5 was filed to address is no longer present in the round-11 snapshots.

---

## Root cause (historical)

The original regression (pre-B-15) arose because the `SECTION_HEADINGS` array in
the SSR fallback had "Header right items" placed first (matching its position in an
intermediate draft of the component) rather than "Project Name". Because zfb's JSX
emitter resolves component output deterministically from the array, the mismatch
produced a heading order that differed from the Astro A snapshot where the live
interactive component renders its JSX sections in their authored source sequence.

The B-15-4 fix aligned the array with the actual source order of `SectionHeading`
calls in `src/components/preset-generator.tsx`.

---

## Decision

**No additional code changes are needed.** C-5 is fully resolved by the B-15-4 fix
already present in the Phase C epic base. The round-11 snapshots confirm parity on
both EN and JA routes.

---

## Files inspected

- `pages/lib/_preset-generator.tsx` — host SSR-fallback component (fix already applied)
- `src/content/docs/getting-started/setup-preset-generator.mdx` — MDX source (no changes needed)
- `src/content/docs-ja/getting-started/setup-preset-generator.mdx` — JA mirror (no changes needed)
- `.l-zfb-migration-check/snapshots/{a,b}/docs/getting-started/setup-preset-generator/index.html`
- `.l-zfb-migration-check/snapshots/{a,b}/ja/docs/getting-started/setup-preset-generator/index.html`
