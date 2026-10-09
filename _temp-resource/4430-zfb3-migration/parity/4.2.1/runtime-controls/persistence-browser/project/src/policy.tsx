"use client";
import { getScope } from "@takazudo/zfb/zudo-react";
import { ensureNestedIslandPropsRefresh } from "@takazudo/zudo-doc/transitions";
export default function PolicyBootstrap() {
  getScope().onActivate(() => {
    ensureNestedIslandPropsRefresh();
    window.persistenceControl.helperReady = true;
  });
  return null;
}
PolicyBootstrap.displayName = "PolicyBootstrap";
