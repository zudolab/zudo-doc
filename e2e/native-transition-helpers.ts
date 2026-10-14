/** Native snapshot proof shared by fixture, built-showcase and packed-consumer tests.
 * No screenshot baselines: compare two frames of the SAME active transition.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { spaClick, spaClickSelector } from "./nav-helpers";

export interface NativeTransitionRecord {
  to: string;
  native: boolean;
  ready: string;
  update: string;
  finished: string;
  animations: Array<{ name: string; pseudo: string | null; duration: number | string }>;
}
interface BrowserProof {
  records: NativeTransitionRecord[];
  animations: Animation[];
  errors: string[];
  hold: boolean;
  dispose: () => void;
}
declare global {
  interface Window { __zdNativeTransitionProof?: BrowserProof }
}

export async function installNativeTransitionProbe(page: Page, hold = true): Promise<void> {
  await page.evaluate((shouldHold) => {
    window.__zdNativeTransitionProof?.dispose();
    const proof: BrowserProof = {
      records: [], animations: [], errors: [], hold: shouldHold, dispose: () => {},
    };
    const error = (event: PromiseRejectionEvent) => proof.errors.push(String(event.reason));
    const beforeSwap = (event: Event) => {
      const navigation = event as Event & { viewTransition: ViewTransition; to: URL };
      const vt = navigation.viewTransition;
      const record: NativeTransitionRecord = {
        to: navigation.to.pathname,
        native: typeof ViewTransition !== "undefined" && vt instanceof ViewTransition,
        ready: "pending", update: "pending", finished: "pending", animations: [],
      };
      proof.records.push(record);
      // This event runs inside the update callback. Register and RETURN:
      // waiting for ready here would deadlock the callback that enables it.
      vt.updateCallbackDone.then(
        () => { record.update = "fulfilled"; },
        (reason: Error) => { record.update = reason.name; },
      );
      vt.finished.then(
        () => { record.finished = "fulfilled"; },
        (reason: Error) => { record.finished = reason.name; },
      );
      vt.ready.then(() => {
        record.ready = "fulfilled";
        proof.animations = document.getAnimations().filter((animation) =>
          (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
        record.animations = proof.animations.map((animation) => {
          const duration = animation.effect?.getComputedTiming().duration;
          return {
            name: animation instanceof CSSAnimation ? animation.animationName : "",
            pseudo: (animation.effect as KeyframeEffect | null)?.pseudoElement ?? null,
            duration: typeof duration === "number" ? duration : String(duration ?? "auto"),
          };
        });
        if (proof.hold) for (const animation of proof.animations) {
          animation.pause();
          animation.currentTime = 0;
        }
      }, (reason: Error) => { record.ready = reason.name; });
    };
    window.__zdNativeTransitionProof = proof;
    addEventListener("unhandledrejection", error);
    document.addEventListener("zfb:before-swap", beforeSwap);
    proof.dispose = () => {
      removeEventListener("unhandledrejection", error);
      document.removeEventListener("zfb:before-swap", beforeSwap);
    };
  }, hold);
}

export async function navigateNativeTransition(
  page: Page, target: string | { selector: string } | { history: "back" | "forward" },
): Promise<NativeTransitionRecord> {
  const previous = await page.evaluate(() => window.__zdNativeTransitionProof!.records.length);
  if (typeof target === "string") expect(await spaClick(page, target), `Missing link to ${target}`).toBe(true);
  else if ("selector" in target) expect(await spaClickSelector(page, target.selector), `Missing ${target.selector}`).toBe(true);
  else await page.evaluate((direction) => history[direction](), target.history);
  await page.waitForFunction((count) => {
    const records = window.__zdNativeTransitionProof!.records;
    const latest = records.at(-1);
    return records.length > count && latest?.ready !== "pending" && latest?.update !== "pending";
  }, previous);
  return readNativeTransitionRecord(page);
}

export async function readNativeTransitionRecord(page: Page): Promise<NativeTransitionRecord> {
  return page.evaluate(() => window.__zdNativeTransitionProof!.records.at(-1)!);
}

export async function finishNativeTransition(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const animation of window.__zdNativeTransitionProof!.animations) animation.finish();
  });
  await page.waitForFunction(() => window.__zdNativeTransitionProof!.records.at(-1)?.finished !== "pending");
  expect((await readNativeTransitionRecord(page)).finished).toBe("fulfilled");
  expect(await page.evaluate(() => window.__zdNativeTransitionProof!.errors)).toEqual([]);
}

interface CdpNode {
  nodeId: number;
  pseudoType?: string;
  pseudoIdentifier?: string;
  children?: CdpNode[];
  pseudoElements?: CdpNode[];
}
export interface NativeSnapshot {
  id: number;
  type: string;
  name: string | undefined;
  parent: string | undefined;
  style: Record<string, string>;
}

/** CDP enumerates actual pseudo nodes; computed styles on selectors alone
 * also return values for nonexistent snapshots and cannot prove extraction. */
export async function nativeSnapshots(page: Page): Promise<NativeSnapshot[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const nodes: NativeSnapshot[] = [];
    function visit(node: CdpNode, parent?: CdpNode) {
      if (node.pseudoType?.startsWith("view-transition")) nodes.push({
        id: node.nodeId, type: node.pseudoType, name: node.pseudoIdentifier,
        parent: parent?.pseudoType, style: {},
      });
      for (const child of [...(node.children ?? []), ...(node.pseudoElements ?? [])]) visit(child, node);
    }
    visit(root);
    for (const node of nodes) {
      const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId: node.id });
      node.style = Object.fromEntries(computedStyle
        .filter(({ name }) => ["animation-name", "opacity", "transform", "translate", "mix-blend-mode", "width", "height"].includes(name))
        .map(({ name, value }) => [name, value]));
    }
    return nodes;
  } finally { await cdp.detach(); }
}

export function stationarySnapshots(nodes: NativeSnapshot[], names: string[]): boolean {
  return names.every((name) => {
    const group = nodes.find((node) => node.name === name && node.type === "view-transition-group");
    const images = nodes.filter((node) => node.name === name && /view-transition-(old|new)$/.test(node.type));
    return group?.parent === "view-transition" && images.length > 0 &&
      [group, ...images].every((node) => node.style["animation-name"] === "none" && node.style.opacity === "1") &&
      images.every((node) => node.style.transform === "none" && node.style.translate === "none");
  });
}

export type SnapshotClip = { x: number; y: number; width: number; height: number };
export async function visibleSnapshotClip(page: Page, selector: string): Promise<SnapshotClip> {
  return page.locator(selector).first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.ceil(rect.left));
    const y = Math.max(0, Math.ceil(rect.top));
    const width = Math.floor(Math.min(innerWidth, rect.right)) - x;
    const height = Math.floor(Math.min(innerHeight, rect.bottom)) - y;
    if (width <= 0 || height <= 0) throw new Error("Snapshot region has no visible pixels");
    return { x, y, width, height };
  });
}

export interface ActiveProofOptions {
  label: string;
  regions: Array<{
    name: string;
    selector?: string;
    clip?: SnapshotClip;
    /** Paired by default; one-sided cases must explicitly name the actual side. */
    images?: Array<"old" | "new">;
  }>;
  expectedStationary?: boolean;
  contentSelector?: string;
}

export async function proveActiveNativeTransition(page: Page, testInfo: TestInfo, options: ActiveProofOptions) {
  const { label, regions, expectedStationary = true, contentSelector = "main" } = options;
  const record = await readNativeTransitionRecord(page);
  expect(record.native, "The real native ViewTransition path must be active").toBe(true);
  expect([record.ready, record.update, record.finished]).toEqual(["fulfilled", "fulfilled", "pending"]);
  expect(record.animations.some((animation) =>
    animation.pseudo === "::view-transition-new(root)" && animation.name === "contentFadeIn"),
  "A positively identified content animation is required; empty pseudo filters never pass").toBe(true);

  const clips = await Promise.all(regions.map(async (region) => ({
    name: region.name, clip: region.clip ?? await visibleSnapshotClip(page, region.selector!),
  })));
  clips.push({ name: "root-content", clip: await visibleSnapshotClip(page, contentSelector) });
  const frames: Array<{ nodes: NativeSnapshot[]; images: Map<string, Buffer> }> = [];
  for (const progress of [0.2, 0.7]) {
    await page.evaluate(async (fraction) => {
      const animations = window.__zdNativeTransitionProof!.animations;
      const content = animations.find((animation) =>
        (animation.effect as KeyframeEffect | null)?.pseudoElement === "::view-transition-new(root)");
      const duration = content?.effect?.getComputedTiming().duration;
      if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
        throw new Error("Expected a finite active native content-animation duration");
      }
      // One common timestamp preserves the real relationship between shorter
      // outgoing and longer incoming animations; do not seek them independently.
      for (const animation of animations) animation.currentTime = duration * fraction;
      // Commit the sought native compositor frame, without advancing its held timeline.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, progress);
    const nodes = await nativeSnapshots(page);
    expect(nodes.some((node) => node.name === "root" && node.type === "view-transition-new")).toBe(true);
    for (const region of regions) {
      const images = nodes.filter((node) => node.name === region.name && /view-transition-(old|new)$/.test(node.type));
      expect(images.map((node) => node.type).sort(), `${region.name} must have the expected actual snapshots`)
        .toEqual((region.images ?? ["old", "new"]).map((side) => `view-transition-${side}`).sort());
    }
    const images = new Map<string, Buffer>();
    for (const { name, clip } of clips) {
      const file = `${label}-${name}-${progress}.png`;
      const path = testInfo.outputPath(file);
      images.set(name, await page.screenshot({ path, clip, animations: "allow" }));
      await testInfo.attach(file, { path, contentType: "image/png" });
    }
    frames.push({ nodes, images });
  }
  const first = frames[0]!;
  const second = frames[1]!;
  const names = regions.map(({ name }) => name);
  const pixelsStationary = names.every((name) => first.images.get(name)!.equals(second.images.get(name)!));
  const policyStationary = frames.every(({ nodes }) => stationarySnapshots(nodes, names));
  const geometryStationary = names.every((name) => {
    const group = (nodes: NativeSnapshot[]) => nodes.find((node) => node.name === name && node.type === "view-transition-group");
    const a = group(first.nodes);
    const b = group(second.nodes);
    return !!a && !!b && ["transform", "translate", "width", "height"].every((property) => a.style[property] === b.style[property]);
  });
  await testInfo.attach(`${label}-native.json`, {
    body: JSON.stringify({ browser: page.context().browser()?.version(), record,
      frames: frames.map(({ nodes }) => nodes), pixelsStationary, policyStationary, geometryStationary }, null, 2),
    contentType: "application/json",
  });
  expect(first.images.get("root-content")!.equals(second.images.get("root-content")!), "Changing article/TOC pixels must animate").toBe(false);
  expect(policyStationary, "Native group and old/new snapshot protection").toBe(expectedStationary);
  expect(pixelsStationary, "Same active pixel oracle for protected code and negative mutation").toBe(expectedStationary);
  if (expectedStationary) expect(geometryStationary, "Named groups must not move through an animated ancestor").toBe(true);
  expect((await readNativeTransitionRecord(page)).finished, "Screenshots must precede transition completion").toBe("pending");
  return second.nodes;
}

/** Remove real protection rules, exposing lower-priority test motion. The same
 * oracle must reject the mutation, even when an old image would be obscured. */
export async function removeHeaderStationaryProtection(page: Page, layer: "old" | "new" | "group"): Promise<void> {
  const removed = await page.evaluate((targetLayer) => {
    const selector = `::view-transition-${targetLayer}(zfb-header)`;
    const style = document.createElement("style");
    style.setAttribute("data-zfb-transition-persist", "native-negative-control");
    style.textContent = `@keyframes native-proof-motion { from { transform: translateX(0px); z-index: 2; } to { transform: translateX(80px); z-index: 2; } } ${selector} { animation: native-proof-motion 1s linear both; }`;
    document.head.prepend(style);
    document.addEventListener("zfb:before-swap", (event) => {
      (event as Event & { newDocument: Document }).newDocument.head.append(style.cloneNode(true));
    });
    let count = 0;
    const remove = (rules: CSSRuleList) => {
      for (const rule of [...rules]) {
        if (rule instanceof CSSStyleRule && rule.style.animationName === "none") {
          const selectors = rule.selectorText.split(",").map((value) => value.trim());
          const matching = selectors.filter((value) => value.includes(selector));
          if (!matching.length) continue;
          count += matching.length;
          const kept = selectors.filter((value) => !value.includes(selector));
          rule.selectorText = kept.length ? kept.join(",") : ":root[data-native-proof-never]";
        } else if ("cssRules" in rule) remove((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of [...document.styleSheets]) remove(sheet.cssRules);
    return count;
  }, layer);
  expect(removed, `Negative control must remove an existing ${layer} protection`).toBeGreaterThan(0);
}
