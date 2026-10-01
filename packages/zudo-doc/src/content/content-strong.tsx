/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["strong"];

export function ContentStrong({ children, class: klass, ...rest }: Props) {
  return (
    <strong
      class={`font-bold text-fg${klass ? ` ${klass}` : ""}`}
      {...rest}
    >
      {children}
    </strong>
  );
}
