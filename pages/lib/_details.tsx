/** @jsxRuntime automatic */
// Host-side MDX wrapper for <Details> — a trivial passthrough to the
// package-owned component.
//
// The package component accepts zudo-react children. MDX passes slot content
// as `children`, so the mapping is direct. The title prop (default "Details")
// is forwarded unchanged.

import type { Child } from "@takazudo/zfb/zudo-react";
import { Details } from "@takazudo/zudo-doc/details";

export interface DetailsWrapperProps {
  /** Summary label shown in the <summary> element. Defaults to "Details". */
  title?: string;
  /** MDX slot content rendered inside the collapsed body. */
  children?: Child;
}

/**
 * Passthrough wrapper for the package Details component.
 *
 * Used in pages/_mdx-components.ts as the Details binding so that MDX
 * content using `<Details title="...">...</Details>` renders correctly
 * on zfb routes.
 */
export function DetailsWrapper({ title, children }: DetailsWrapperProps): Child {
  return <Details title={title}>{children}</Details>;
}
