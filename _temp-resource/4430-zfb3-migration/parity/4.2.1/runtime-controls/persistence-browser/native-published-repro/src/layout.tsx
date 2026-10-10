import { Island } from "@takazudo/zfb";
import { ClientRouter } from "@takazudo/zfb-runtime";
import Counter from "./counter";
export default function Layout({ route, label, persist = true, target }: { route: string; label: string; persist?: boolean; target: string }) {
  return <html lang="en"><head><meta charset="utf-8"/><title>{route}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><ClientRouter/></head><body>
    <main><h1 id="route">{route}</h1><nav><a href={`/${target}/`}>{target}</a></nav></main>
    <header id="persisted" data-zfb-transition-persist={persist ? "pending-header" : undefined}>
      <div style={{ height: "2000px" }}>Counter is below the viewport</div>
      <Island when="visible" ssrFallback={<div id="reservation">Await visibility</div>}><Counter label={label}/></Island>
    </header>
  </body></html>;
}
