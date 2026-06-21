/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for `enableClientRouter` gating in `<DocLayout>` /
 * `<DocLayoutWithDefaults>`.
 *
 * Acceptance contract for S1 (ClientRouter Opt-Out epic #2274): when
 * `enableClientRouter={false}` is passed, the zfb SPA soft-swap router must
 * NOT be mounted — meaning the `<meta name="zfb-view-transitions-enabled">`,
 * `<meta name="zfb-preserve-html-attrs">`, and the route-announcer emitted by
 * `ClientRouter()` must all be absent from the SSG output. With the prop
 * omitted or set to `true`, those meta tags must appear (default/enabled path).
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { DocLayoutWithDefaults } from "../doc-layout-with-defaults.js";

describe("DocLayoutWithDefaults — ClientRouter gating", () => {
  it("omits ClientRouter meta when enableClientRouter={false}", () => {
    const html = render(
      <DocLayoutWithDefaults title="No Router" enableClientRouter={false}>
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).not.toContain('name="zfb-view-transitions-enabled"');
    expect(html).not.toContain('name="zfb-preserve-html-attrs"');
    // Route-announcer emitted by ClientRouter — absent when router is off.
    expect(html).not.toContain("route-announcer");
  });

  it("includes ClientRouter meta when enableClientRouter is omitted (default=true)", () => {
    const html = render(
      <DocLayoutWithDefaults title="With Router">
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).toContain('name="zfb-view-transitions-enabled"');
    expect(html).toContain('name="zfb-preserve-html-attrs"');
  });

  it("includes ClientRouter meta when enableClientRouter={true}", () => {
    const html = render(
      <DocLayoutWithDefaults title="Router Explicit True" enableClientRouter={true}>
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).toContain('name="zfb-view-transitions-enabled"');
    expect(html).toContain('name="zfb-preserve-html-attrs"');
  });
});
