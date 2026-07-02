/**
 * connect-adapter.test.ts
 *
 * Behavioral suite for connectToZfbHandler, targeting the real package source
 * (../connect-adapter.ts) directly. Retargeted here from the host repo's
 * src/__tests__/pages-api/plugins-transforms.test.ts (#2529), which had been
 * behavioral-testing a dead project-local copy at plugins/connect-adapter.mjs
 * (zero non-test importers — the host's zfb.config.ts never referenced it;
 * generated create-zudo-doc projects assert it must NOT ship). That copy has
 * been deleted; ../plugins.test.ts keeps only a lightweight shape check.
 *
 * Covers: next() passthrough, res.end() capture, next(err) rejection, thrown
 * errors, binary body base64 encoding, header normalisation, request shim
 * passthrough.
 */

import { describe, it, expect } from "vitest";
import { Buffer } from "node:buffer";
import { connectToZfbHandler } from "../connect-adapter.js";

const SAMPLE_ZFB_REQ = {
  method: "GET",
  url: "/doc-history/foo.json",
  headers: { accept: "application/json" },
};

describe("connectToZfbHandler — next() passthrough", () => {
  it("resolves with undefined when middleware calls next() without an error", async () => {
    const middleware = (_req: unknown, _res: unknown, next: (err?: unknown) => void) => {
      next();
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result).toBeUndefined();
  });
});

describe("connectToZfbHandler — res.end() response capture", () => {
  it("resolves with { status, headers, body, bodyEncoding } on res.end(body)", async () => {
    const middleware = (_req: unknown, res: { end: (body: string) => void }, _next: unknown) => {
      res.end("hello");
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result).not.toBeUndefined();
    expect(result!.status).toBe(200);
    expect(result!.body).toBe("hello");
    expect(result!.bodyEncoding).toBe("utf8");
  });

  it("captures statusCode set before res.end()", async () => {
    const middleware = (
      _req: unknown,
      res: { statusCode: number; end: (body: string) => void },
      _next: unknown,
    ) => {
      res.statusCode = 404;
      res.end("not found");
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.status).toBe(404);
    expect(result!.body).toBe("not found");
  });

  it("normalises header names to lowercase", async () => {
    const middleware = (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void; end: (body: string) => void },
      _next: unknown,
    ) => {
      res.setHeader("Content-Type", "application/json");
      res.end("{}");
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.headers).toHaveProperty("content-type", "application/json");
    expect(result!.headers).not.toHaveProperty("Content-Type");
  });

  it("resolves with empty string body when res.end() is called with no argument", async () => {
    const middleware = (_req: unknown, res: { end: () => void }, _next: unknown) => {
      res.end();
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.body).toBe("");
  });
});

describe("connectToZfbHandler — binary body (base64 encoding)", () => {
  it("encodes Buffer body as base64 with bodyEncoding='base64'", async () => {
    const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const middleware = (
      _req: unknown,
      res: { end: (body: Buffer) => void },
      _next: unknown,
    ) => {
      res.end(binaryData);
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.bodyEncoding).toBe("base64");
    expect(result!.body).toBe(binaryData.toString("base64"));
  });

  it("encodes Uint8Array body as base64", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const middleware = (
      _req: unknown,
      res: { end: (body: Uint8Array) => void },
      _next: unknown,
    ) => {
      res.end(bytes);
    };
    const handler = connectToZfbHandler(middleware);
    const result = await handler(SAMPLE_ZFB_REQ);
    expect(result!.bodyEncoding).toBe("base64");
  });
});

describe("connectToZfbHandler — next(err) rejection", () => {
  it("rejects the promise when next() is called with an Error", async () => {
    const middleware = (
      _req: unknown,
      _res: unknown,
      next: (err?: unknown) => void,
    ) => {
      next(new Error("middleware error"));
    };
    const handler = connectToZfbHandler(middleware);
    await expect(handler(SAMPLE_ZFB_REQ)).rejects.toThrow("middleware error");
  });

  it("wraps a non-Error next(err) in an Error", async () => {
    const middleware = (
      _req: unknown,
      _res: unknown,
      next: (err?: unknown) => void,
    ) => {
      next("string error");
    };
    const handler = connectToZfbHandler(middleware);
    await expect(handler(SAMPLE_ZFB_REQ)).rejects.toBeInstanceOf(Error);
  });
});

describe("connectToZfbHandler — thrown error inside middleware", () => {
  it("rejects the promise when the middleware body throws", async () => {
    const middleware = () => {
      throw new Error("sync throw");
    };
    const handler = connectToZfbHandler(middleware);
    await expect(handler(SAMPLE_ZFB_REQ)).rejects.toThrow("sync throw");
  });
});

describe("connectToZfbHandler — request shim passthrough", () => {
  it("passes method and url from zfbReq to the middleware req object", async () => {
    let capturedMethod: string | undefined;
    let capturedUrl: string | undefined;
    const middleware = (req: { method: string; url: string }, res: { end: () => void }) => {
      capturedMethod = req.method;
      capturedUrl = req.url;
      res.end();
    };
    const handler = connectToZfbHandler(middleware);
    await handler({ method: "GET", url: "/test/path", headers: {} });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toBe("/test/path");
  });
});
