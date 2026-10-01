"use client";
/** @jsxRuntime automatic */
import { useEffect, useState } from "preact/hooks";

/** Fixture-owned observable media-scheduled island for the hydration-health gate. */
export function MediaProbe(): preact.JSX.Element {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <span data-media-probe={ready ? "ready" : "pending"}>Media probe</span>;
}
