import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { AssetKind } from "../../../route-context-payload/types.js";

export interface AssetProbe {
  kind: AssetKind;
  mime: string;
  language?: string;
  lines?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  sniffOk: boolean;
}

interface ExtensionInfo {
  kind: AssetKind;
  mime: string;
  language?: string;
}

const CODE: Record<string, [string, string]> = {
  js: ["text/javascript", "javascript"],
  ts: ["text/typescript", "typescript"],
  tsx: ["text/tsx", "tsx"],
  jsx: ["text/jsx", "jsx"],
  mjs: ["text/javascript", "javascript"],
  cjs: ["text/javascript", "javascript"],
  json: ["application/json", "json"],
  yaml: ["application/yaml", "yaml"],
  yml: ["application/yaml", "yaml"],
  toml: ["application/toml", "toml"],
  css: ["text/css", "css"],
  scss: ["text/x-scss", "scss"],
  html: ["text/html", "html"],
  md: ["text/markdown", "markdown"],
  mdx: ["text/mdx", "mdx"],
  sh: ["text/x-shellscript", "bash"],
  bash: ["text/x-shellscript", "bash"],
  py: ["text/x-python", "python"],
  rb: ["text/x-ruby", "ruby"],
  go: ["text/x-go", "go"],
  rs: ["text/x-rust", "rust"],
  java: ["text/x-java-source", "java"],
  kt: ["text/x-kotlin", "kotlin"],
  swift: ["text/x-swift", "swift"],
  c: ["text/x-c", "c"],
  h: ["text/x-c", "c"],
  cpp: ["text/x-c++", "cpp"],
  hpp: ["text/x-c++", "cpp"],
  cs: ["text/x-csharp", "csharp"],
  php: ["application/x-httpd-php", "php"],
  sql: ["application/sql", "sql"],
  xml: ["application/xml", "xml"],
};

const TEXT: Record<string, string> = {
  txt: "text/plain",
  log: "text/plain",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  env: "text/plain",
  conf: "text/plain",
  ini: "text/plain",
};

function extensionInfo(absPath: string): ExtensionInfo {
  const ext = extname(absPath).slice(1).toLowerCase();
  const code = CODE[ext];
  if (code) return { kind: "code", mime: code[0], language: code[1] };
  if (TEXT[ext]) return { kind: "text", mime: TEXT[ext] };
  if (ext === "png") return { kind: "image", mime: "image/png" };
  if (ext === "jpg" || ext === "jpeg") return { kind: "image", mime: "image/jpeg" };
  if (ext === "gif") return { kind: "image", mime: "image/gif" };
  if (ext === "webp") return { kind: "image", mime: "image/webp" };
  if (ext === "svg") return { kind: "image", mime: "image/svg+xml" };
  if (ext === "avif") return { kind: "image", mime: "image/avif" };
  if (ext === "mp4") return { kind: "video", mime: "video/mp4" };
  if (ext === "webm") return { kind: "video", mime: "video/webm" };
  if (ext === "mov") return { kind: "video", mime: "video/quicktime" };
  if (ext === "pdf") return { kind: "pdf", mime: "application/pdf" };
  if (ext === "") return { kind: "text", mime: "text/plain" };
  return { kind: "other", mime: "application/octet-stream" };
}

function startsWith(buffer: Buffer, bytes: readonly number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function png(buffer: Buffer): { ok: boolean; width?: number; height?: number } {
  const ok = startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!ok) return { ok: false };
  return buffer.length >= 24 && buffer.toString("ascii", 12, 16) === "IHDR"
    ? { ok: true, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    : { ok: true };
}

function jpeg(buffer: Buffer): { ok: boolean; width?: number; height?: number } {
  if (!startsWith(buffer, [0xff, 0xd8])) return { ok: false };
  let offset = 2;
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker == null) break;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return { ok: true };
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return { ok: true };
    if ((marker === 0xc0 || marker === 0xc2) && length >= 7) {
      return {
        ok: true,
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  return { ok: true };
}

function gif(buffer: Buffer): { ok: boolean; width?: number; height?: number } {
  const signature = buffer.toString("ascii", 0, 6);
  const ok = signature === "GIF87a" || signature === "GIF89a";
  if (!ok) return { ok: false };
  return buffer.length >= 10
    ? { ok: true, width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
    : { ok: true };
}

function uint24LE(buffer: Buffer, offset: number): number {
  return (buffer[offset] ?? 0) | ((buffer[offset + 1] ?? 0) << 8) | ((buffer[offset + 2] ?? 0) << 16);
}

function webp(buffer: Buffer): { ok: boolean; width?: number; height?: number } {
  if (
    buffer.length < 12 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return { ok: false };
  }
  if (buffer.length < 20) return { ok: true };
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    return { ok: true, width: uint24LE(buffer, 24) + 1, height: uint24LE(buffer, 27) + 1 };
  }
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const b0 = buffer[21] ?? 0;
    const b1 = buffer[22] ?? 0;
    const b2 = buffer[23] ?? 0;
    const b3 = buffer[24] ?? 0;
    return {
      ok: true,
      width: 1 + b0 + ((b1 & 0x3f) << 8),
      height: 1 + (b1 >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10),
    };
  }
  if (chunk === "VP8 " && buffer.length >= 30 && startsWith(buffer, [0x9d, 0x01, 0x2a], 23)) {
    return { ok: true, width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return { ok: true };
}

function parseSvg(buffer: Buffer): { ok: boolean; width?: number; height?: number } {
  if (buffer.subarray(0, 8192).includes(0)) return { ok: false };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return { ok: false };
  }
  const root = text.match(/^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b([^>]*)>/i);
  if (!root) return { ok: false };
  const tagPattern = /<!--[\s\S]*?-->|<\?[^>]*\?>|<![^>]*>|<\/?[A-Za-z_][^>]*>/g;
  const stack: string[] = [];
  let rootSeen = false;
  let rootClosed = false;
  let cursor = 0;
  for (const match of text.matchAll(tagPattern)) {
    const tag = match[0];
    const at = match.index;
    const gap = text.slice(cursor, at);
    if ((!rootSeen || rootClosed) && gap.trim() !== "") return { ok: false };
    if (gap.includes("<")) return { ok: false };
    cursor = at + tag.length;
    if (tag.startsWith("<!--") || tag.startsWith("<?") || tag.startsWith("<!")) continue;
    const closing = /^<\/\s*([^\s>]+)/.exec(tag);
    if (closing) {
      if (stack.pop()?.toLowerCase() !== closing[1]?.toLowerCase()) return { ok: false };
      if (stack.length === 0) rootClosed = true;
    } else if (!/\/\s*>$/.test(tag)) {
      const opening = /^<\s*([^\s/>]+)/.exec(tag)?.[1];
      if (opening) {
        if (stack.length === 0) {
          if (rootSeen || opening.toLowerCase() !== "svg") return { ok: false };
          rootSeen = true;
        }
        stack.push(opening);
      }
    } else if (stack.length === 0) {
      const opening = /^<\s*([^\s/>]+)/.exec(tag)?.[1];
      if (rootSeen || opening?.toLowerCase() !== "svg") return { ok: false };
      rootSeen = true;
      rootClosed = true;
    }
  }
  if (
    stack.length !== 0 ||
    !rootSeen ||
    !rootClosed ||
    text.slice(cursor).trim() !== ""
  ) {
    return { ok: false };
  }
  const attrs = root[1] ?? "";
  const numberAttr = (name: string): number | undefined => {
    const raw = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(attrs)?.[1];
    if (raw == null || !/^\d+(?:\.\d+)?(?:px)?$/i.test(raw.trim())) return undefined;
    return Number.parseFloat(raw);
  };
  let width = numberAttr("width"), height = numberAttr("height");
  if (width === undefined || height === undefined) {
    const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.trim().split(/[\s,]+/).map(Number);
    if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
      width ??= viewBox[2]; height ??= viewBox[3];
    }
  }
  return { ok: true, ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) };
}

interface BmffInfo { ok: boolean; brands: string[]; width?: number; height?: number; durationSec?: number }

function bmff(buffer: Buffer): BmffInfo {
  if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") return { ok: false, brands: [] };
  const ftypSize = buffer.readUInt32BE(0);
  if (ftypSize < 12) return { ok: false, brands: [] };
  const brands: string[] = [buffer.toString("ascii", 8, 12)];
  for (let offset = 16; offset + 4 <= Math.min(ftypSize, buffer.length); offset += 4) brands.push(buffer.toString("ascii", offset, offset + 4));
  let width: number | undefined, height: number | undefined, durationSec: number | undefined;
  for (let offset = 0; offset + 12 <= buffer.length; offset += 1) {
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "ispe" && offset + 20 <= buffer.length) {
      width = buffer.readUInt32BE(offset + 12); height = buffer.readUInt32BE(offset + 16);
    } else if (type === "mvhd") {
      const version = buffer[offset + 8];
      const timeOffset = offset + (version === 1 ? 28 : 20);
      const durationOffset = timeOffset + 4;
      if (durationOffset + (version === 1 ? 8 : 4) <= buffer.length) {
        const scale = buffer.readUInt32BE(timeOffset);
        const duration = version === 1 ? Number(buffer.readBigUInt64BE(durationOffset)) : buffer.readUInt32BE(durationOffset);
        if (scale > 0 && Number.isFinite(duration)) durationSec = duration / scale;
      }
    } else if (type === "tkhd") {
      const size = buffer.readUInt32BE(offset);
      if (size >= 8 && offset + size <= buffer.length && size >= 16) {
        const w = buffer.readUInt32BE(offset + size - 8) / 65536;
        const h = buffer.readUInt32BE(offset + size - 4) / 65536;
        if (w > 0 && h > 0) { width ??= w; height ??= h; }
      }
    }
  }
  return { ok: true, brands, ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}), ...(durationSec !== undefined ? { durationSec } : {}) };
}

function readVint(buffer: Buffer, offset: number): { value: number; length: number } | null {
  const first = buffer[offset];
  if (first == null || first === 0) return null;
  let mask = 0x80, length = 1;
  while ((first & mask) === 0 && length <= 8) { mask >>= 1; length += 1; }
  if (length > 8 || offset + length > buffer.length) return null;
  let value = first & (mask - 1);
  for (let i = 1; i < length; i += 1) value = value * 256 + (buffer[offset + i] ?? 0);
  return { value, length };
}

function webmDuration(buffer: Buffer): number | undefined {
  let scale = 1_000_000;
  const scaleAt = buffer.indexOf(Buffer.from([0x2a, 0xd7, 0xb1]));
  if (scaleAt !== -1) {
    const size = readVint(buffer, scaleAt + 3);
    if (size && size.value <= 8 && scaleAt + 3 + size.length + size.value <= buffer.length) {
      scale = 0;
      for (let i = 0; i < size.value; i += 1) scale = scale * 256 + (buffer[scaleAt + 3 + size.length + i] ?? 0);
    }
  }
  const durationAt = buffer.indexOf(Buffer.from([0x44, 0x89]));
  if (durationAt === -1) return undefined;
  const size = readVint(buffer, durationAt + 2);
  if (!size || (size.value !== 4 && size.value !== 8)) return undefined;
  const offset = durationAt + 2 + size.length;
  if (offset + size.value > buffer.length) return undefined;
  const duration = size.value === 4 ? buffer.readFloatBE(offset) : buffer.readDoubleBE(offset);
  return Number.isFinite(duration) ? duration * scale / 1_000_000_000 : undefined;
}

function webmUnsignedElement(buffer: Buffer, id: number): number | undefined {
  const at = buffer.indexOf(id);
  if (at === -1) return undefined;
  const size = readVint(buffer, at + 1);
  if (!size || size.value < 1 || size.value > 6) return undefined;
  const offset = at + 1 + size.length;
  if (offset + size.value > buffer.length) return undefined;
  let value = 0;
  for (let index = 0; index < size.value; index += 1) {
    value = value * 256 + (buffer[offset + index] ?? 0);
  }
  return value;
}

function lineCount(buffer: Buffer): number {
  if (buffer.length === 0) return 0;
  let lines = 1;
  for (const byte of buffer) if (byte === 0x0a) lines += 1;
  if (buffer[buffer.length - 1] === 0x0a) lines -= 1;
  return lines;
}

/** Probe an asset by extension plus magic bytes; malformed input never throws. */
export async function probeAsset(absPath: string): Promise<AssetProbe> {
  const expected = extensionInfo(absPath);
  let buffer: Buffer;
  try { buffer = await readFile(absPath); } catch { return { kind: "other", mime: "application/octet-stream", sniffOk: false }; }
  if (expected.kind === "other") return { ...expected, sniffOk: true };

  let details: { ok: boolean; width?: number; height?: number; durationSec?: number } = { ok: true };
  if (expected.mime === "image/png") details = png(buffer);
  else if (expected.mime === "image/jpeg") details = jpeg(buffer);
  else if (expected.mime === "image/gif") details = gif(buffer);
  else if (expected.mime === "image/webp") details = webp(buffer);
  else if (expected.mime === "image/svg+xml") details = parseSvg(buffer);
  else if (expected.mime === "image/avif") {
    const info = bmff(buffer); details = { ...info, ok: info.ok && info.brands.some((brand) => brand === "avif" || brand === "avis") };
  } else if (expected.mime === "video/mp4" || expected.mime === "video/quicktime") {
    const info = bmff(buffer);
    const videoBrands = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "M4A ", "qt  "]);
    details = { ...info, ok: info.ok && info.brands.some((brand) => videoBrands.has(brand)) };
  } else if (expected.mime === "video/webm") {
    details = {
      ok: startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]),
      width: webmUnsignedElement(buffer, 0xb0),
      height: webmUnsignedElement(buffer, 0xba),
      durationSec: webmDuration(buffer),
    };
  } else if (expected.mime === "application/pdf") details = { ok: buffer.toString("ascii", 0, 5) === "%PDF-" };
  else details = { ok: !buffer.subarray(0, 8192).includes(0) };

  if (!details.ok) return { kind: "other", mime: "application/octet-stream", sniffOk: false };
  return {
    ...expected,
    sniffOk: true,
    ...(expected.kind === "code" || expected.kind === "text" ? { lines: lineCount(buffer) } : {}),
    ...(details.width !== undefined ? { width: details.width } : {}),
    ...(details.height !== undefined ? { height: details.height } : {}),
    ...(details.durationSec !== undefined ? { durationSec: details.durationSec } : {}),
  };
}
