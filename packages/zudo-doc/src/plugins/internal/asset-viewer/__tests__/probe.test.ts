import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { probeAsset } from "../probe.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function probe(name: string, bytes: Uint8Array | string) {
  const root = await mkdtemp(join(tmpdir(), "zudo-asset-probe-")); roots.push(root);
  const path = join(root, name); await writeFile(path, bytes); return probeAsset(path);
}

function ftyp(brand: string, compatibles: string[] = []): Buffer {
  const body = Buffer.concat([Buffer.from(brand, "ascii"), Buffer.alloc(4), ...compatibles.map((item) => Buffer.from(item, "ascii"))]);
  const box = Buffer.alloc(8); box.writeUInt32BE(body.length + 8); box.write("ftyp", 4, "ascii"); return Buffer.concat([box, body]);
}

describe("probeAsset", () => {
  it.each([
    ["source.ts", "export const x = 1;\n", "code", "text/typescript", "typescript", 1],
    ["README", "hello\nworld", "text", "text/plain", undefined, 2],
    ["data.csv", "a,b\n1,2\n", "text", "text/csv", undefined, 2],
  ])("sniffs text-like %s", async (name, bytes, kind, mime, language, lines) => {
    expect(await probe(name, bytes)).toMatchObject({ kind, mime, lines, sniffOk: true, ...(language ? { language } : {}) });
  });

  it("rejects NUL bytes in code, text and extensionless files", async () => {
    for (const name of ["bad.ts", "bad.txt", "README"]) {
      expect(await probe(name, Buffer.from([0x61, 0, 0x62]))).toEqual({ kind: "other", mime: "application/octet-stream", sniffOk: false });
    }
  });

  it("parses PNG, GIF, JPEG and all WebP dimension headers", async () => {
    const png = Buffer.alloc(24); Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(png); png.write("IHDR", 12); png.writeUInt32BE(640, 16); png.writeUInt32BE(480, 20);
    expect(await probe("x.png", png)).toMatchObject({ kind: "image", width: 640, height: 480, sniffOk: true });
    const gif = Buffer.alloc(10); gif.write("GIF89a"); gif.writeUInt16LE(320, 6); gif.writeUInt16LE(200, 8);
    expect(await probe("x.gif", gif)).toMatchObject({ width: 320, height: 200, sniffOk: true });
    const jpeg = Buffer.from([0xff,0xd8,0xff,0xc0,0,7,8,0,100,0,200,0xff,0xd9]);
    expect(await probe("x.jpg", jpeg)).toMatchObject({ width: 200, height: 100, sniffOk: true });
    const vp8x = Buffer.alloc(30); vp8x.write("RIFF"); vp8x.write("WEBP",8); vp8x.write("VP8X",12); vp8x[24]=9; vp8x[27]=19;
    expect(await probe("x.webp", vp8x)).toMatchObject({ width: 10, height: 20, sniffOk: true });
    const vp8l = Buffer.alloc(25); vp8l.write("RIFF"); vp8l.write("WEBP",8); vp8l.write("VP8L",12); vp8l[20]=0x2f; vp8l[21]=9; vp8l[23]=4;
    expect(await probe("x.webp", vp8l)).toMatchObject({ width: 10, height: 17, sniffOk: true });
    const vp8 = Buffer.alloc(30); vp8.write("RIFF"); vp8.write("WEBP",8); vp8.write("VP8 ",12); Buffer.from([0x9d,1,0x2a]).copy(vp8,23); vp8.writeUInt16LE(123,26); vp8.writeUInt16LE(45,28);
    expect(await probe("x.webp", vp8)).toMatchObject({ width: 123, height: 45, sniffOk: true });
  });

  it("parses SVG dimensions and requires balanced XML with an svg root", async () => {
    expect(await probe("x.svg", '<svg width="20px" height="10"><g/></svg>')).toMatchObject({ width: 20, height: 10, sniffOk: true });
    expect(await probe("x.svg", '<svg viewBox="0 0 300 150"></svg>')).toMatchObject({ width: 300, height: 150, sniffOk: true });
    expect(await probe("x.svg", "<html></html>")).toMatchObject({ kind: "other", sniffOk: false });
    expect(await probe("x.svg", "<svg><g></svg>")).toMatchObject({ kind: "other", sniffOk: false });
    expect(await probe("x.svg", "<svg></svg><svg/>")).toMatchObject({ kind: "other", sniffOk: false });
    expect(await probe("x.svg", Buffer.from([0x3c,0x73,0x76,0x67,0x3e,0xff,0x3c,0x2f,0x73,0x76,0x67,0x3e]))).toMatchObject({ kind: "other", sniffOk: false });
  });

  it("distinguishes AVIF from MP4 brands and reads ispe dimensions", async () => {
    const ispe = Buffer.alloc(20); ispe.writeUInt32BE(20); ispe.write("ispe",4); ispe.writeUInt32BE(800,12); ispe.writeUInt32BE(600,16);
    expect(await probe("x.avif", Buffer.concat([ftyp("avif"), ispe]))).toMatchObject({ kind: "image", width: 800, height: 600, sniffOk: true });
    expect(await probe("x.mp4", ftyp("avif"))).toMatchObject({ kind: "other", sniffOk: false });
    expect(await probe("x.avif", ftyp("isom", ["mp42"]))).toMatchObject({ kind: "other", sniffOk: false });
    expect(await probe("x.mp4", ftyp("heic"))).toMatchObject({ kind: "other", sniffOk: false });
  });

  it("reads MP4 mvhd duration and tkhd dimensions", async () => {
    const mvhd = Buffer.alloc(32); mvhd.writeUInt32BE(32); mvhd.write("mvhd",4); mvhd[8]=0; mvhd.writeUInt32BE(1000,20); mvhd.writeUInt32BE(2500,24);
    const tkhd = Buffer.alloc(40); tkhd.writeUInt32BE(40); tkhd.write("tkhd",4); tkhd.writeUInt32BE(1920*65536,32); tkhd.writeUInt32BE(1080*65536,36);
    expect(await probe("x.mp4", Buffer.concat([ftyp("isom", ["mp42"]), mvhd, tkhd]))).toMatchObject({ kind: "video", width: 1920, height: 1080, durationSec: 2.5, sniffOk: true });
    expect(await probe("x.mov", ftyp("qt  "))).toMatchObject({ kind: "video", mime: "video/quicktime", sniffOk: true });
  });

  it("sniffs WebM duration and PDF magic", async () => {
    const webm = Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3,0xb0,0x82,0x05,0x00,0xba,0x82,0x02,0xd0,0x2a,0xd7,0xb1,0x83,0x0f,0x42,0x40,0x44,0x89,0x84]), Buffer.alloc(4)]); webm.writeFloatBE(2500,22);
    expect(await probe("x.webm", webm)).toMatchObject({ kind: "video", width: 1280, height: 720, durationSec: 2.5, sniffOk: true });
    expect(await probe("x.pdf", "%PDF-1.7\n")).toMatchObject({ kind: "pdf", sniffOk: true });
  });

  it.each(["png", "jpg", "gif", "webp", "svg", "avif", "mp4", "webm", "mov", "pdf"])("downgrades mismatched and truncated .%s headers", async (ext) => {
    expect(await probe(`x.${ext}`, Buffer.from([1,2,3]))).toEqual({ kind: "other", mime: "application/octet-stream", sniffOk: false });
  });

  it("retains the kind with partial info when magic matches but headers are truncated", async () => {
    expect(await probe("x.png", Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toMatchObject({ kind: "image", sniffOk: true });
    expect(await probe("x.jpg", Buffer.from([0xff,0xd8]))).toMatchObject({ kind: "image", sniffOk: true });
    expect(await probe("x.gif", "GIF89a")).toMatchObject({ kind: "image", sniffOk: true });
    const partialWebp = Buffer.alloc(12); partialWebp.write("RIFF"); partialWebp.write("WEBP",8);
    expect(await probe("x.webp", partialWebp)).toMatchObject({ kind: "image", sniffOk: true });
    const partialAvif = Buffer.alloc(12); partialAvif.writeUInt32BE(24); partialAvif.write("ftyp",4); partialAvif.write("avif",8);
    expect(await probe("x.avif", partialAvif)).toMatchObject({ kind: "image", sniffOk: true });
  });

  it("leaves unknown binary formats as other without claiming a mismatch", async () => {
    expect(await probe("archive.zip", Buffer.from([0x50,0x4b,3,4]))).toEqual({ kind: "other", mime: "application/octet-stream", sniffOk: true });
  });
});
