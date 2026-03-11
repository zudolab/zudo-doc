import { execSync } from "child_process";

export function installDependencies(dir: string, pm: string): void {
  const commands: Record<string, string> = {
    pnpm: "pnpm install",
    npm: "npm install",
    yarn: "yarn",
    bun: "bun install",
  };
  const cmd = commands[pm] || "npm install";
  // Use pipe to avoid garbled output when used alongside spinner
  execSync(cmd, { cwd: dir, stdio: "pipe" });
}

export function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}
