import { Island } from "@takazudo/zfb";
import { ClientRouter } from "@takazudo/zfb-runtime";
import CounterIsland from "./counter";
import PolicyBootstrap from "./policy";
export default function Layout({ route, label, preserve = false, structural = false }: {
  route: string; label: string; preserve?: boolean; structural?: boolean;
}) {
  return <html lang="en"><head><meta charset="utf-8"/><title>Persistence {route}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><ClientRouter/></head>
    <body>
      <header id="persisted" data-zfb-transition-persist="counter-header"
        data-zd-props-preserve={preserve ? "" : undefined}>
        {structural ? <p id="added-structure">Authored structural change</p> : null}
        <Island when="load"><CounterIsland label={label}/></Island>
      </header>
      <main><h1 id="route">{route}</h1><nav>
        <a href="/same-a/">same-a</a> <a href="/same-b/">same-b</a>
        <a href="/changed/">changed</a> <a href="/preserve-a/">preserve-a</a>
        <a href="/preserve-b/">preserve-b</a> <a href="/structural/">structural</a>
      </nav></main>
      <Island when="load"><PolicyBootstrap/></Island>
    </body></html>;
}
