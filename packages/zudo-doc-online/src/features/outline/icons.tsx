// Row affordance icons for the outline tree, traced from the accepted B-v1
// prototype (`_temp-resource/3327-zudo-doc-online/prototypes/`). All of them
// are `currentColor` strokes on a 16-unit viewBox, so a row's text color is
// the only thing that has to change to restyle them, and they are sized
// through the `--icon-*` tokens rather than raw width/height utilities.
import type { JSX } from "preact";

type IconSize = "xs" | "sm";

// Written out rather than interpolated: Tailwind extracts class names by
// scanning source text, so a template literal would generate nothing.
const SIZE_CLASS: Record<IconSize, string> = {
  xs: "size-(--icon-xs)",
  sm: "size-(--icon-sm)",
};

export interface IconProps {
  size?: IconSize;
}

function svgProps(size: IconSize): JSX.SVGAttributes<SVGSVGElement> {
  return {
    "aria-hidden": "true",
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: SIZE_CLASS[size],
  };
}

export function HomeIcon({ size = "sm" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M2.5 7.5 8 2.75l5.5 4.75" />
      <path d="M4 6.75v6.5h8v-6.5" />
    </svg>
  );
}

export function FolderIcon({ size = "sm" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M1.75 4.5c0-.69.56-1.25 1.25-1.25h2.9l1.5 1.75h5.85c.69 0 1.25.56 1.25 1.25v5.5c0 .69-.56 1.25-1.25 1.25H3c-.69 0-1.25-.56-1.25-1.25v-7.25z" />
    </svg>
  );
}

export function PageIcon({ size = "sm" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 1.75h5.5l3 3v9.5h-8.5z" />
      <path d="M9.5 1.75v3h3" />
    </svg>
  );
}

export function CaretIcon({ size = "xs", open }: IconProps & { open: boolean }) {
  return (
    <svg {...svgProps(size)}>
      {open ? <path d="M4 6l4 4 4-4" /> : <path d="M6 4l4 4-4 4" />}
    </svg>
  );
}

export function PencilIcon({ size = "xs" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M11.3 2.6l2.1 2.1L5.2 12.9l-2.8.7.7-2.8z" />
    </svg>
  );
}

export function TrashIcon({ size = "xs" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M2.5 4.5h11M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M4 4.5l.7 8.4a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.4" />
    </svg>
  );
}

export function ArrowUpIcon({ size = "xs" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 12.75v-9.5M4 7.25 8 3.25l4 4" />
    </svg>
  );
}

export function ArrowDownIcon({ size = "xs" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3.25v9.5M4 8.75l4 4 4-4" />
    </svg>
  );
}

export function MoveToIcon({ size = "xs" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M1.75 5c0-.69.56-1.25 1.25-1.25h2.4l1.25 1.5h4.1c.69 0 1.25.56 1.25 1.25" />
      <path d="M6.75 11.5h7.5M11.5 8.75l2.75 2.75-2.75 2.75" />
      <path d="M3 12.25h1.75" />
    </svg>
  );
}

export function PlusIcon({ size = "xs" }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </svg>
  );
}
