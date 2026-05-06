/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren } from "preact";

type Props = {
  children?: ComponentChildren;
  [key: string]: any;
};

// Passthrough: no custom styles needed for <p> (inherits from .zd-content base).
// Override claimed to enable future Tailwind utilities without CSS cascade conflicts.
export function ContentParagraph({ children, ...rest }: Props) {
  return <p {...rest}>{children}</p>;
}
