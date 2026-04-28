/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { VNode } from "preact";

/**
 * Default label used when the consumer doesn't pass one. The legacy
 * Astro template translated `doc.editPage` via the project's i18n
 * module; v2 stays framework-agnostic and lets the caller pass the
 * already-translated label as `label` instead. The English string is
 * mirrored verbatim from the legacy translations table.
 */
export const DEFAULT_EDIT_LINK_LABEL = "Edit this page";

export interface EditLinkProps {
  /**
   * Final, pre-computed edit URL. The legacy Astro version derived
   * this from `settings.editUrl + contentDir + entryId`; that
   * computation belongs in the consumer (so this v2 component has no
   * upward dependency on the project settings module).
   *
   * When `null` / `undefined` / empty string the link is suppressed
   * entirely — the component returns `null` to mirror the
   * `editUrl && (...)` guard in the original template.
   */
  editUrl?: string | null;
  /**
   * Display text for the link. The legacy template called
   * `t("doc.editPage", locale)`; consumers should resolve their i18n
   * lookup upstream and pass the result here. Defaults to
   * `"Edit this page"` so the component degrades to the original
   * English label when no translation is provided.
   */
  label?: string;
}

/**
 * "Edit this page" link — JSX port of `src/components/edit-link.astro`.
 *
 * The legacy component owned three concerns: URL computation, i18n
 * lookup, and presentation. v2 keeps only presentation; URL and label
 * are pre-resolved by the caller. This matches the breadcrumb subpath
 * pattern of "no settings/i18n imports inside the v2 package".
 */
export function EditLink(props: EditLinkProps): VNode | null {
  const { editUrl, label = DEFAULT_EDIT_LINK_LABEL } = props;
  if (!editUrl) return null;

  return (
    <a
      href={editUrl}
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
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
      <span>{label}</span>
    </a>
  );
}
