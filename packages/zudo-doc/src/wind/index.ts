import { definePreset } from "@takazudo/zfb/config";
import type { WindConfig, ZfbConfig } from "@takazudo/zfb/config";

/**
 * Placeholder for package-owned zudo-wind defaults. #4439 fills this with
 * the locked token, reset, breakpoint, and candidate-manifest configuration.
 * Keeping this as an empty object here avoids claiming CSS coverage before
 * that topic implements and verifies it.
 */
export const packageWindConfig: WindConfig = {};

/** The preset boundary lets zfb deep-merge user wind overrides over defaults. */
export const zudoDocWindPreset: Partial<ZfbConfig> = definePreset(
  "@takazudo/zudo-doc",
  { wind: packageWindConfig },
);
