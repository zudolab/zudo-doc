import path from "path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { installDependencies } from "./utils.js";

async function main() {
  console.log();
  p.intro(pc.bgCyan(pc.black(" create-zudo-doc ")));

  const choices = await runPrompts();
  const targetDir = path.resolve(process.cwd(), choices.projectName);

  const s = p.spinner();
  s.start("Scaffolding project...");

  try {
    await scaffold(choices);
    s.stop("Project scaffolded!");
  } catch (err) {
    s.stop("Scaffolding failed!");
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Install dependencies
  const shouldInstall = await p.confirm({
    message: "Install dependencies?",
    initialValue: true,
  });

  if (p.isCancel(shouldInstall)) {
    p.outro(
      `Done! cd ${choices.projectName} and install dependencies manually.`,
    );
    return;
  }

  if (shouldInstall) {
    const s2 = p.spinner();
    s2.start(`Installing dependencies with ${choices.packageManager}...`);
    try {
      installDependencies(targetDir, choices.packageManager);
      s2.stop("Dependencies installed!");
    } catch {
      s2.stop("Installation failed. Run install manually.");
    }
  }

  p.outro(
    `${pc.green("Done!")} Your project is ready at ${pc.cyan(choices.projectName)}`,
  );

  console.log();
  console.log(`  ${pc.bold("Next steps:")}`);
  console.log(`  cd ${choices.projectName}`);
  const runCmd =
    choices.packageManager === "npm" ? "npm run" : choices.packageManager;
  console.log(`  ${runCmd} dev`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
