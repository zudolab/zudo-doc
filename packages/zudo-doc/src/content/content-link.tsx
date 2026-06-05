/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX, VNode } from "preact";
import { SmartBreak as SmartBreakBase } from "../toc/smart-break.js";

// SmartBreak returns VNode; cast to align with JSX.IntrinsicElements["a"].children
// under compat mode. Runtime is fine since the preact/compat alias is in effect.
const SmartBreak = SmartBreakBase as unknown as (props: {
  children?: JSX.IntrinsicElements["a"]["children"];
}) => VNode;

type Props = JSX.IntrinsicElements["a"];

export function ContentLink({ href, className, children, ...rest }: Props) {
  // Block links and hash-links (heading anchors) should render without content link styling
  // (className may be a Preact SignalLike under JSX.IntrinsicElements["a"]; only split real strings)
  const classes = typeof className === "string" ? className.split(" ") : [];
  if (classes.includes("block") || classes.includes("hash-link")) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  }

  // Astro 6 wraps pure-text MDX children in a `StaticHtml` Preact component
  // whose text lives in `props.value`, not as a direct string child. Unwrap
  // when possible so path-like text gets smart-break treatment.
  const textFromChildren = extractText(children);
  const content =
    textFromChildren !== null ? (
      <SmartBreak>{textFromChildren}</SmartBreak>
    ) : (
      children
    );

  return (
    <a
      href={href}
      className={`text-accent underline hover:text-accent-hover${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {content}
    </a>
  );
}

function extractText(children: unknown): string | null {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  // Only accept a single StaticHtml-like VNode (Astro's wrapper for pure-text
  // MDX children). Arrays or VNodes with inline markup indicate mixed content
  // that must not be flattened through SmartBreak.
  if (children && typeof children === "object" && !Array.isArray(children)) {
    const v = children as { props?: { value?: unknown } };
    if (v.props && v.props.value != null) {
      if (
        typeof v.props.value === "string" ||
        v.props.value instanceof String ||
        (typeof v.props.value === "object" &&
          typeof (v.props.value as object).toString === "function")
      ) {
        const s = String(v.props.value);
        if (s && !s.startsWith("[object")) return decodeEntities(s);
      }
    }
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/&amp;/g, "&");
}
