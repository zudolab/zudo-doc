/**
 * The workspace chrome's inline icon set, traced from the accepted a3
 * prototype so the ported surface keeps its line weight and optical size.
 *
 * Sizing goes through an inline `style` rather than a Tailwind utility —
 * matching `src/theme/theme-toggle.tsx`'s idiom for raw `<svg>` elements —
 * so every icon reads its dimension from an `--icon-*` design token instead
 * of a hardcoded px value.
 */

export interface IconProps {
  /** An `--icon-*` token reference. Defaults to `--icon-sm` (16px). */
  size?: string;
}

function iconStyle(size: string | undefined) {
  const dimension = `var(${size ?? "--icon-sm"})`;
  return { width: dimension, height: dimension };
}

export function PagesIcon({ size }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      style={iconStyle(size)}
    >
      <path d="M10.5 2H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L10.5 2Z" />
      <path d="M10.5 2v3.5H14" />
      <path d="M6.5 9.5h5M6.5 12h5" strokeLinecap="round" />
    </svg>
  );
}

export function OutlineIcon({ size }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={iconStyle(size)}
    >
      <path d="M3.5 4.5h11" />
      <path d="M6.5 9h8" />
      <path d="M6.5 13.5h8" />
      <circle cx="3.9" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="3.9" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FileIcon({ size }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      style={iconStyle(size ?? "--icon-xs")}
    >
      <path d="M7 1H3.5a.8.8 0 0 0-.8.8v8.4c0 .44.36.8.8.8h5a.8.8 0 0 0 .8-.8V3.3L7 1Z" />
      <path d="M7 1v2.3h2.3" />
    </svg>
  );
}

export function ChevronLeftIcon({ size }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconStyle(size)}
    >
      <path d="M8.5 3.5 5 7l3.5 3.5" />
    </svg>
  );
}

export function ChevronRightIcon({ size }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={iconStyle(size)}
    >
      <path d="M5.5 3.5 9 7l-3.5 3.5" />
    </svg>
  );
}

export function CloseIcon({ size }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={iconStyle(size ?? "--icon-xs")}
    >
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}
