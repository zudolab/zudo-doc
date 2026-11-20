import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeWatchState } from "../run.js";
import { createSerialScheduler, startDocSourcesWatcher, type DocSourcesWatcher } from "../watch.js";
import { exists, listTree, makeProject, read, run, write } from "./helpers.js";

const silent = { info() {}, warn() {}, error() {} };
const open: DocSourcesWatcher[] = [];
afterEach(async () => {
  for (const watcher of open.splice(0)) await watcher.close();
});

async function until(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("createSerialScheduler", () => {
  it("debounces, serializes and queues exactly one follow-up run", async () => {
    let active = 0;
    let maxActive = 0;
    let runs = 0;
    let release: () => void = () => {};
    const scheduler = createSerialScheduler(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      runs++;
      if (runs === 1) await new Promise<void>((resolve) => (release = resolve));
      active--;
    }, 10);
    scheduler.trigger();
    scheduler.trigger();
    await until(() => runs === 1);
    scheduler.trigger();
    scheduler.trigger();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(runs).toBe(1);
    release();
    await scheduler.idle();
    expect(runs).toBe(2);
    expect(maxActive).toBe(1);
    await scheduler.close();
    scheduler.trigger();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(runs).toBe(2);
  });
});

describe("startDocSourcesWatcher", () => {
  const plugin = {
    docsDir: "src/content/docs",
    sources: [
      {
        id: "kb",
        title: "KB",
        mappings: [
          { id: "m", root: "kb", include: ["**/*.md"], format: "markdown", missing: "skip", assets: { include: ["**/*.png"] } },
        ],
      },
    ],
  };

  function setup() {
    const project = makeProject();
    write(path.join(project.root, "kb", "a.md"), "# A\n");
    run(project, plugin);
    writeWatchState({ plugin, projectRoot: project.root, publicDir: "public", outDir: "dist" }, true);
    const watcher = startDocSourcesWatcher({
      projectRoot: project.root,
      homeDir: () => project.home,
      logger: silent,
      debounceMs: 30,
      statePollMs: 50,
    });
    open.push(watcher);
    return { project, watcher, docs: path.join(project.root, "src/content/docs/kb") };
  }

  it("regenerates on edit, add, new directory, rename and delete without looping on its own writes", async () => {
    const { project, watcher, docs } = setup();
    expect(watcher.runs()).toBe(0);

    write(path.join(project.root, "kb", "a.md"), "# A edited\n");
    await until(() => read(path.join(docs, "a.mdx")).includes("A edited"));
    await watcher.idle();

    fs.mkdirSync(path.join(project.root, "kb", "fresh"));
    await until(() => watcher.watchedDirs().includes(path.join(project.root, "kb", "fresh")));
    write(path.join(project.root, "kb", "fresh", "b.md"), "# B\n");
    await until(() => exists(path.join(docs, "fresh", "b.mdx")));

    write(path.join(project.root, "kb", "fresh", "pic.png"), Buffer.from([1]));
    await until(() => exists(path.join(project.root, "public/doc-sources/kb/fresh/pic.png")));

    fs.renameSync(path.join(project.root, "kb", "fresh", "b.md"), path.join(project.root, "kb", "fresh", "c.md"));
    await until(() => exists(path.join(docs, "fresh", "c.mdx")) && !exists(path.join(docs, "fresh", "b.mdx")));

    fs.rmSync(path.join(project.root, "kb", "a.md"));
    await until(() => !exists(path.join(docs, "a.mdx")));
    await watcher.idle();

    const settled = watcher.runs();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(watcher.runs()).toBe(settled);
  });

  it("follows a root disappearing and reappearing", async () => {
    const { project, watcher, docs } = setup();
    fs.renameSync(path.join(project.root, "kb"), path.join(project.root, "kb-away"));
    await until(() => !exists(docs));
    fs.renameSync(path.join(project.root, "kb-away"), path.join(project.root, "kb"));
    await until(() => exists(path.join(docs, "a.mdx")));
    await watcher.idle();
    expect(listTree(docs)).toEqual(["a.mdx", "index.mdx"]);
  });

  it("keeps the previous output when a run fails", async () => {
    const { project, watcher, docs } = setup();
    const before = listTree(docs);
    write(path.join(project.root, "kb", "A.md"), "# Collides\n");
    await new Promise((resolve) => setTimeout(resolve, 200));
    await watcher.idle();
    expect(listTree(docs)).toEqual(before);
    fs.rmSync(path.join(project.root, "kb", "A.md"));
    write(path.join(project.root, "kb", "b.md"), "# B\n");
    await until(() => exists(path.join(docs, "b.mdx")));
  });

  it("idles when no sources are recorded and closes cleanly", async () => {
    const project = makeProject();
    const watcher = startDocSourcesWatcher({ projectRoot: project.root, homeDir: () => project.home, logger: silent });
    expect(watcher.watchedDirs()).toEqual([]);
    await watcher.close();
  });
});
