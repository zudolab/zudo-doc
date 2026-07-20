import { describe, it, expect } from "vitest";
import {
  NAV_CHEVRON_ACTIVE,
  NAV_CHEVRON_INACTIVE,
  NAV_CHILD_ACTIVE,
  NAV_CHILD_INACTIVE,
  NAV_MENU_CHILD_ACTIVE,
  NAV_MENU_CHILD_INACTIVE,
  NAV_MENU_PARENT,
  NAV_MENU_PARENT_ACTIVE_SUFFIX,
  NAV_MENU_PLAIN,
  NAV_MENU_PLAIN_ACTIVE_SUFFIX,
  NAV_TOP_ACTIVE,
  NAV_TOP_INACTIVE,
} from "../nav-class-tokens.js";
import { NAV_OVERFLOW_SCRIPT } from "../nav-overflow-script.js";

const join = (tokens: readonly string[]): string => tokens.join(" ");

// Regression guard for zudolab/zudo-doc#3023. These class strings are the
// header SSR ↔ nav-overflow-script lockstep. Editing a token below is a
// deliberate design change: update the pinned expectation here AND the
// tokens can only be edited in ONE place (nav-class-tokens.ts), which is the
// whole point — the two consumers can no longer diverge. This test pins the
// values so an accidental edit can't slip through silently, and proves the
// browser-script string still carries the exact same classes.
describe("nav-class-tokens — pinned lockstep values", () => {
  it("top-level active / inactive", () => {
    expect(join(NAV_TOP_ACTIVE)).toBe("bg-fg text-bg");
    expect(join(NAV_TOP_INACTIVE)).toBe(
      "text-muted hover:text-accent hover:underline focus:underline focus:text-accent",
    );
  });

  it("dropdown chevron active / inactive", () => {
    expect(join(NAV_CHEVRON_ACTIVE)).toBe("text-bg");
    expect(join(NAV_CHEVRON_INACTIVE)).toBe("text-muted");
  });

  it("dropdown child active / inactive", () => {
    expect(join(NAV_CHILD_ACTIVE)).toBe("font-bold text-accent");
    expect(join(NAV_CHILD_INACTIVE)).toBe(
      "text-fg hover:text-accent focus-visible:text-accent",
    );
  });

  it("overflow menu recipes compose to the exact runtime strings", () => {
    expect(join(NAV_MENU_PARENT)).toBe(
      "block px-hsp-md py-vsp-2xs text-small font-bold hover:bg-accent/10 hover:underline focus-visible:underline focus-visible:text-accent text-fg hover:text-accent",
    );
    expect(join(NAV_MENU_PARENT_ACTIVE_SUFFIX)).toBe("text-accent");
    expect(join(NAV_MENU_PLAIN)).toBe(
      "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline focus-visible:text-accent text-fg hover:text-accent",
    );
    expect(join(NAV_MENU_PLAIN_ACTIVE_SUFFIX)).toBe("font-bold text-accent");
    expect(join(NAV_MENU_CHILD_ACTIVE)).toBe(
      "block pl-hsp-xl pr-hsp-md py-vsp-2xs text-small font-bold text-accent hover:bg-accent/10 hover:underline focus-visible:underline",
    );
    expect(join(NAV_MENU_CHILD_INACTIVE)).toBe(
      "block pl-hsp-xl pr-hsp-md py-vsp-2xs text-small text-fg hover:bg-accent/10 hover:text-accent hover:underline focus-visible:underline focus-visible:text-accent",
    );
  });
});

// The strings below are the ORIGINAL literals that lived in the script before
// the shared-constants refactor. Asserting the emitted script still contains
// them proves the build-time interpolation reproduced the runtime class output
// byte-for-byte — i.e. this was a no-op refactor, not a behavior change.
describe("NAV_OVERFLOW_SCRIPT emits the shared tokens verbatim", () => {
  it("top-level toggle (setTopActive)", () => {
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'a.classList.add("bg-fg", "text-bg");',
    );
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'a.classList.remove("text-muted", "hover:text-accent", "hover:underline", "focus:underline", "focus:text-accent");',
    );
  });

  it("dropdown chevron toggle", () => {
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'svg.classList.add("text-bg"); svg.classList.remove("text-muted");',
    );
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'svg.classList.add("text-muted"); svg.classList.remove("text-bg");',
    );
  });

  it("dropdown child toggle (applyActiveNav)", () => {
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'c.classList.add("font-bold", "text-accent");',
    );
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'c.classList.add("text-fg", "hover:text-accent", "focus-visible:text-accent");',
    );
  });

  it("overflow parent + plain recipes and active suffixes", () => {
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'a.className = "block px-hsp-md py-vsp-2xs text-small font-bold hover:bg-accent/10 hover:underline focus-visible:underline focus-visible:text-accent text-fg hover:text-accent";',
    );
    expect(NAV_OVERFLOW_SCRIPT).toContain('a.className += " text-accent";');
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'a2.className = "block px-hsp-md py-vsp-2xs text-small hover:bg-accent/10 hover:underline focus-visible:underline focus-visible:text-accent text-fg hover:text-accent";',
    );
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      'a2.className += " font-bold text-accent";',
    );
  });

  it("overflow child recipe (active / inactive)", () => {
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      '? "block pl-hsp-xl pr-hsp-md py-vsp-2xs text-small font-bold text-accent hover:bg-accent/10 hover:underline focus-visible:underline"',
    );
    expect(NAV_OVERFLOW_SCRIPT).toContain(
      ': "block pl-hsp-xl pr-hsp-md py-vsp-2xs text-small text-fg hover:bg-accent/10 hover:text-accent hover:underline focus-visible:underline focus-visible:text-accent";',
    );
  });
});
