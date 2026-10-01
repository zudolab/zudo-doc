import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { h } from "@takazudo/zfb/zudo-react";
import type { HeadProps } from "./types.js";

/**
 * Open Graph meta tags. Emits og:title (always — defaults to `title`) plus
 * any other og:* fields the caller has supplied.
 *
 * Output order matches the legacy doc-layout emission for byte parity:
 * og:title → og:description → og:type → og:url → og:image → og:site_name.
 * New og:* tags should be appended at the end of the list, never reordered,
 * to keep snapshot diffs minimal.
 */
export function OgTags(props: {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogUrl?: string;
  ogImage?: string;
  ogSiteName?: string;
}): JSX.Element {
  const ogTitle = props.ogTitle ?? props.title;
  const ogDescription = props.ogDescription ?? props.description;
  return (
    <>
      {h("meta", { property: "og:title", content: ogTitle })}
      {ogDescription !== undefined && (
        h("meta", { property: "og:description", content: ogDescription })
      )}
      {props.ogType !== undefined && (
        h("meta", { property: "og:type", content: props.ogType })
      )}
      {props.ogUrl !== undefined && (
        h("meta", { property: "og:url", content: props.ogUrl })
      )}
      {props.ogImage !== undefined && (
        h("meta", { property: "og:image", content: props.ogImage })
      )}
      {props.ogSiteName !== undefined && (
        h("meta", { property: "og:site_name", content: props.ogSiteName })
      )}
    </>
  );
}

export type OgInputs = Pick<
  HeadProps,
  | "ogTitle"
  | "ogDescription"
  | "ogType"
  | "ogUrl"
  | "ogImage"
  | "ogSiteName"
>;
