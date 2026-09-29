/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";

type Props = JSX.IntrinsicElements["blockquote"];

export function ContentBlockquote({ children, className, ...rest }: Props) {
  return (
    <blockquote
      className={`border-l-[3px] border-muted pl-hsp-lg text-muted italic${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </blockquote>
  );
}
