"use client";
import { getScope, signal } from "@takazudo/zfb/zudo-react";
declare global { interface Window { nativePending: { activations: number; cleanups: number }; } }
export default function Counter({ label }: { label: string }) {
  const count = signal(0);
  getScope().onActivate(() => { window.nativePending.activations++; return () => { window.nativePending.cleanups++; }; });
  return <div id="counter"><span id="label">{label}</span><button id="increment" on:click={() => { count.value++; }}>Increment</button><output id="count">{count}</output></div>;
}
Counter.displayName = "Counter";
