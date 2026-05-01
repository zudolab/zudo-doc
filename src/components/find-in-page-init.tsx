import { useState, useEffect, useRef } from "react";
import { FindBar } from "./find-bar";
import { createFindInPage } from "@/utils/find-in-page";
// After zudolab/zudo-doc#1335 (E2 task 2 half B) the host components
// pull lifecycle event names from the v2 transitions module rather
// than hard-coding `astro:*` literals.
import { BEFORE_NAVIGATE_EVENT } from "@zudo-doc/zudo-doc-v2/transitions";

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

  // Clear search on page navigation
  useEffect(() => {
    const handler = () => {
      findInPageRef.current.stop();
      setVisible(false);
    };
    document.addEventListener(BEFORE_NAVIGATE_EVENT, handler);
    return () => document.removeEventListener(BEFORE_NAVIGATE_EVENT, handler);
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
