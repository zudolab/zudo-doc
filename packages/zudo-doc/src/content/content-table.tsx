/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["table"];

export function ContentTable({ children, class: klass, ...rest }: Props) {
  return (
    <div class="overflow-x-auto">
      <table
        class={`w-full border-collapse text-small${klass ? ` ${klass}` : ""}`}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}
