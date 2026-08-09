import { render } from "preact";

// Placeholder mount — the shell/router seams land in a later sub-issue
// (#3330). This proves the Vite + Preact + preact/compat toolchain boots.
function App() {
  return <div>zudo-doc online</div>;
}

const root = document.getElementById("root");
if (root) {
  render(<App />, root);
}
