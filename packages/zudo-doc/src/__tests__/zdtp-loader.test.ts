import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelConfig, PanelInstanceHandle } from "@takazudo/zdtp";

const zdtp = vi.hoisted(() => ({ configurePanel: vi.fn() }));
vi.mock("@takazudo/zdtp", () => zdtp);

import { configurePanelIfActive } from "../zdtp-loader.js";

beforeEach(() => vi.clearAllMocks());

describe("configurePanelIfActive", () => {
  it("does not mount the opaque panel after the activating scope is disposed", () => {
    const controller = new AbortController();
    controller.abort();

    expect(
      configurePanelIfActive(controller.signal, {} as PanelConfig),
    ).toBeNull();
    expect(zdtp.configurePanel).not.toHaveBeenCalled();
  });

  it("hands an active configuration to zdtp and returns its document handle", () => {
    const handle = { destroy: vi.fn() } as unknown as PanelInstanceHandle;
    zdtp.configurePanel.mockReturnValue(handle);

    expect(
      configurePanelIfActive(new AbortController().signal, {} as PanelConfig),
    ).toBe(handle);
    expect(zdtp.configurePanel).toHaveBeenCalledExactlyOnceWith({});
  });
});
