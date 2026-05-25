/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/versions-page-content.astro.
//
// The original Astro template read settings.versions, resolved href helpers
// from @/utils/base, called the host's t() i18n function, and rendered a
// two-section versions page (latest + past versions table).
//
// This v2 port accepts all strings and data as props so it stays decoupled
// from the host's settings, URL builders, and i18n system. The consumer
// resolves translation strings for the active locale and passes them via
// the `labels` bag.
//
// Behaviour parity notes:
//   - "Latest version" section is always rendered (latestHref is required).
//   - "Past versions" section only renders when `versions` is non-empty.
//   - `unmaintained` renders an amber warning badge; `unreleased` renders
//     a blue info badge — identical CSS to the original template.
//   - Returns the page content (not null) regardless of whether past
//     versions exist (matching the Astro template's unconditional h1).

import type { JSX } from "preact";

import type { VersionPageEntry, VersionsPageLabels } from "./types";

export interface VersionsPageContentProps {
  /** Pre-resolved href to the latest version's default docs page. */
  latestHref: string;
  /** Past version entries. Empty array hides the past-versions section. */
  versions: VersionPageEntry[];
  /** Localized label strings. */
  labels: VersionsPageLabels;
}

/**
 * VersionsPageContent — JSX port of `src/components/versions-page-content.astro`.
 *
 * Renders the full documentation versions page:
 *   - An `<h1>` heading (from `labels.pageTitle`).
 *   - A "Latest version" section with a link to the current docs.
 *   - A "Past versions" table (only when `versions` is non-empty) showing
 *     each version's label, status badge, and a docs link.
 *
 * All strings and hrefs are pre-resolved by the consumer so this component
 * stays locale- and settings-agnostic.
 */
export function VersionsPageContent(
  props: VersionsPageContentProps,
): JSX.Element {
  const { latestHref, versions, labels } = props;

  return (
    <>
      <h1 class="text-heading font-bold mb-vsp-lg">{labels.pageTitle}</h1>

      {/* Latest version section */}
      <section class="mb-vsp-xl">
        <h2 class="text-subheading font-bold mb-vsp-xs">{labels.latestTitle}</h2>
        <p class="text-small text-muted mb-vsp-sm">{labels.latestDescription}</p>
        <a
          href={latestHref}
          class="inline-flex items-center gap-hsp-xs text-small text-accent underline hover:text-accent-hover"
        >
          {labels.latestLink}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-[0.875rem] w-[0.875rem]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </a>
      </section>

      {/* Past versions section */}
      {versions.length > 0 && (
        <section>
          <h2 class="text-subheading font-bold mb-vsp-xs">{labels.pastTitle}</h2>
          <p class="text-small text-muted mb-vsp-md">{labels.pastDescription}</p>
          <div class="border border-muted rounded overflow-hidden">
            <table class="w-full text-small">
              <thead>
                <tr class="border-b border-muted bg-surface">
                  <th class="px-hsp-lg py-vsp-sm text-left font-medium text-muted">
                    {labels.versionCol}
                  </th>
                  <th class="px-hsp-lg py-vsp-sm text-left font-medium text-muted">
                    {labels.statusCol}
                  </th>
                  <th class="px-hsp-lg py-vsp-sm text-left font-medium text-muted">
                    {labels.docsCol}
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={`version-${v.slug}`}
                    class="border-b border-muted last:border-b-0"
                  >
                    <td class="px-hsp-lg py-vsp-sm font-medium text-fg">
                      {v.label}
                    </td>
                    <td class="px-hsp-lg py-vsp-sm">
                      {v.banner === "unmaintained" && (
                        <span class="inline-block rounded px-hsp-xs py-vsp-3xs text-caption bg-warning/10 text-warning">
                          {labels.unmaintained}
                        </span>
                      )}
                      {v.banner === "unreleased" && (
                        <span class="inline-block rounded px-hsp-xs py-vsp-3xs text-caption bg-info/10 text-info">
                          {labels.unreleased}
                        </span>
                      )}
                    </td>
                    <td class="px-hsp-lg py-vsp-sm">
                      <a
                        href={v.docsHref}
                        class="text-accent underline hover:text-accent-hover"
                      >
                        {labels.docsCol}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
