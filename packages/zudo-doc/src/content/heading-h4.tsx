/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["h4"];

export function HeadingH4({ id, children, class: klass, ...rest }: Props) {
  return (
    <h4
      id={id}
      class={`text-body font-semibold leading-snug pt-vsp-xs border-t border-transparent${klass ? ` ${klass}` : ""}`}
      style={{
          "border-image":
            "linear-gradient(to right, var(--color-muted), transparent) 1",
      }}
      {...rest}
    >
      {children}
    </h4>
  );
}
