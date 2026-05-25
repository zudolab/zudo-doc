/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren } from "preact";

type Props = {
  children?: ComponentChildren;
  className?: string;
  [key: string]: any;
};

export function ContentStrong({ children, className, ...rest }: Props) {
  return (
    <strong
      className={`font-bold text-fg${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </strong>
  );
}
