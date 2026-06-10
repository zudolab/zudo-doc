/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Island-wrapped variant of the theme toggle for the `./theme` barrel.
//
// The actual component lives in `../theme-toggle/index.tsx` (the BARE
// `@takazudo/zudo-doc/theme-toggle` subpath, #2012 E2). This wrapper is
// deliberately NOT a "use client" module: the bare module already
// carries the directive, so zfb's island scanner registers exactly one
// "ThemeToggle" island — adding the directive here would register a
// second, colliding entry for the same marker name.
import type { VNode } from "preact";
// `@takazudo/zfb` is provided by the consumer at integration time.
import { Island } from "@takazudo/zfb";
import ThemeToggleBare, {
  type ThemeToggleProps,
} from "../theme-toggle/index.js";

/**
 * Default-export click-toggle for color scheme. Wraps the bare
 * `<ThemeToggle>` in `<Island when="load">` so the SSG renderer emits a
 * `data-zfb-island="ThemeToggle"` marker the hydration runtime can
 * find at boot time. Call sites that already sit inside an island (or
 * want to control hydration timing themselves) should import the bare
 * component from `@takazudo/zudo-doc/theme-toggle` instead.
 */
export default function ThemeToggle(props: ThemeToggleProps = {}): VNode {
  const rendered = Island({
    when: "load",
    children: <ThemeToggleBare {...props} />,
  });
  return rendered as unknown as VNode;
}
