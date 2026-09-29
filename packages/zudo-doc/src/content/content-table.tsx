/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";

type Props = JSX.IntrinsicElements["table"];

export function ContentTable({ children, className, ...rest }: Props) {
  return (
    <div class="overflow-x-auto">
      <table
        class={`w-full border-collapse text-small${className ? ` ${className}` : ""}`}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}
