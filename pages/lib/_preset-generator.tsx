/** @jsxRuntime automatic */
// SSR fallback shell for the <PresetGenerator> interactive form.
//
// The real component (src/components/preset-generator.tsx) is a large
// client-only island. This file is imported transitively from page modules
// (pages/docs/[[...slug]].tsx → mdxExtras → here), so zfb's island
// scanner walks the static import chain and registers PresetGenerator in the
// manifest. Without this import, the scanner never finds the component and
// client-side hydration never fires (orphan-component problem; same root
// cause fixed for body-end islands in _body-end-islands.tsx).
//
// The fallback preserves the 9 section headings from the v2 static SSR shell so:
//   1. Screen readers and search engines see the section structure (a11y/SEO).
//   2. Layout does not collapse to nothing while JS loads (no-JS layout).
//   3. The scanner traces this file → preset-generator.tsx via the Island child
//      and registers PresetGenerator in the manifest for client-side mounting.
//
// Uses the canonical `<Island ssrFallback>` API (zfb) so the scanner can
// connect the import to the manifest entry and the hydration runtime can
// mount the real form into the skip-ssr placeholder on the client.

import type { Description } from "@takazudo/zfb/zudo-react";
import { HeadingH3 } from "@takazudo/zudo-doc/content";
import { Island } from "@takazudo/zfb";
import PresetGenerator from "@/components/preset-generator";

// Preserve the exact v2 SSR fallback presentation during the runtime migration.
// The interactive form already used "Languages" and included "Meta tags" in v2;
// those client labels intentionally differ from this historical static shell.
// Aligning the fallback with the client is a separate presentation change.
const SECTION_HEADINGS = [
  "Project Name",
  "Default Language",
  "Color Scheme Mode",
  "Color Scheme",
  "Theme Pack",
  "Features",
  "Header right items",
  "Markdown Options",
  "Package Manager",
] as const;

/**
 * Static SSR fallback for the interactive PresetGenerator form.
 *
 * Renders the 9 baseline section headings as static HTML for a11y/SEO and no-JS
 * layout stability. Uses Island with ssrFallback so the zfb scanner traces
 * this file → preset-generator.tsx and registers the real component in the
 * island manifest for client-side mounting.
 */
export function PresetGeneratorFallback(): Description {
  const fallback = (
    <div class="zd-preset-gen-fallback">
      {SECTION_HEADINGS.map((heading) => (
        <section key={heading}>
          <HeadingH3>{heading}</HeadingH3>
        </section>
      ))}
    </div>
  );

  // Island with ssrFallback:
  // - SSR emits the section headings as static HTML inside the skip-ssr div.
  // - The scanner reads children.type = PresetGenerator → registers it in
  //   the manifest under "PresetGenerator".
  // - The hydration runtime mounts the real interactive form into the
  //   skip-ssr placeholder on the client after load.
  return <>{Island({
    when: "load",
    ssrFallback: fallback,
    children: <PresetGenerator />,
  }) as unknown as Description}</>;
}
