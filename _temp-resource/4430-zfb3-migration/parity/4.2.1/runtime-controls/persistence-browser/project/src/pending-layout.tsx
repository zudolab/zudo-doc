import { Island } from "@takazudo/zfb";
import { ClientRouter } from "@takazudo/zfb-runtime";
import CounterIsland from "./counter";
import PolicyBootstrap from "./policy";
export default function PendingLayout({ route, label, persisted = true, policy = true, target = "pending-b" }: { route: string; label: string; persisted?: boolean; policy?: boolean; target?: string }) {
  return <html lang="en"><head><meta charset="utf-8"/><title>{route}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml"/><ClientRouter/></head><body>
    <main><h1 id="route">{route}</h1><nav><a href={`/${target}/`}>{target}</a> <a href="/same-a/">same-a</a></nav></main>
    <header id="persisted" data-zfb-transition-persist={persisted ? "counter-header" : undefined}>
      <div id="spacer" style={{ height: "2000px" }}>Below-viewport counter follows</div>
      <Island when="visible" ssrFallback={<div id="reservation">Await visibility</div>}><CounterIsland label={label}/></Island>
    </header>
    {policy ? <Island when="load"><PolicyBootstrap/></Island> : null}
  </body></html>;
}
