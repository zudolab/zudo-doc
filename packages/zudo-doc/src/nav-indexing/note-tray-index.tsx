/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import type { JSX } from "preact";
import { CardList } from "./note-tray-index-parts/card-list.js";
import { IndexList } from "./note-tray-index-parts/index-list.js";
import { Timeline } from "./note-tray-index-parts/timeline.js";
import type { TagLink, TagNavLabels } from "./types.js";
import type { NoteTrayOrder } from "../note-tray-model/index.js";

export type NoteTrayIndexStyle = "index" | "cards" | "timeline";

export interface NoteTrayIndexItem {
  slug: string;
  label: string;
  description?: string;
  href?: string;
  hasPage?: boolean;
  children: NoteTrayIndexItem[];
  rank?: number;
  date?: string;
  updated?: string;
  tagLinks?: TagLink[];
}

export interface NoteTrayIndexProps {
  items: NoteTrayIndexItem[];
  style?: NoteTrayIndexStyle;
  showDate?: boolean;
  locale: string;
  updatedLabel: string;
  dated: boolean;
  order?: NoteTrayOrder;
  tagLabels?: TagNavLabels;
}

export function NoteTrayIndex(props: NoteTrayIndexProps): JSX.Element | null {
  if (props.items.length === 0) return null;
  if (props.style === "timeline" && !props.dated) {
    throw new Error('[zudo-doc] <NoteTrayIndex style="timeline"> requires a dated note tray.');
  }
  switch (props.style ?? "index") {
    case "cards":
      return <CardList {...props} />;
    case "timeline":
      return <Timeline {...props} />;
    default:
      return <IndexList {...props} />;
  }
}
