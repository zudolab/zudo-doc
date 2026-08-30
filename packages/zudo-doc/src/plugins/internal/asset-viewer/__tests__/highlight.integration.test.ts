import { describe, expect, it } from "vitest";

import { highlightAsset, withLineIds } from "../highlight.js";

let peerAvailable = true;
try {
  await import("@takazudo/zfb-md-wasm/highlight");
} catch {
  peerAvailable = false;
}

describe("asset viewer real WASM highlighting", () => {
  if (!peerAvailable) {
    it.skip("skips integration because the optional WASM peer is unavailable", () => {});
  } else {
    it("emits semantic class markup and accepts an unknown language as plain", async () => {
      const known = await highlightAsset(
        'const answer = "yes";\nconsole.log(answer);',
        "javascript",
      );
      expect(known.plain).toBe(false);
      expect(known.html).toContain('<pre class="hi-root"><code>');
      expect(known.html).toContain('class="hi-kw"');
      expect(known.html).toContain('class="line"');
      expect(withLineIds(known.html!)).toContain('id="L2"');

      const unknown = await highlightAsset("<tag>&", "not-a-bundled-syntax");
      expect(unknown.plain).toBe(true);
      expect(unknown.html).toBe(
        '<pre class="hi-root"><code><span class="line">&lt;tag&gt;&amp;</span></code></pre>',
      );
    });
  }
});
