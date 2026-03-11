import { useState, useRef, useEffect } from "react";
import {
  IconChevronRight,
  IconFolder,
  IconFile,
  IconSearch,
} from "../components/icons";

/* ── Shared data structures ── */

interface DocNode {
  label: string;
  slug: string;
  children?: DocNode[];
  description?: string;
  isNew?: boolean;
}

const sampleTree: DocNode[] = [
  {
    label: "Getting Started",
    slug: "getting-started",
    children: [
      { label: "Introduction", slug: "getting-started/introduction" },
      { label: "Installation", slug: "getting-started/installation" },
      { label: "Quick Start", slug: "getting-started/quick-start" },
    ],
  },
  {
    label: "Guides",
    slug: "guides",
    children: [
      { label: "Writing Docs", slug: "guides/writing-docs" },
      { label: "Configuration", slug: "guides/configuration", isNew: true },
      {
        label: "Themes",
        slug: "guides/themes",
        children: [
          { label: "Color Schemes", slug: "guides/themes/color-schemes" },
          { label: "Custom Theme", slug: "guides/themes/custom-theme" },
        ],
      },
    ],
  },
  {
    label: "API Reference",
    slug: "api",
    description: "Component and utility docs",
    children: [
      { label: "Components", slug: "api/components" },
      { label: "Utilities", slug: "api/utilities" },
      { label: "Hooks", slug: "api/hooks" },
    ],
  },
  {
    label: "Changelog",
    slug: "changelog",
    children: [
      { label: "v2.0", slug: "changelog/v2" },
      { label: "v1.0", slug: "changelog/v1" },
    ],
  },
];

const ACTIVE_SLUG = "getting-started/installation";

/* ── Helper: count all leaves in a tree ── */
function countLeaves(nodes: DocNode[]): number {
  return nodes.reduce((sum, n) => sum + (n.children ? countLeaves(n.children) : 1), 0);
}

/* ── Helper: filter tree by query ── */
function filterTree(nodes: DocNode[], query: string): DocNode[] {
  const q = query.toLowerCase();
  return nodes
    .map((n) => {
      if (n.children) {
        const filteredChildren = filterTree(n.children, query);
        if (filteredChildren.length > 0) return { ...n, children: filteredChildren };
        if (n.label.toLowerCase().includes(q)) return { ...n, children: [] };
        return null;
      }
      return n.label.toLowerCase().includes(q) ? n : null;
    })
    .filter(Boolean) as DocNode[];
}

/* ── Helper: find breadcrumb path to active slug ── */
function findPath(nodes: DocNode[], slug: string, path: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.slug === slug) return [...path, n.label];
    if (n.children) {
      const found = findPath(n.children, slug, [...path, n.label]);
      if (found) return found;
    }
  }
  return null;
}

/* ── Shared wrapper for each demo ── */
function PatternBox({
  title,
  num,
  children,
  height = 360,
}: {
  title: string;
  num: number;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="border border-muted rounded-lg overflow-hidden">
      <div className="bg-surface px-hsp-md py-vsp-2xs border-b border-muted">
        <span className="text-caption text-muted font-medium">#{num}</span>
        <span className="text-small font-semibold ml-hsp-sm">{title}</span>
      </div>
      <div className="overflow-auto" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
 * Pattern 1: Minimal Lines
 * ══════════════════════════════════════════ */
function P1() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="w-full text-left py-[2px] text-small hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
              >
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[2px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 16 + 12}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Minimal Lines" num={1}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 2: Border-Left Indent
 * ══════════════════════════════════════════ */
function P2() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];
      const opacity = Math.max(0.15, 1 - depth * 0.25);

      return (
        <div
          key={node.slug}
          className={depth > 0 ? "border-l border-muted ml-hsp-lg" : ""}
          style={depth > 0 ? { borderColor: `color-mix(in srgb, var(--zd-muted) ${opacity * 100}%, transparent)` } : undefined}
        >
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="w-full text-left px-hsp-md py-[3px] text-small font-semibold hover:text-accent"
              >
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block px-hsp-md py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Border-Left Indent" num={2}>
      <nav className="py-vsp-xs px-hsp-sm">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 3: Background Indent
 * ══════════════════════════════════════════ */
function P3() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];
      const bgOpacity = depth * 4;

      return (
        <div
          key={node.slug}
          style={depth > 0 ? { backgroundColor: `color-mix(in srgb, var(--zd-fg) ${bgOpacity}%, transparent)` } : undefined}
        >
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="w-full text-left px-hsp-lg py-[4px] text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 12 + 16}px` }}
              >
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[4px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 12 + 16}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Background Indent" num={3}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 4: Tree Connector Lines
 * ══════════════════════════════════════════ */
function P4() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node, index) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];
      const isLast = index === nodes.length - 1;

      return (
        <div key={node.slug} className="relative">
          {depth > 0 && (
            <>
              {/* vertical line */}
              <div
                className="absolute border-l border-muted"
                style={{
                  left: `${depth * 16 + 4}px`,
                  top: 0,
                  bottom: isLast ? "50%" : 0,
                }}
              />
              {/* horizontal connector */}
              <div
                className="absolute border-t border-muted"
                style={{
                  left: `${depth * 16 + 4}px`,
                  width: "10px",
                  top: "50%",
                }}
              />
            </>
          )}
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="relative w-full text-left py-[3px] text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + (depth > 0 ? 20 : 8)}px` }}
              >
                {node.label}
              </button>
              {isOpen && node.children && (
                <div className="relative">{renderNodes(node.children, depth + 1)}</div>
              )}
            </>
          ) : (
            <a
              className={`relative block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 16 + (depth > 0 ? 20 : 8)}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Tree Connector Lines" num={4}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 5: Dotted Tree Lines
 * ══════════════════════════════════════════ */
function P5() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node, index) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];
      const isLast = index === nodes.length - 1;

      return (
        <div key={node.slug} className="relative">
          {depth > 0 && (
            <>
              <div
                className="absolute border-l border-dashed border-muted"
                style={{
                  left: `${depth * 16 + 4}px`,
                  top: 0,
                  bottom: isLast ? "50%" : 0,
                }}
              />
              <div
                className="absolute border-t border-dashed border-muted"
                style={{
                  left: `${depth * 16 + 4}px`,
                  width: "10px",
                  top: "50%",
                }}
              />
            </>
          )}
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="relative w-full text-left py-[3px] text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + (depth > 0 ? 20 : 8)}px` }}
              >
                {node.label}
              </button>
              {isOpen && node.children && (
                <div className="relative">{renderNodes(node.children, depth + 1)}</div>
              )}
            </>
          ) : (
            <a
              className={`relative block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 16 + (depth > 0 ? 20 : 8)}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Dotted Tree Lines" num={5}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 6: Bold Categories
 * ══════════════════════════════════════════ */
function P6() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="w-full text-left py-vsp-2xs text-small font-bold hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
              >
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small font-normal ${isActive ? "text-accent" : "text-muted hover:text-fg"}`}
              style={{ paddingLeft: `${depth * 16 + 12}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Bold Categories" num={6}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 7: Icon Categories (Folder/File)
 * ══════════════════════════════════════════ */
function P7() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-medium hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                <IconFolder /> {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`flex items-center gap-hsp-xs py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <IconFile /> {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Icon Categories" num={7}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 8: Chevron Toggle
 * ══════════════════════════════════════════ */
function P8() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": false,
    api: false,
    changelog: false,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-vsp-2xs text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small ${isActive ? "text-accent font-medium bg-surface" : "text-fg hover:bg-surface"}`}
              style={{ paddingLeft: `${depth * 16 + 28}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Chevron Toggle" num={8}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 9: Plus/Minus Toggle
 * ══════════════════════════════════════════ */
function P9() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": false,
    api: false,
    changelog: false,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-medium hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                <span className="w-4 h-4 flex items-center justify-center border border-muted rounded text-caption">
                  {isOpen ? "−" : "+"}
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 16 + 32}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Plus/Minus Toggle" num={9}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 10: Arrow Toggle (Unicode)
 * ══════════════════════════════════════════ */
function P10() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": false,
    api: false,
    changelog: false,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-2xs w-full text-left py-[3px] text-small font-medium hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                <span className="text-muted w-4 text-center text-caption">
                  {isOpen ? "▼" : "▶"}
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 16 + 28}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Arrow Toggle" num={10}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 11: Active — Bold Text
 * ══════════════════════════════════════════ */
function P11() {
  const allExpanded: Record<string, boolean> = {
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  };

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <div
                className="py-[3px] text-small text-muted uppercase tracking-wide text-caption font-semibold"
                style={{ paddingLeft: `${depth * 14 + 12}px` }}
              >
                {node.label}
              </div>
              {allExpanded[node.slug] && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-fg font-bold" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Active: Bold Text" num={11}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 12: Active — Background Highlight
 * ══════════════════════════════════════════ */
function P12() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-vsp-2xs text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small ${isActive ? "bg-accent text-bg font-medium" : "text-fg hover:bg-surface"}`}
              style={{ paddingLeft: `${depth * 14 + 30}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Active: BG Highlight" num={12}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 13: Active — Left Accent Bar
 * ══════════════════════════════════════════ */
function P13() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-vsp-2xs text-small font-semibold hover:text-accent border-l-[3px] border-l-transparent"
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small border-l-[3px] ${isActive ? "border-l-accent text-accent bg-surface font-medium" : "border-l-transparent text-fg hover:border-l-muted hover:bg-surface"}`}
              style={{ paddingLeft: `${depth * 14 + 28}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Active: Left Accent Bar" num={13}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 14: Active — Pill / Rounded
 * ══════════════════════════════════════════ */
function P14() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-vsp-2xs text-small font-semibold hover:text-accent px-hsp-md"
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <div className="px-hsp-sm" style={{ paddingLeft: `${depth * 14 + 8}px` }}>
              <a
                className={`block py-vsp-2xs px-hsp-md text-small rounded-full ${isActive ? "bg-accent text-bg font-medium" : "text-fg hover:bg-surface"}`}
              >
                {node.label}
              </a>
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Active: Pill / Rounded" num={14}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 15: Active — Underline
 * ══════════════════════════════════════════ */
function P15() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-vsp-2xs text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small ${isActive ? "text-accent underline underline-offset-4 decoration-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 30}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Active: Underline" num={15}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 16: Compact Spacing
 * ══════════════════════════════════════════ */
function P16() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-2xs w-full text-left py-[1px] text-caption font-semibold hover:text-accent leading-snug"
                style={{ paddingLeft: `${depth * 10 + 6}px` }}
              >
                <span className="text-muted" style={{ fontSize: "8px" }}>
                  {isOpen ? "▼" : "▶"}
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[1px] text-caption leading-snug ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 10 + 18}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Compact Spacing" num={16}>
      <nav className="py-vsp-2xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 17: Relaxed Spacing
 * ══════════════════════════════════════════ */
function P17() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-sm w-full text-left py-vsp-xs text-body font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 20 + 16}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-xs text-body ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 20 + 40}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Relaxed Spacing" num={17}>
      <nav className="py-vsp-sm">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 18: Monospace (File-Path Feel)
 * ══════════════════════════════════════════ */
function P18() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];
      const prefix = isCategory ? (isOpen ? "[-]" : "[+]") : " ·";

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="w-full text-left py-[2px] text-caption font-mono hover:text-accent"
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
              >
                <span className="text-muted">{prefix} </span>
                {node.label}/
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[2px] text-caption font-mono ${isActive ? "text-accent" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              <span className="text-muted">{prefix} </span>
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Monospace" num={18}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 19: Uppercase Categories
 * ══════════════════════════════════════════ */
function P19() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className={`w-full text-left py-vsp-2xs font-semibold tracking-wider hover:text-accent ${depth === 0 ? "text-caption uppercase text-muted" : "text-caption text-fg"}`}
                style={{ paddingLeft: `${depth * 14 + 12}px`, marginTop: depth === 0 ? "8px" : "0" }}
              >
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Uppercase Categories" num={19}>
      <nav className="py-vsp-2xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 20: Category with Count
 * ══════════════════════════════════════════ */
function P20() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-vsp-2xs text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
                <span className="text-caption text-muted bg-surface px-hsp-xs rounded-full ml-auto mr-hsp-md">
                  {countLeaves(node.children!)}
                </span>
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 30}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Category with Count" num={20}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 21: Category with Description
 * ══════════════════════════════════════════ */
function P21() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  const descriptions: Record<string, string> = {
    "getting-started": "Begin your journey",
    guides: "In-depth tutorials",
    "guides/themes": "Visual customization",
    api: "Component and utility docs",
    changelog: "Release history",
  };

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="w-full text-left py-vsp-2xs hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <div className="flex items-center gap-hsp-xs">
                  <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                    <IconChevronRight />
                  </span>
                  <span className="text-small font-semibold">{node.label}</span>
                </div>
                {descriptions[node.slug] && (
                  <div
                    className="text-caption text-muted mt-[1px]"
                    style={{ paddingLeft: "20px" }}
                  >
                    {descriptions[node.slug]}
                  </div>
                )}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 30}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Category with Description" num={21}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 22: Bordered Sections
 * ══════════════════════════════════════════ */
function P22() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderChildren(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-medium hover:text-accent"
                style={{ paddingLeft: `${depth * 14}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderChildren(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 20}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Bordered Sections" num={22}>
      <nav className="py-vsp-2xs">
        {sampleTree.map((top) => (
          <div key={top.slug} className="border-b border-muted px-hsp-md py-vsp-xs">
            <button
              onClick={() => setExpanded((p) => ({ ...p, [top.slug]: !p[top.slug] }))}
              className="flex items-center gap-hsp-xs w-full text-left text-small font-bold hover:text-accent"
            >
              <span className={`transition-transform duration-200 ${expanded[top.slug] ? "rotate-90" : ""}`}>
                <IconChevronRight />
              </span>
              {top.label}
            </button>
            {expanded[top.slug] && top.children && (
              <div className="mt-vsp-2xs">{renderChildren(top.children, 1)}</div>
            )}
          </div>
        ))}
      </nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 23: Card Sections
 * ══════════════════════════════════════════ */
function P23() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: false,
    "guides/themes": true,
    api: false,
    changelog: false,
  });

  function renderChildren(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-medium hover:text-accent"
                style={{ paddingLeft: `${(depth - 1) * 14}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderChildren(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${(depth - 1) * 14 + 20}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Card Sections" num={23}>
      <div className="p-hsp-sm flex flex-col gap-vsp-xs">
        {sampleTree.map((top) => (
          <div key={top.slug} className="border border-muted rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded((p) => ({ ...p, [top.slug]: !p[top.slug] }))}
              className="flex items-center gap-hsp-xs w-full text-left px-hsp-md py-vsp-2xs text-small font-bold bg-surface hover:text-accent"
            >
              <span className={`transition-transform duration-200 ${expanded[top.slug] ? "rotate-90" : ""}`}>
                <IconChevronRight />
              </span>
              {top.label}
            </button>
            {expanded[top.slug] && top.children && (
              <div className="px-hsp-md py-vsp-2xs">
                {renderChildren(top.children, 1)}
              </div>
            )}
          </div>
        ))}
      </div>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 24: Two-Panel
 * ══════════════════════════════════════════ */
function P24() {
  const [selected, setSelected] = useState("getting-started");
  const selectedCat = sampleTree.find((t) => t.slug === selected);

  function renderChildren(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <div
                className="py-[3px] text-small font-semibold text-muted"
                style={{ paddingLeft: `${depth * 14}px` }}
              >
                {node.label}
              </div>
              {node.children && renderChildren(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Two-Panel" num={24}>
      <div className="flex h-full">
        <div className="w-[120px] border-r border-muted bg-surface py-vsp-xs flex-shrink-0">
          {sampleTree.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelected(cat.slug)}
              className={`block w-full text-left px-hsp-md py-vsp-2xs text-small ${selected === cat.slug ? "text-accent font-semibold bg-bg" : "text-fg hover:text-accent"}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex-1 py-vsp-xs px-hsp-md">
          {selectedCat?.children && renderChildren(selectedCat.children, 0)}
        </div>
      </div>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 25: With Search Filter
 * ══════════════════════════════════════════ */
function P25() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  const tree = query ? filterTree(sampleTree, query) : sampleTree;

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = query ? true : expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 30}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="With Search Filter" num={25}>
      <div className="p-hsp-sm border-b border-muted">
        <div className="flex items-center gap-hsp-xs bg-surface rounded px-hsp-sm py-vsp-2xs">
          <IconSearch />
          <input
            type="text"
            placeholder="Filter docs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent text-small outline-none w-full text-fg placeholder:text-muted"
          />
        </div>
      </div>
      <nav className="py-vsp-xs">
        {tree.length > 0 ? (
          renderNodes(tree, 0)
        ) : (
          <div className="px-hsp-lg py-vsp-sm text-small text-muted">No results</div>
        )}
      </nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 26: Breadcrumb Trail in Sidebar
 * ══════════════════════════════════════════ */
function P26() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  const breadcrumb = findPath(sampleTree, ACTIVE_SLUG) || [];

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 30}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Breadcrumb Trail" num={26}>
      <div className="px-hsp-md py-vsp-xs border-b border-muted bg-surface">
        <div className="text-caption text-muted flex items-center gap-hsp-2xs flex-wrap">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-hsp-2xs">
              {i > 0 && <span>/</span>}
              <span className={i === breadcrumb.length - 1 ? "text-accent" : ""}>{crumb}</span>
            </span>
          ))}
        </div>
      </div>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 27: Icon + Badge Combo
 * ══════════════════════════════════════════ */
function P27() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
              >
                <IconFolder />
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <a
              className={`flex items-center gap-hsp-xs py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
            >
              <IconFile />
              {node.label}
              {node.isNew && (
                <span className="text-caption bg-success text-bg px-hsp-2xs rounded ml-auto mr-hsp-md font-medium">
                  new
                </span>
              )}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Icon + Badge Combo" num={27}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 28: Color-Coded Categories
 * ══════════════════════════════════════════ */
function P28() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  const categoryColors: Record<string, string> = {
    "getting-started": "var(--zd-2)",
    guides: "var(--zd-4)",
    api: "var(--zd-6)",
    changelog: "var(--zd-3)",
  };

  function renderNodes(nodes: DocNode[], depth: number, topSlug: string) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];
      const color = categoryColors[topSlug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-semibold hover:opacity-80"
                style={{
                  paddingLeft: `${depth * 14 + 10}px`,
                  color: depth === 0 ? color : undefined,
                }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1, topSlug)}
            </>
          ) : (
            <a
              className={`block py-[3px] text-small ${isActive ? "font-medium" : "text-fg hover:opacity-80"}`}
              style={{
                paddingLeft: `${depth * 14 + 30}px`,
                color: isActive ? color : undefined,
                borderLeft: isActive ? `2px solid ${color}` : undefined,
              }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Color-Coded Categories" num={28}>
      <nav className="py-vsp-xs">
        {sampleTree.map((top) => (
          <div key={top.slug}>{renderNodes([top], 0, top.slug)}</div>
        ))}
      </nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 29: Hover Preview (Tooltip)
 * ══════════════════════════════════════════ */
function P29() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    "guides/themes": true,
    api: true,
    changelog: true,
  });

  const previews: Record<string, string> = {
    "getting-started/introduction": "Overview of the project and its goals",
    "getting-started/installation": "How to install via npm/pnpm",
    "getting-started/quick-start": "Get up and running in minutes",
    "guides/writing-docs": "MDX authoring guidelines",
    "guides/configuration": "Customize settings and behavior",
    "guides/themes/color-schemes": "Built-in color scheme options",
    "guides/themes/custom-theme": "Create your own theme",
    "api/components": "Reusable UI components",
    "api/utilities": "Utility functions and helpers",
    "api/hooks": "React hooks reference",
    "changelog/v2": "Latest release highlights",
    "changelog/v1": "Initial release notes",
  };

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug];

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-[3px] text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              {isOpen && node.children && renderNodes(node.children, depth + 1)}
            </>
          ) : (
            <div className="relative group">
              <a
                className={`block py-[3px] text-small ${isActive ? "text-accent font-medium" : "text-fg hover:text-accent"}`}
                style={{ paddingLeft: `${depth * 14 + 30}px` }}
              >
                {node.label}
              </a>
              {previews[node.slug] && (
                <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-20">
                  <div className="bg-surface border border-muted rounded px-hsp-sm py-vsp-2xs text-caption text-fg shadow-lg whitespace-nowrap max-w-[200px]">
                    {previews[node.slug]}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Hover Preview" num={29}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Pattern 30: Animated Expand
 * ══════════════════════════════════════════ */
function AnimatedCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(open ? "auto" : 0);

  useEffect(() => {
    if (!ref.current) return;
    if (open) {
      setHeight(ref.current.scrollHeight);
      const timer = setTimeout(() => setHeight("auto"), 300);
      return () => clearTimeout(timer);
    } else {
      setHeight(ref.current.scrollHeight);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [open]);

  return (
    <div
      ref={ref}
      className="overflow-hidden transition-[height] duration-300 ease-in-out"
      style={{ height: typeof height === "number" ? `${height}px` : "auto" }}
    >
      {children}
    </div>
  );
}

function P30() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: false,
    "guides/themes": false,
    api: false,
    changelog: false,
  });

  function renderNodes(nodes: DocNode[], depth: number) {
    return nodes.map((node) => {
      const isCategory = !!node.children;
      const isActive = node.slug === ACTIVE_SLUG;
      const isOpen = expanded[node.slug] ?? false;

      return (
        <div key={node.slug}>
          {isCategory ? (
            <>
              <button
                onClick={() => setExpanded((p) => ({ ...p, [node.slug]: !p[node.slug] }))}
                className="flex items-center gap-hsp-xs w-full text-left py-vsp-2xs text-small font-semibold hover:text-accent"
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
              >
                <span
                  className={`transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
                >
                  <IconChevronRight />
                </span>
                {node.label}
              </button>
              <AnimatedCollapse open={isOpen}>
                {node.children && renderNodes(node.children, depth + 1)}
              </AnimatedCollapse>
            </>
          ) : (
            <a
              className={`block py-vsp-2xs text-small ${isActive ? "text-accent font-medium bg-surface" : "text-fg hover:bg-surface"}`}
              style={{ paddingLeft: `${depth * 14 + 30}px` }}
            >
              {node.label}
            </a>
          )}
        </div>
      );
    });
  }

  return (
    <PatternBox title="Animated Expand" num={30}>
      <nav className="py-vsp-xs">{renderNodes(sampleTree, 0)}</nav>
    </PatternBox>
  );
}

/* ══════════════════════════════════════════
 * Main Page
 * ══════════════════════════════════════════ */
export default function SidebarsPage() {
  return (
    <div className="px-hsp-xl py-vsp-xl max-w-[1400px] mx-auto">
      <h1 className="text-heading font-bold mb-vsp-xs">
        Sidebar Patterns — Doc Hierarchy
      </h1>
      <p className="text-muted mb-vsp-lg text-small">
        30 documentation sidebar patterns with folder-like hierarchy, collapsible
        categories, and active states.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-hsp-xl">
        <P1 />
        <P2 />
        <P3 />
        <P4 />
        <P5 />
        <P6 />
        <P7 />
        <P8 />
        <P9 />
        <P10 />
        <P11 />
        <P12 />
        <P13 />
        <P14 />
        <P15 />
        <P16 />
        <P17 />
        <P18 />
        <P19 />
        <P20 />
        <P21 />
        <P22 />
        <P23 />
        <P24 />
        <P25 />
        <P26 />
        <P27 />
        <P28 />
        <P29 />
        <P30 />
      </div>
    </div>
  );
}
