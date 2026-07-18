import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../routes");

describe("package-owned home route settings", () => {
  it.each(["index.tsx", "locale-index.tsx"])(
    "%s passes the shared wide-home setting to HomePageView",
    (routeFile) => {
      const source = readFileSync(resolve(routesDir, routeFile), "utf8");

      expect(source).toMatch(/import \{[^}]*settings[^}]*\} from "\.\/_context\.js"/);
      expect(source).toContain("wide={settings.home?.wide ?? false}");
    },
  );
});
