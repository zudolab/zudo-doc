/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren } from "preact";

type Props = {
  children?: ComponentChildren;
  className?: string;
  [key: string]: any;
};

// 2em indent: enough room for 2-digit markers like "66." (#244)
// Inline style — Tailwind v4 does not generate arbitrary values from these TSX files
export function ContentOl({ children, className, ...rest }: Props) {
  return (
    <ol
      {...rest}
      className={className || undefined}
      style={{ paddingLeft: "2em", listStyleType: "decimal" }}
    >
      {children}
    </ol>
  );
}
