/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSR fallback shell for the <PresetGenerator> interactive form.
//
// The real component (src/components/preset-generator.tsx) is a large
// client-only island that requires useState/useEffect and cannot be
// server-rendered directly in the zfb build. This fallback renders the
// 8 section headings as static SSR HTML so:
//
//   1. The migration-check can find all h3 markers in the static output.
//   2. Screen readers and search engines see the section structure.
//   3. Layout does not collapse to nothing while JS loads.
//
// The interactive form is wrapped in a data-zfb-island-skip-ssr
// placeholder so the zfb hydration runtime can swap it in on the client
// after load. The placeholder approach mirrors the B-8-1 AiChatModal
// SSR-fallback pattern in src/components/ssr-islands.tsx.

import type { VNode } from "preact";
import { HeadingH3 } from "@zudo-doc/zudo-doc-v2/content";

// Heading text for each of the 8 sections — must match the original
// SectionHeading calls in src/components/preset-generator.tsx exactly
// so migration-check h3 queries resolve.
const SECTION_HEADINGS = [
  "Header right items",
  "Color Scheme",
  "Color Scheme Mode",
  "Default Language",
  "Features",
  "Markdown Options",
  "Package Manager",
  "Project Name",
] as const;

/**
 * Static SSR fallback for the interactive PresetGenerator form.
 *
 * Renders all 8 section headings so the migration-check finds them in
 * the static HTML before JS hydration. The interactive body is deferred
 * behind a zfb SSR-skip placeholder so it only loads on the client.
 */
export function PresetGeneratorFallback(): VNode {
  return (
    <div class="zd-preset-gen-fallback">
      {SECTION_HEADINGS.map((heading) => (
        <section key={heading}>
          <HeadingH3>{heading}</HeadingH3>
        </section>
      ))}
      {/* SSR-skip placeholder: the zfb hydration runtime replaces this
          div with the real interactive form on the client after load.
          The data-zfb-island-skip-ssr + data-when attributes match the
          SSR-skip marker contract defined in packages/zudo-doc-v2/src/ssr-skip/types.ts */}
      <div
        data-zfb-island-skip-ssr="PresetGenerator"
        data-when="load"
      />
    </div>
  );
}
