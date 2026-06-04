/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";

type Props = JSX.IntrinsicElements["table"];

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
