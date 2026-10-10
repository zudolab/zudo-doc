"use client";
import { getScope, signal } from "@takazudo/zfb/zudo-react";
declare global {
  interface Window {
    persistenceControl: { activations: number; cleanups: number; helperReady: boolean };
  }
}
export default function CounterOtherIsland({ label }: { label: string }) {
  const count = signal(0);
  getScope().onActivate(() => {
    window.persistenceControl.activations++;
    return () => { window.persistenceControl.cleanups++; };
  });
  return <div id="counter"><span id="label">{label}</span>
    <button id="increment" on:click={() => { count.value++; }}>Increment</button>
    <output id="count">{count}</output>
  </div>;
}
CounterOtherIsland.displayName = "CounterOtherIsland";
