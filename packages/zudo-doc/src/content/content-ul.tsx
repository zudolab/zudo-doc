/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren } from "preact";

type Props = {
  children?: ComponentChildren;
  className?: string;
  [key: string]: any;
};

// 2em indent via inline style — Tailwind v4 does not generate arbitrary values from these TSX files (#244)
export function ContentUl({ children, className, ...rest }: Props) {
  return (
    <ul
      {...rest}
      className={className || undefined}
      style={{ paddingLeft: "2em", listStyleType: "disc" }}
    >
      {children}
    </ul>
  );
}
