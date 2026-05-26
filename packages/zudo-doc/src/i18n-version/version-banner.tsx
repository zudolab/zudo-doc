/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Version banner shown above the article on versioned doc pages.
//
// Pure presentational primitive — every label and URL the host project
// would derive from settings/i18n is passed in via props. The v2 package
// itself stays free of any settings/i18n/utils coupling.
//
// Renders a `<div role="note">` so screen readers announce the
// banner contents. The role also doubles as the e2e selector
// (`[role='note']`) used by versioning specs.

import type { VNode } from "preact";

export interface VersionBannerLabels {
  /** Banner body text (e.g. "You are viewing documentation for an older version."). */
  message: string;
  /** Link label to the latest version (e.g. "View the latest version"). */
  latestLink: string;
}

export interface VersionBannerProps {
  /** Variant — drives icon/colour selection downstream and is exposed via `data-variant`. */
  type: "unmaintained" | "unreleased";
  /** Pre-resolved href to the latest version of the current page. */
  latestUrl: string;
  /** UI strings — see `VersionBannerLabels`. */
  labels: VersionBannerLabels;
}

/**
 * Banner element rendered above the article body on versioned doc
 * pages. Displays a localized notice and a link to the latest version
 * of the current page.
 *
 * The host typically resolves `labels` via `t("version.banner.*", lang)`
 * and `latestUrl` via the project's URL helpers.
 */
export function VersionBanner(props: VersionBannerProps): VNode {
  const { type, latestUrl, labels } = props;
  return (
    <div
      role="note"
      data-version-banner
      data-variant={type}
      class="mb-vsp-md border border-warning/30 bg-warning/5 px-hsp-lg py-vsp-sm text-small text-muted rounded"
    >
      <span>{labels.message}</span>{" "}
      <a href={latestUrl} class="underline text-accent hover:text-accent-hover">
        {labels.latestLink}
      </a>
    </div>
  );
}
