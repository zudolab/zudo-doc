/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Shared icon module — thin server-rendered Preact components.
//
// All icons accept an optional `className` prop for sizing and colour
// classes; callers in Preact (`class`) and React-compat (`className`)
// contexts both work because the prop name here is `className` (the
// React/compat convention), which Preact's compat layer also passes
// through transparently.
//
// The SVG elements inside use `class=` (Preact JSX attribute name for
// the DOM `class` attribute). `aria-hidden="true"` is set on all icons
// so screen-readers skip them; callers should pair them with visible or
// sr-only text labels.

import type { VNode } from "preact";

export interface IconProps {
  /** CSS class string forwarded to the root `<svg>` element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Chevron — right-pointing (d="M9 5l7 7-7 7")
// ---------------------------------------------------------------------------

export function ChevronRight({ className }: IconProps): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Chevron — left-pointing (d="M15 19l-7-7 7-7")
// ---------------------------------------------------------------------------

export function ChevronLeft({ className }: IconProps): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Search (magnifying glass)
// ---------------------------------------------------------------------------

export function Search({ className }: IconProps): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// History (clock with a circular arrow)
// ---------------------------------------------------------------------------

export function History({ className }: IconProps): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Close (×)
// ---------------------------------------------------------------------------

export function Close({ className }: IconProps): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ArrowLeft (← with horizontal bar)
// ---------------------------------------------------------------------------

export function ArrowLeft({ className }: IconProps): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={className || undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// GitHub logo
// Sourced from the GitHub Logos and Usage page (github.com/logos).
// The path is the canonical mark used throughout this project.
// ---------------------------------------------------------------------------

export function GitHub({ className }: IconProps): VNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      class={className || undefined}
      aria-hidden="true"
    >
      <path d="M12 .5C5.649.5.5 5.649.5 12a11.5 11.5 0 0 0 7.86 10.915c.575.106.785-.25.785-.556 0-.274-.01-1-.016-1.962-3.198.695-3.873-1.541-3.873-1.541-.523-1.327-1.277-1.68-1.277-1.68-1.044-.714.079-.699.079-.699 1.154.082 1.761 1.186 1.761 1.186 1.026 1.758 2.692 1.25 3.348.956.104-.743.401-1.25.73-1.537-2.553-.29-5.238-1.276-5.238-5.682 0-1.255.448-2.282 1.182-3.086-.119-.29-.512-1.458.111-3.04 0 0 .964-.309 3.159 1.18A10.98 10.98 0 0 1 12 6.036c.977.005 1.963.132 2.883.387 2.193-1.49 3.155-1.18 3.155-1.18.625 1.582.232 2.75.114 3.04.736.804 1.18 1.831 1.18 3.086 0 4.417-2.689 5.389-5.25 5.673.412.355.779 1.056.779 2.129 0 1.538-.014 2.778-.014 3.156 0 .31.207.668.79.555A11.502 11.502 0 0 0 23.5 12C23.5 5.649 18.351.5 12 .5Z" />
    </svg>
  );
}
