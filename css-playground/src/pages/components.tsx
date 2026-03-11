/* ── 20 Base Component Design Patterns ── */

function PatternBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-muted rounded-lg overflow-hidden">
      <div className="bg-surface px-hsp-lg py-vsp-2xs border-b border-muted">
        <span className="text-caption text-muted font-medium">{title}</span>
      </div>
      <div className="p-hsp-xl">{children}</div>
    </div>
  );
}

/* ── SVG Icons ── */

function BookIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ArrowLeft({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function WarningIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function TipIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function FileIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ── Pattern 1: Simple h1 ── */
function Pattern01() {
  return (
    <PatternBox title="01 — Simple h1">
      <h1 className="text-display font-bold leading-tight">
        Getting Started
      </h1>
    </PatternBox>
  );
}

/* ── Pattern 2: h1 + subtitle ── */
function Pattern02() {
  return (
    <PatternBox title="02 — h1 + subtitle">
      <h1 className="text-heading font-bold leading-tight">
        Configuration Guide
      </h1>
      <p className="text-subheading text-muted mt-vsp-xs leading-relaxed">
        Learn how to configure your project settings for optimal performance.
      </p>
    </PatternBox>
  );
}

/* ── Pattern 3: h1 + description + meta ── */
function Pattern03() {
  return (
    <PatternBox title="03 — h1 + description + meta">
      <h1 className="text-heading font-bold leading-tight">
        Understanding Layouts
      </h1>
      <p className="text-body text-muted mt-vsp-xs leading-relaxed">
        A comprehensive guide to building flexible and responsive layouts with
        modern CSS techniques.
      </p>
      <div className="flex gap-hsp-lg mt-vsp-sm text-caption text-muted">
        <span>March 8, 2026</span>
        <span>·</span>
        <span>Takazudo</span>
        <span>·</span>
        <span className="text-accent">CSS</span>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 4: h1 with accent border-bottom ── */
function Pattern04() {
  return (
    <PatternBox title="04 — h1 with accent border-bottom">
      <h1 className="text-heading font-bold leading-tight pb-vsp-sm border-b-2 border-accent">
        API Reference
      </h1>
      <p className="text-body text-muted mt-vsp-sm leading-relaxed">
        Complete reference documentation for all available endpoints.
      </p>
    </PatternBox>
  );
}

/* ── Pattern 5: h1 with left bar ── */
function Pattern05() {
  return (
    <PatternBox title="05 — h1 with left bar">
      <div className="border-l-4 border-accent pl-hsp-lg">
        <h1 className="text-heading font-bold leading-tight">
          Migration Guide
        </h1>
        <p className="text-body text-muted mt-vsp-xs leading-relaxed">
          Step-by-step instructions for upgrading from v2 to v3.
        </p>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 6: h1 + breadcrumb above ── */
function Pattern06() {
  return (
    <PatternBox title="06 — h1 + breadcrumb above">
      <nav className="flex items-center gap-hsp-2xs text-caption text-muted mb-vsp-sm">
        <span className="hover:text-accent cursor-pointer">Docs</span>
        <ChevronRight className="text-muted" />
        <span className="hover:text-accent cursor-pointer">Guides</span>
        <ChevronRight className="text-muted" />
        <span className="text-fg">Authentication</span>
      </nav>
      <h1 className="text-heading font-bold leading-tight">Authentication</h1>
      <p className="text-body text-muted mt-vsp-xs leading-relaxed">
        Implement secure authentication flows in your application.
      </p>
    </PatternBox>
  );
}

/* ── Pattern 7: h1 with category badge ── */
function Pattern07() {
  return (
    <PatternBox title="07 — h1 with category badge">
      <span className="inline-block text-caption font-medium text-accent bg-surface px-hsp-sm py-vsp-2xs rounded-full border border-accent mb-vsp-sm">
        Tutorial
      </span>
      <h1 className="text-heading font-bold leading-tight">
        Building Your First Plugin
      </h1>
      <p className="text-body text-muted mt-vsp-xs leading-relaxed">
        Create a custom plugin from scratch with this hands-on tutorial.
      </p>
    </PatternBox>
  );
}

/* ── Pattern 8: h1 + description + cover image ── */
function Pattern08() {
  return (
    <PatternBox title="08 — h1 + description + cover image">
      <h1 className="text-heading font-bold leading-tight">
        Visual Design System
      </h1>
      <p className="text-body text-muted mt-vsp-xs leading-relaxed">
        Explore the principles behind our design token architecture.
      </p>
      <div className="mt-vsp-md rounded-lg bg-surface border border-muted h-48 flex items-center justify-center">
        <span className="text-small text-muted">Cover Image Placeholder</span>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 9: Centered h1 ── */
function Pattern09() {
  return (
    <PatternBox title="09 — Centered h1">
      <div className="text-center">
        <span className="text-caption text-muted font-medium tracking-widest uppercase">
          Documentation
        </span>
        <h1 className="text-display font-bold leading-tight mt-vsp-xs">
          Changelog
        </h1>
        <p className="text-subheading text-muted mt-vsp-xs leading-relaxed max-w-[480px] mx-auto">
          All notable changes to this project will be documented here.
        </p>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 10: h1 with icon prefix ── */
function Pattern10() {
  return (
    <PatternBox title="10 — h1 with icon prefix">
      <div className="flex items-center gap-hsp-md">
        <div className="text-accent">
          <BookIcon />
        </div>
        <div>
          <h1 className="text-heading font-bold leading-tight">
            Developer Handbook
          </h1>
          <p className="text-body text-muted mt-vsp-2xs leading-relaxed">
            Essential references and best practices for the team.
          </p>
        </div>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 11: h1 + reading time ── */
function Pattern11() {
  return (
    <PatternBox title="11 — h1 + reading time">
      <h1 className="text-heading font-bold leading-tight">
        Performance Optimization
      </h1>
      <div className="flex items-center gap-hsp-xs mt-vsp-xs text-small text-muted">
        <ClockIcon />
        <span>8 min read</span>
        <span className="mx-hsp-xs">·</span>
        <span>Updated March 2026</span>
      </div>
      <p className="text-body text-muted mt-vsp-sm leading-relaxed">
        Practical tips for improving your application's load time and runtime
        performance.
      </p>
    </PatternBox>
  );
}

/* ── Pattern 12: Article card ── */
function Pattern12() {
  return (
    <PatternBox title="12 — Article card">
      <div className="border border-muted rounded-lg p-hsp-xl hover:border-accent cursor-pointer">
        <div className="flex items-center gap-hsp-sm text-caption text-muted mb-vsp-xs">
          <span className="bg-surface text-accent px-hsp-sm py-vsp-2xs rounded-full text-caption font-medium">
            Guide
          </span>
          <span>·</span>
          <span>March 5, 2026</span>
        </div>
        <h2 className="text-subheading font-semibold leading-snug">
          Deploying to Production
        </h2>
        <p className="text-small text-muted mt-vsp-xs leading-relaxed">
          Learn the best practices for deploying your application to a
          production environment, including CI/CD setup and monitoring.
        </p>
        <div className="flex items-center gap-hsp-xs mt-vsp-sm text-caption text-muted">
          <ClockIcon />
          <span>5 min read</span>
        </div>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 13: Blockquote ── */
function Pattern13() {
  return (
    <PatternBox title="13 — Blockquote">
      <blockquote className="border-l-4 border-accent pl-hsp-xl py-vsp-2xs">
        <p className="text-body leading-relaxed italic">
          "Good design is as little design as possible. Less, but better —
          because it concentrates on the essential aspects, and the products are
          not burdened with non-essentials."
        </p>
        <footer className="mt-vsp-sm text-small text-muted">
          — Dieter Rams
        </footer>
      </blockquote>
    </PatternBox>
  );
}

/* ── Pattern 14: Callout / Admonition ── */
function Pattern14() {
  return (
    <PatternBox title="14 — Callout / Admonition">
      <div className="flex flex-col gap-vsp-md">
        {/* Info */}
        <div className="flex gap-hsp-md p-hsp-lg rounded-lg border border-info bg-surface">
          <div className="text-info shrink-0 mt-px">
            <InfoIcon />
          </div>
          <div>
            <p className="text-small font-semibold text-info mb-vsp-2xs">
              Note
            </p>
            <p className="text-small leading-relaxed text-fg">
              This feature requires version 3.0 or later. Check your installed
              version before proceeding.
            </p>
          </div>
        </div>
        {/* Warning */}
        <div className="flex gap-hsp-md p-hsp-lg rounded-lg border border-warning bg-surface">
          <div className="text-warning shrink-0 mt-px">
            <WarningIcon />
          </div>
          <div>
            <p className="text-small font-semibold text-warning mb-vsp-2xs">
              Warning
            </p>
            <p className="text-small leading-relaxed text-fg">
              Modifying this setting will affect all users in your organization.
              Proceed with caution.
            </p>
          </div>
        </div>
        {/* Tip */}
        <div className="flex gap-hsp-md p-hsp-lg rounded-lg border border-success bg-surface">
          <div className="text-success shrink-0 mt-px">
            <TipIcon />
          </div>
          <div>
            <p className="text-small font-semibold text-success mb-vsp-2xs">
              Tip
            </p>
            <p className="text-small leading-relaxed text-fg">
              You can use keyboard shortcut{" "}
              <kbd className="text-caption font-mono bg-code-bg text-code-fg px-hsp-xs py-vsp-2xs rounded">
                Ctrl+K
              </kbd>{" "}
              to quickly access the command palette.
            </p>
          </div>
        </div>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 15: Code snippet header ── */
function Pattern15() {
  return (
    <PatternBox title="15 — Code snippet header">
      <div className="rounded-lg border border-muted overflow-hidden">
        <div className="flex items-center gap-hsp-sm bg-surface px-hsp-lg py-vsp-2xs border-b border-muted">
          <FileIcon className="text-muted" />
          <span className="text-caption font-mono text-muted">
            src/config/settings.ts
          </span>
          <button className="ml-auto text-caption text-muted hover:text-accent">
            Copy
          </button>
        </div>
        <div className="bg-code-bg p-hsp-lg font-mono text-small text-code-fg leading-relaxed">
          <div>
            <span className="text-muted select-none mr-hsp-lg">1</span>
            export const settings = {"{"}
          </div>
          <div>
            <span className="text-muted select-none mr-hsp-lg">2</span>
            {"  "}colorScheme: "dracula",
          </div>
          <div>
            <span className="text-muted select-none mr-hsp-lg">3</span>
            {"  "}docsDir: "src/content/docs",
          </div>
          <div>
            <span className="text-muted select-none mr-hsp-lg">4</span>
            {"}"};
          </div>
        </div>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 16: Table of contents ── */
function Pattern16() {
  return (
    <PatternBox title="16 — Table of contents">
      <div className="border border-muted rounded-lg p-hsp-xl">
        <h3 className="text-small font-semibold mb-vsp-sm">On this page</h3>
        <nav className="flex flex-col gap-vsp-2xs text-small">
          <a className="text-fg hover:text-accent font-medium cursor-pointer">
            Overview
          </a>
          <a className="text-muted hover:text-accent pl-hsp-lg cursor-pointer">
            Prerequisites
          </a>
          <a className="text-muted hover:text-accent pl-hsp-lg cursor-pointer">
            System requirements
          </a>
          <a className="text-fg hover:text-accent font-medium cursor-pointer">
            Installation
          </a>
          <a className="text-muted hover:text-accent pl-hsp-lg cursor-pointer">
            Using npm
          </a>
          <a className="text-muted hover:text-accent pl-hsp-lg cursor-pointer">
            Using pnpm
          </a>
          <a className="text-fg hover:text-accent font-medium cursor-pointer">
            Configuration
          </a>
          <a className="text-muted hover:text-accent pl-hsp-lg cursor-pointer">
            Basic setup
          </a>
          <a className="text-muted hover:text-accent pl-hsp-lg cursor-pointer">
            Advanced options
          </a>
          <a className="text-fg hover:text-accent font-medium cursor-pointer">
            Troubleshooting
          </a>
        </nav>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 17: Tag / label collection ── */
function Pattern17() {
  const tags = [
    "React",
    "TypeScript",
    "Tailwind CSS",
    "Astro",
    "MDX",
    "Vite",
    "Node.js",
    "CSS Variables",
    "Design Tokens",
  ];
  return (
    <PatternBox title="17 — Tag / label collection">
      <h3 className="text-small font-semibold mb-vsp-sm">Topics</h3>
      <div className="flex flex-wrap gap-hsp-sm">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-caption font-medium px-hsp-md py-vsp-2xs rounded-full border border-muted text-muted hover:border-accent hover:text-accent cursor-pointer"
          >
            {tag}
          </span>
        ))}
      </div>
    </PatternBox>
  );
}

/* ── Pattern 18: Author bio block ── */
function Pattern18() {
  return (
    <PatternBox title="18 — Author bio block">
      <div className="flex gap-hsp-xl items-start">
        <div className="shrink-0 w-16 h-16 rounded-full bg-surface border border-muted flex items-center justify-center text-muted">
          <UserIcon />
        </div>
        <div>
          <p className="text-body font-semibold">Takazudo</p>
          <p className="text-caption text-accent">@takazudo</p>
          <p className="text-small text-muted mt-vsp-xs leading-relaxed">
            Frontend engineer focused on design systems, CSS architecture, and
            developer tooling. Building documentation frameworks that are both
            beautiful and functional.
          </p>
        </div>
      </div>
    </PatternBox>
  );
}

/* ── Pattern 19: Related articles ── */
function Pattern19() {
  const articles = [
    {
      title: "Getting Started with Design Tokens",
      desc: "Learn how to use semantic color tokens in your project.",
      tag: "Basics",
    },
    {
      title: "Advanced Layout Techniques",
      desc: "Master CSS Grid and Flexbox for complex page layouts.",
      tag: "CSS",
    },
    {
      title: "Theming with ANSI Colors",
      desc: "How the 16-color palette powers the entire design system.",
      tag: "Deep Dive",
    },
  ];
  return (
    <PatternBox title="19 — Related articles">
      <h3 className="text-small font-semibold mb-vsp-sm">Related Articles</h3>
      <div className="flex flex-col gap-vsp-sm">
        {articles.map((article) => (
          <div
            key={article.title}
            className="flex items-start gap-hsp-lg p-hsp-lg rounded-lg border border-muted hover:border-accent cursor-pointer"
          >
            <div className="flex-1">
              <p className="text-small font-semibold leading-snug">
                {article.title}
              </p>
              <p className="text-caption text-muted mt-vsp-2xs leading-relaxed">
                {article.desc}
              </p>
            </div>
            <span className="shrink-0 text-caption text-accent font-medium bg-surface px-hsp-sm py-vsp-2xs rounded-full">
              {article.tag}
            </span>
          </div>
        ))}
      </div>
    </PatternBox>
  );
}

/* ── Pattern 20: Page navigation (prev/next) ── */
function Pattern20() {
  return (
    <PatternBox title="20 — Page navigation (prev/next)">
      <div className="grid grid-cols-2 gap-hsp-xl">
        <div className="border border-muted rounded-lg p-hsp-lg hover:border-accent cursor-pointer group">
          <div className="flex items-center gap-hsp-xs text-caption text-muted mb-vsp-2xs">
            <ArrowLeft />
            <span>Previous</span>
          </div>
          <p className="text-small font-semibold group-hover:text-accent">
            Installation Guide
          </p>
        </div>
        <div className="border border-muted rounded-lg p-hsp-lg hover:border-accent cursor-pointer group text-right">
          <div className="flex items-center justify-end gap-hsp-xs text-caption text-muted mb-vsp-2xs">
            <span>Next</span>
            <ArrowRight />
          </div>
          <p className="text-small font-semibold group-hover:text-accent">
            Advanced Configuration
          </p>
        </div>
      </div>
    </PatternBox>
  );
}

/* ── Main Page ── */
export default function ComponentsPage() {
  return (
    <div className="px-hsp-xl py-vsp-xl max-w-[800px] mx-auto">
      <h1 className="text-display font-bold mb-vsp-xs">Component Patterns</h1>
      <p className="text-muted text-subheading mb-vsp-xl">
        20 base component patterns for documentation and blog content.
      </p>
      <div className="flex flex-col gap-vsp-xl">
        <Pattern01 />
        <Pattern02 />
        <Pattern03 />
        <Pattern04 />
        <Pattern05 />
        <Pattern06 />
        <Pattern07 />
        <Pattern08 />
        <Pattern09 />
        <Pattern10 />
        <Pattern11 />
        <Pattern12 />
        <Pattern13 />
        <Pattern14 />
        <Pattern15 />
        <Pattern16 />
        <Pattern17 />
        <Pattern18 />
        <Pattern19 />
        <Pattern20 />
      </div>
    </div>
  );
}
