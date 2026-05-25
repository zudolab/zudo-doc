/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { ComponentChildren } from "preact";

type Props = {
  children?: ComponentChildren;
  className?: string;
  [key: string]: any;
};

export function ContentTable({ children, className, ...rest }: Props) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse text-small${className ? ` ${className}` : ""}`}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}
