/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

type Props = JSX.IntrinsicElements["ol"];

// 2em indent: enough room for 2-digit markers like "66." (#244)
// Inline style — Tailwind v4 does not generate arbitrary values from these TSX files
export function ContentOl({ children, class: klass, start, ...rest }: Props) {
  return (
    <ol
      {...rest}
      start={start}
      class={klass || undefined}
      style={{ "padding-left": "2em", "list-style-type": "decimal" }}
    >
      {children}
    </ol>
  );
}
