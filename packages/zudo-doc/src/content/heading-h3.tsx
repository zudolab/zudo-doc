/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["h3"];

export function HeadingH3({ id, children, class: klass, ...rest }: Props) {
  return (
    <h3
      id={id}
      class={`text-body font-bold leading-snug pt-vsp-xs border-t-[2px] border-transparent${klass ? ` ${klass}` : ""}`}
      style={{
          "border-image":
            "linear-gradient(to right, var(--color-muted), transparent) 1",
      }}
      {...rest}
    >
      {children}
    </h3>
  );
}
