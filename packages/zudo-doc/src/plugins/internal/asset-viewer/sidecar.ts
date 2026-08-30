import { readFile } from "node:fs/promises";

export interface AssetSidecar {
  title?: string;
  description?: string;
}
const MAX_SIDECAR_BYTES = 2 * 1024;

/** Read the optional `<asset>.meta.json`; invalid sidecars warn and are ignored. */
export async function readSidecar(absPath: string): Promise<AssetSidecar | undefined> {
  const sidecarPath = `${absPath}.meta.json`;
  let bytes: Buffer;
  try {
    bytes = await readFile(sidecarPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    console.warn(`[asset-viewer] unable to read sidecar ${sidecarPath}`);
    return undefined;
  }
  if (bytes.byteLength > MAX_SIDECAR_BYTES) {
    console.warn(`[asset-viewer] ignoring sidecar larger than 2 KB: ${sidecarPath}`);
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (value == null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const record = value as Record<string, unknown>;
    if (record.title !== undefined && typeof record.title !== "string") throw new Error();
    if (record.description !== undefined && typeof record.description !== "string") throw new Error();
    return {
      ...(typeof record.title === "string" ? { title: record.title } : {}),
      ...(typeof record.description === "string" ? { description: record.description } : {}),
    };
  } catch {
    console.warn(`[asset-viewer] ignoring malformed sidecar: ${sidecarPath}`);
    return undefined;
  }
}
