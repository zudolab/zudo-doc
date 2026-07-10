"use client";

// NOT auto-mounted (epic zudolab/zudo-doc#2651 minimal-scaffold cutover):
// the old host `pages/lib/_body-end-islands.tsx` that used to statically
// import + mount this island no longer exists — the package now owns the
// entire chrome (see `pages/docs/[[...slug]].tsx`, `createChrome(routeCtx)`).
// To wire Cmd/Ctrl+F back in, add a `settings.chromeBindingsModule` host
// file that overrides the `BodyEndIslands` chrome slot (wrapping
// `@takazudo/zudo-doc/doc-body-end-islands`'s `createBodyEndIslands` and
// mounting `<FindInPageInit />` alongside it) — see
// `docs/adr/route-injection-seam.md` ("Host-callables channel") in
// @takazudo/zudo-doc. This file (and find-bar.tsx / ../utils/find-in-page.ts)
// ship as ready-to-wire reference material either way.
import { useState, useEffect, useRef } from "preact/compat";
import { FindBar } from "./find-bar";
import { createFindInPage } from "@/utils/find-in-page";

const CONTENT_SELECTOR = "article.zd-content";

export default function FindInPageInit() {
  const [isTauri, setIsTauri] = useState(false);
  const [visible, setVisible] = useState(false);
  const findInPageRef = useRef(createFindInPage());

  // Detect Tauri environment
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      setIsTauri(true);
    }
  }, []);

  // Intercept Cmd/Ctrl+F only in Tauri
  useEffect(() => {
    if (!isTauri) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isTauri]);

  // Clear search on zfb page navigation. zfb navigates via SPA body swap and
  // fires "zfb:before-preparation" on document before nav — it never fires the
  // native "pagehide" (full-unload) event. The literal is inlined because
  // downstream scaffolds do not depend on @takazudo/zudo-doc as a runtime dep
  // (same reason as the designTokenPanel bootstrap).
  useEffect(() => {
    const handler = () => {
      findInPageRef.current.stop();
      setVisible(false);
    };
    document.addEventListener("zfb:before-preparation", handler);
    return () => document.removeEventListener("zfb:before-preparation", handler);
  }, []);

  if (!isTauri) return null;

  return (
    <FindBar
      visible={visible}
      onClose={() => setVisible(false)}
      findInPage={findInPageRef.current}
      containerSelector={CONTENT_SELECTOR}
    />
  );
}
