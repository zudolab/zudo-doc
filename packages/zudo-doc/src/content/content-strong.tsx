/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";

type Props = JSX.IntrinsicElements["strong"];

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
