"use client";
/** @jsxRuntime automatic */
import { getScope, signal } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

/** Fixture-owned observable media-scheduled island for the hydration-health gate. */
export function MediaProbe(): JSX.Element {
  const ready = signal("pending");
  const scope = getScope();
  scope.onActivate(() => {
    ready.value = "ready";
  });
  return <span data-media-probe={ready}>Media probe</span>;
}
