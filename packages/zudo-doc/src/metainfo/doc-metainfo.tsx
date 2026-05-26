/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";

export interface DocMetainfoProps {
  /**
   * Pre-formatted creation date string (e.g. `"Jan 1, 2024"`).
   * The legacy `doc-metainfo.astro` called `formatDate(gitInfo.createdAt,
   * locale)` inline; v2 delegates that computation to the caller.
   * Omit (or pass `null`) to suppress the "created" row.
   */
  createdAt?: string | null;
  /**
   * Pre-formatted last-updated date string. Suppressed when equal to
   * `createdAt` (matching the original template's guard
   * `updatedAt !== createdAt`), or when null / omitted.
   */
  updatedAt?: string | null;
  /**
   * Git author name (or any attribution string). Omit to suppress.
   */
  author?: string | null;
  /**
   * Label for the "created" entry. Defaults to `"Created"`. Pass the
   * i18n-resolved string (`t("doc.created", locale)`) from upstream.
   */
  createdLabel?: string;
  /**
   * Label for the "updated" entry. Defaults to `"Updated"`.
   */
  updatedLabel?: string;
}

export const DEFAULT_CREATED_LABEL = "Created";
export const DEFAULT_UPDATED_LABEL = "Updated";

function ClockIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-icon-xs w-icon-xs"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function RefreshIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-icon-xs w-icon-xs"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function UserIcon(): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-icon-xs w-icon-xs"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

/**
 * Document meta-information strip (created date, updated date, author)
 * — JSX port of `src/components/doc-metainfo.astro`.
 *
 * The legacy component owned three responsibilities: reading
 * `settings.docMetainfo`, calling `getGitInfo(filePath)`, and
 * presentation. v2 keeps only presentation; the caller resolves git
 * info and date formatting upstream.
 *
 * Returns `null` when no displayable field is provided, mirroring the
 * original `hasInfo && (...)` guard.
 */
export function DocMetainfo(props: DocMetainfoProps): VNode | null {
  const {
    createdAt,
    updatedAt,
    author,
    createdLabel = DEFAULT_CREATED_LABEL,
    updatedLabel = DEFAULT_UPDATED_LABEL,
  } = props;

  const hasInfo =
    Boolean(createdAt) ||
    (Boolean(updatedAt) && updatedAt !== createdAt) ||
    Boolean(author);

  if (!hasInfo) return null;

  return (
    <div class="flex flex-wrap items-center gap-x-hsp-md gap-y-vsp-2xs text-caption text-fg mb-vsp-md border-t border-fg pt-vsp-xs">
      {createdAt && (
        <span class="inline-flex items-center gap-hsp-2xs">
          <ClockIcon />
          <span>
            {createdLabel} {createdAt}
          </span>
        </span>
      )}
      {updatedAt && updatedAt !== createdAt && (
        <span class="inline-flex items-center gap-hsp-2xs">
          <RefreshIcon />
          <span>
            {updatedLabel} {updatedAt}
          </span>
        </span>
      )}
      {author && (
        <span class="inline-flex items-center gap-hsp-2xs">
          <UserIcon />
          <span>{author}</span>
        </span>
      )}
    </div>
  );
}
