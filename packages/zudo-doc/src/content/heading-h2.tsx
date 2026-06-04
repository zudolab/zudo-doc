/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";

type Props = JSX.IntrinsicElements["h2"];

export function HeadingH2({ id, children, className, ...rest }: Props) {
  return (
    <h2
      id={id}
      className={`text-title font-bold leading-tight pt-vsp-sm border-t-[3px] border-transparent${className ? ` ${className}` : ""}`}
      style={
        {
          borderImage:
            "linear-gradient(to right, var(--color-fg), transparent) 1",
        } as JSX.CSSProperties
      }
      {...rest}
    >
      {children}
    </h2>
  );
}
