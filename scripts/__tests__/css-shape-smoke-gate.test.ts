import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const gate = path.join(root, ".github/actions/css-shape-smoke-gate/run.sh");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});

const fakeCurl = String.raw`#!/usr/bin/env bash
set -euo pipefail

OUTPUT=""
URL=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      OUTPUT="$2"
      shift 2
      ;;
    -*)
      shift
      ;;
    *)
      URL="$1"
      shift
      ;;
  esac
done

printf '%s\n' "$URL" >> "$CALL_LOG"
COUNT=$(wc -l < "$CALL_LOG")

write_css() {
  cp "$HEALTHY_CSS" "$OUTPUT"
}

case "$SCENARIO" in
  recover-all-stages)
    case "$COUNT" in
      1) exit 22 ;;
      2) printf '%s\n' '<html>no stylesheet yet</html>' ;;
      3) printf '%s\n' '<link href="/assets/styles-old.css">' ;;
      4) exit 22 ;;
      5) printf '%s\n' '<link href="/assets/styles-new.css">' ;;
      6) write_css ;;
      *) exit 99 ;;
    esac
    ;;
  homepage-failure)
    exit 22
    ;;
  missing-link)
    printf '%s\n' '<html>no stylesheet yet</html>'
    ;;
  stylesheet-failure)
    if [[ "$URL" == */ ]]; then
      printf '%s\n' '<link href="/assets/styles-stale.css">'
    else
      exit 22
    fi
    ;;
  *)
    exit 98
    ;;
esac
`;

type GateRun = {
  calls: string[];
  output: string;
  sleeps: string[];
  status: number | null;
  stderr: string;
  stdout: string;
};

function runGate(scenario: string, attempts = 11): GateRun {
  const dir = mkdtempSync(path.join(tmpdir(), "css-shape-gate-"));
  tempDirs.push(dir);
  const bin = path.join(dir, "bin");
  mkdirSync(bin);

  const curl = path.join(bin, "curl");
  const sleep = path.join(bin, "sleep");
  const callLog = path.join(dir, "calls.log");
  const sleepLog = path.join(dir, "sleeps.log");
  const healthyCss = path.join(dir, "healthy.css");
  const output = path.join(dir, "deployed.css");

  writeFileSync(curl, fakeCurl, { mode: 0o755 });
  writeFileSync(
    sleep,
    '#!/usr/bin/env bash\nprintf \'%s\\n\' "$1" >> "$SLEEP_LOG"\n',
    { mode: 0o755 },
  );
  writeFileSync(
    healthyCss,
    `@media screen{a{color:red}}\n@media print{a{color:black}}\n@media (width > 1px){a{display:block}}\n${"x".repeat(50_000)}`,
  );

  const result = spawnSync("bash", [gate], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CALL_LOG: callLog,
      CSS_FETCH_ATTEMPTS: String(attempts),
      CSS_FETCH_RETRY_DELAY_SECONDS: "6",
      CSS_OUTPUT_PATH: output,
      DEPLOY_URL: "https://deploy.example",
      HEALTHY_CSS: healthyCss,
      PATH: `${bin}:${process.env.PATH}`,
      SCENARIO: scenario,
      SLEEP_LOG: sleepLog,
    },
  });

  const readLines = (file: string) => {
    try {
      return readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  };

  return {
    calls: readLines(callLog),
    output,
    sleeps: readLines(sleepLog),
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

describe("CSS-shape smoke gate", () => {
  it("retries the complete HTML-to-CSS transaction and recovers to a new hash", () => {
    const result = runGate("recover-all-stages", 6);

    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toEqual([
      "https://deploy.example/",
      "https://deploy.example/",
      "https://deploy.example/",
      "https://deploy.example/assets/styles-old.css",
      "https://deploy.example/",
      "https://deploy.example/assets/styles-new.css",
    ]);
    expect(result.sleeps).toEqual(["6", "6", "6"]);
    expect(readFileSync(result.output, "utf8")).toContain("@media screen");
    expect(result.stdout).toContain("OK: deployed CSS is");
  });

  it.each([
    ["homepage-failure", "homepage fetch failed: https://deploy.example/"],
    ["missing-link", "no CSS link found in https://deploy.example/"],
    [
      "stylesheet-failure",
      "stylesheet fetch failed: https://deploy.example/assets/styles-stale.css; last stylesheet path: /assets/styles-stale.css",
    ],
  ])("exhausts a bounded budget with an actionable %s diagnostic", (scenario, diagnostic) => {
    const result = runGate(scenario, 3);

    expect(result.status).toBe(1);
    expect(result.sleeps).toEqual(["6", "6"]);
    expect(result.stdout).toContain("after 3 attempts");
    expect(result.stdout).toContain(diagnostic);
  });
});
