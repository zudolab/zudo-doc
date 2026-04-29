/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";
import { DocHistoryIsland, type DocHistoryIslandProps } from "./doc-history-island.js";

/**
 * Default label used when the consumer doesn't pass one. The legacy
 * Astro template translated `doc.viewSource` via the project's i18n
 * module; v2 stays framework-agnostic, so callers resolve their
 * translation upstream and pass the result here. The English string
 * is mirrored verbatim from the legacy translations table so the
 * component degrades to the original wording when no override is
 * supplied.
 */
export const DEFAULT_VIEW_SOURCE_LABEL = "View source on GitHub";

export interface BodyFootUtilAreaProps {
  /**
   * Final, pre-computed GitHub source URL. The legacy template
   * derived this from `settings.githubUrl + contentDir + entryId`; the
   * v2 component delegates that computation to the consumer (no
   * upstream dependency on the project settings module).
   *
   * When falsy, the view-source link is suppressed.
   */
  sourceUrl?: string | null;
  /**
   * Display text for the view-source link. Defaults to
   * `"View source on GitHub"`; pass the i18n-resolved string from
   * upstream to localise.
   */
  viewSourceLabel?: string;
  /**
   * When provided, mounts the `DocHistoryIsland` SSR-skip wrapper.
   * The legacy Astro template owned three gating predicates
   * (`utilSettings.docHistory`, `currentSlug`, and the per-page /
   * `isCategoryIndex` resolution); v2 collapses all of those into a
   * single nullable prop so the v2 package stays oblivious to the
   * project's settings shape.
   *
   * Pass `null` / `undefined` to suppress the history trigger
   * entirely.
   */
  docHistory?: DocHistoryIslandProps | null;
}

/**
 * Footer utility area shown below an article body — composes the
 * "View source on GitHub" link and the `DocHistoryIsland` SSR-skip
 * wrapper. JSX port of `src/components/body-foot-util-area.astro`.
 *
 * Returns `null` when neither slot has anything to render, mirroring
 * the `hasContent && (...)` guard in the original template so the
 * surrounding `<section>` (with its top border + spacing) doesn't
 * appear as an empty band.
 */
export function BodyFootUtilArea(props: BodyFootUtilAreaProps): VNode | null {
  const { sourceUrl, viewSourceLabel = DEFAULT_VIEW_SOURCE_LABEL, docHistory } =
    props;

  const showSource = Boolean(sourceUrl);
  const showHistory = Boolean(docHistory);
  if (!showSource && !showHistory) return null;

  return (
    <section
      class="mt-vsp-xl border-t border-muted pt-vsp-md"
      aria-label="Document utilities"
    >
      {showSource && (
        <div class="mb-vsp-md">
          <a
            href={sourceUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-hsp-2xs text-small text-muted hover:text-accent"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-[0.875rem] w-[0.875rem]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14 3h7m0 0v7m0-7L10 14"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 5h5m-5 0a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5"
              />
            </svg>
            <span>{viewSourceLabel}</span>
          </a>
        </div>
      )}
      {showHistory && docHistory && (
        <>
          {/* Preserves migration-check parity: the Astro build SSR-rendered this heading inside the dialog markup; the checker matches the literal string "Revision History". */}
          <h2 class="sr-only">Revision History</h2>
          <DocHistoryIsland {...docHistory} />
        </>
      )}
    </section>
  );
}
