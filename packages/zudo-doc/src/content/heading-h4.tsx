/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["h4"];

export function HeadingH4({ id, children, className, ...rest }: Props) {
  return (
    <h4
      id={id}
      class={`text-body font-semibold leading-snug pt-vsp-xs border-t border-transparent${className ? ` ${className}` : ""}`}
      style={
        {
          borderImage:
            "linear-gradient(to right, var(--color-muted), transparent) 1",
        } as JSX.CSSProperties
      }
      {...rest}
    >
      {children}
    </h4>
  );
}
