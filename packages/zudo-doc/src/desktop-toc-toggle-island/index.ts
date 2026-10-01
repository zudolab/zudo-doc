// Keep storage helpers available to existing package consumers from this
// ordinary facade. The zudo-react island entry exports only its component.
export { DesktopTocToggle } from "./island.js";
export { TOC_STORAGE_KEY, readTocState, setTocDataAttribute } from "./storage.js";
