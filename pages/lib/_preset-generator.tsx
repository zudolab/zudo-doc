/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Island wrapper for the <PresetGenerator> interactive form.
//
// Wave 3 (zudolab/zudo-doc#1452): the previous implementation used the old
// "orphan component" pattern — it emitted a manual
// `<div data-zfb-island-skip-ssr="PresetGenerator" data-when="load" />` but
// never imported the real PresetGenerator component. Because no page module
// walked page → real-component, zfb's island scanner never registered the
// constructor and the client bundle never contained the form body. The result:
// the placeholder div was replaced with nothing on load.
//
// The fix mirrors the Wave 8 pattern used by _body-end-islands.tsx and
// _doc-history-area.tsx: import the real component here so the scanner
// walks page → _mdx-components → PresetGeneratorFallback → real PresetGenerator,
// and use zfb's native `<Island ssrFallback>` API so the marker name is derived
// via captureComponentName (displayName ?? name) rather than a hand-coded string.
//
// The SSR fallback renders the 8 section headings so:
//   1. The migration-check can find all h3 markers in the static output.
//   2. Screen readers and search engines see the section structure.
//   3. Layout does not collapse to nothing while JS loads.

import type { VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { HeadingH3 } from "@zudo-doc/zudo-doc-v2/content";
import RealPresetGenerator from "@/components/preset-generator";

// Set explicit displayName so zfb's captureComponentName produces a stable
// marker after any function-name-rewriting layer (esbuild minification guard).
(RealPresetGenerator as { displayName?: string }).displayName = "PresetGenerator";

// Heading text for each of the 8 sections — must match the original
// SectionHeading calls in src/components/preset-generator.tsx exactly
// so migration-check h3 queries resolve.
// Order must mirror the JSX source order in preset-generator.tsx — do NOT
// sort alphabetically. The array drives the SSR fallback heading sequence
// that the migration-check harness compares against the Astro A snapshot.
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

/**
 * Island wrapper for the interactive PresetGenerator form.
 *
 * Renders all 8 section headings as the SSR fallback so the migration-check
 * finds them in the static HTML before JS hydration. The real interactive
 * form is loaded on the client after "load" via zfb's Island mechanism.
 *
 * This function is bound to the `PresetGenerator` key in the MDX components
 * map (pages/_mdx-components.ts), replacing the default-export import in the
 * MDX corpus. The MDX file also wraps it in <Island when="load"> which
 * resolves to IslandWrapper (pass-through) in the zfb build, so the Island
 * nesting here is the authoritative one.
 */
export function PresetGeneratorFallback(): VNode {
  const ssrFallback: VNode = (
    <div class="zd-preset-gen-fallback">
      {SECTION_HEADINGS.map((heading) => (
        <section key={heading}>
          <HeadingH3>{heading}</HeadingH3>
        </section>
      ))}
    </div>
  );

  return Island({
    when: "load",
    ssrFallback,
    children: <RealPresetGenerator />,
  }) as unknown as VNode;
}
