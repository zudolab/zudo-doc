/** @jsxRuntime automatic */
import type { Child } from "@takazudo/zfb/zudo-react";
import { Island } from "@takazudo/zfb";
import { HtmlPreviewWrapperInner, type HtmlPreviewWrapperProps } from "./html-preview-wrapper.js";

function reservationHeight(height: number | undefined): number {
  return height != null && height > 0 ? height : 200;
}

function HtmlPreviewReservation({
  height,
}: {
  height: number | undefined;
}): Child {
  return (
    <div
      aria-hidden="true"
      data-zd-html-preview-reservation
      style={{ height: `${reservationHeight(height)}px` }}
    />
  );
}

/**
 * HTML preview wrapper component — the public MDX-registered binding
 * (`HtmlPreview: HtmlPreviewWrapper`).
 *
 * Eager mode wraps the bare `HtmlPreviewWrapperInner` in
 * `<Island when="visible">`, mirroring the legacy `client:visible` hydration
 * timing while preserving the server-rendered controls and iframe. Visible mode
 * uses zfb's skip-SSR fallback path: static output contains only an inert
 * nonzero reservation, while the real serializable inner props remain on the
 * island marker for native visible scheduling and client mount.
 *
 * The public export name and signature are unchanged from before the
 * zudolab/zudo-doc#1925 fix, so existing consumers that register
 * `HtmlPreview: HtmlPreviewWrapper` keep working (and now hydrate correctly)
 * with no call-site change.
 */
export function HtmlPreviewWrapper(
  props: HtmlPreviewWrapperProps,
): Child {
  const { loading = "eager", ...innerProps } = props;

  if (loading === "visible") {
    const rendered = Island({
      when: "visible",
      ssrFallback: <HtmlPreviewReservation height={innerProps.height} />,
      children: <HtmlPreviewWrapperInner {...innerProps} />,
    });
    return rendered as unknown as Child;
  }

  const rendered = Island({
    when: "visible",
    children: <HtmlPreviewWrapperInner {...innerProps} />,
  });
  return rendered as unknown as Child;
}
