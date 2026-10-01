/** @jsxRuntime automatic */

import type { Child, Component } from "@takazudo/zfb/zudo-react";

import type { SidebarTreeIslandProps } from "./types.js";

/**
 * Props for the server-rendered Sidebar shell. Data preparation stays with the
 * caller, which may supply a tree component or already-rendered children.
 */
export interface SidebarProps extends SidebarTreeIslandProps {
  /** Component used to render the prepared tree. */
  treeComponent?: Component<SidebarTreeIslandProps>;
  /** Pre-rendered tree content for callers that compose the tree separately. */
  children?: Child;
}

/**
 * Server-rendered shell around prepared navigation content. An empty node list
 * has no sidebar output and returns null without creating an island boundary.
 */
export function Sidebar(props: SidebarProps): Child {
  const {
    treeComponent: TreeComponent,
    children,
    nodes,
    currentSlug,
    rootMenuItems,
    backToMenuLabel,
    localeLinks,
    themeDefaultMode,
  } = props;

  if (nodes.length === 0) return null;

  if (TreeComponent) {
    return (
      <TreeComponent
        nodes={nodes}
        currentSlug={currentSlug}
        rootMenuItems={rootMenuItems}
        backToMenuLabel={backToMenuLabel}
        localeLinks={localeLinks}
        themeDefaultMode={themeDefaultMode}
      />
    );
  }

  if (children !== undefined && children !== null) {
    return <>{children}</>;
  }

  return null;
}
