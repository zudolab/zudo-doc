import { h } from "@takazudo/zfb/zudo-react";
import type { Child } from "@takazudo/zfb/zudo-react";
import type { IntroNode, PreparedHomeIntro } from "../../home-intro/types.js";

const HOME_SECTION_HEADING_CLASS = "zd-home-heading text-title font-bold leading-tight";

/** A small zudo-react test seam for serialized intro nodes owned by #4457. */
export function renderPreparedIntro(intro: PreparedHomeIntro | null | undefined): Child[] {
  const renderNode = (node: IntroNode): Child => {
    if (typeof node === "string") return node;
    const props = Object.fromEntries(
      Object.entries(node.attrs).map(([name, value]) => [name === "className" ? "class" : name, value]),
    );
    if (node.tag === "h2") {
      const authoredClass = typeof props.class === "string" ? props.class : "";
      props.class = [HOME_SECTION_HEADING_CLASS, authoredClass].filter(Boolean).join(" ");
    }
    return h(node.tag, props, ...node.children.map(renderNode));
  };

  return intro?.nodes.map(renderNode) ?? [];
}
