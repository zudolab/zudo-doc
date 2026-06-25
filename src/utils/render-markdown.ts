// Thin re-export shim. The markdown-to-HTML renderer moved into the package
// (`@takazudo/zudo-doc/render-markdown`) as part of the package-first migration
// (#2344, S1a). Host code keeps importing from `@/utils/render-markdown`; the
// implementation lives once in the package.
export { renderMarkdown } from "@takazudo/zudo-doc/render-markdown";
