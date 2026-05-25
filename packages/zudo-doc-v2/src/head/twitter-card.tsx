import type { JSX } from "preact";
import type { HeadProps } from "./types";

/**
 * Twitter card meta tags. The host renders this only when a card type is
 * configured; this component itself assumes `card` is set and emits twitter:card
 * plus whichever other twitter:* fields the caller has supplied.
 *
 * Field order: card → site → creator → title → description → image. Preserve
 * this order to keep snapshot diffs predictable.
 */
export function TwitterCard(props: {
  card: NonNullable<HeadProps["twitterCard"]>;
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
}): JSX.Element {
  return (
    <>
      <meta name="twitter:card" content={props.card} />
      {props.site !== undefined && (
        <meta name="twitter:site" content={props.site} />
      )}
      {props.creator !== undefined && (
        <meta name="twitter:creator" content={props.creator} />
      )}
      {props.title !== undefined && (
        <meta name="twitter:title" content={props.title} />
      )}
      {props.description !== undefined && (
        <meta name="twitter:description" content={props.description} />
      )}
      {props.image !== undefined && (
        <meta name="twitter:image" content={props.image} />
      )}
    </>
  );
}
