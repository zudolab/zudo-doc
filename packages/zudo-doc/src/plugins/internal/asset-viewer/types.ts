import type { AssetIndexEntry } from "../../../route-context-payload/types.js";

/** Complete build-time record consumed by asset viewer routes and indexes. */
export interface AssetRecord extends AssetIndexEntry {
  createdDate?: string;
  updatedDate?: string;
  author?: string;
  linkedFrom: Array<{
    href: string;
    title: string;
    crumb: string;
    context: string;
    locale?: string;
    version?: string;
  }>;
  truncated: boolean;
  previewable: boolean;
  html?: string;
  plain?: string;
}

export type AssetRecords = Record<string, AssetRecord>;
