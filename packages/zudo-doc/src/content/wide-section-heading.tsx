/** @jsxRuntime automatic */
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { HeadingH2 } from "./heading-h2.js";

type Props = JSX.IntrinsicElements["h2"];

/**
 * Section heading for composed navigation sections (home `sections`, or an
 * authored MDX page). It IS the content `HeadingH2` — same typography, the 3px
 * gradient upper rule with `pt-vsp-sm`, and every theme pack's `.zd-content h2`
 * treatment — exposed under a name that does not depend on MDX `##` mapping.
 * It owns no outside margin: the placing parent owns the surrounding gaps.
 */
export function WideSectionHeading(props: Props) {
  return <HeadingH2 data-zd-section-heading="" {...props} />;
}
