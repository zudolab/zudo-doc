/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["h2"];

export function HeadingH2({ id, children, class: klass, ...rest }: Props) {
  return (
    <h2
      id={id}
      class={`text-title font-bold leading-tight pt-vsp-sm border-t-[3px] border-transparent${klass ? ` ${klass}` : ""}`}
      style={{
          "border-image":
            "linear-gradient(to right, var(--color-fg), transparent) 1",
      }}
      {...rest}
    >
      {children}
    </h2>
  );
}
