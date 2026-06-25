/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Precedence stub for A2 route-injection build proof (A2 #2363).
// This pages/404.tsx stub INTENTIONALLY collides with the package's injected
// /404 route. Per Decision 6 (ADR route-injection-seam.md), the user's
// pages/ stub wins — the injected route is silently dropped.
// The test asserts this output (STUB-WINS-UNIQUE-MARKER) appears in dist/404.html
// rather than the package's default "Page Not Found" text.

export const frontmatter = { title: "404" };

export default function StubNotFound() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>404 — STUB-WINS-UNIQUE-MARKER</title>
      </head>
      <body>
        <h1>STUB-WINS-UNIQUE-MARKER</h1>
        <p>This is the user-owned pages/404.tsx stub — it wins over the injected package route.</p>
      </body>
    </html>
  );
}
