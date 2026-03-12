import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Read the base path from settings.ts so URLs work regardless of config */
export function getBasePath(): string {
  const settingsPath = join(process.cwd(), "src", "config", "settings.ts");
  const content = readFileSync(settingsPath, "utf-8");
  const match = content.match(/base:\s*["']([^"']+)["']/);
  return match ? match[1].replace(/\/$/, "") : "";
}
