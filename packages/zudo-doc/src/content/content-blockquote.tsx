/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["blockquote"];

export function ContentBlockquote({ children, className, ...rest }: Props) {
  return (
    <blockquote
      class={`border-l-[3px] border-muted pl-hsp-lg text-muted italic${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </blockquote>
  );
}
