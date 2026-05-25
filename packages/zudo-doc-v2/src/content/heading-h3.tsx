/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren, JSX } from "preact";

type Props = {
  id?: string;
  className?: string;
  children?: ComponentChildren;
  [key: string]: any;
};

export function HeadingH3({ id, children, className, ...rest }: Props) {
  return (
    <h3
      id={id}
      className={`text-body font-bold leading-snug pt-vsp-xs border-t-[2px] border-transparent${className ? ` ${className}` : ""}`}
      style={
        {
          borderImage:
            "linear-gradient(to right, var(--color-muted), transparent) 1",
        } as JSX.CSSProperties
      }
      {...rest}
    >
      {children}
    </h3>
  );
}
