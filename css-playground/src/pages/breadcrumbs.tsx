import { useState } from "react";

/* ── Shared icon components ── */

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FolderIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
    </svg>
  );
}

function BookIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06V3.44a.75.75 0 00-.44-.68A8.963 8.963 0 0015 2.25a8.962 8.962 0 00-4.25 1.063v13.507zM9.25 4.313A8.963 8.963 0 005 2.25c-.89 0-1.752.131-2.56.369a.75.75 0 00-.44.68v11.62a.75.75 0 00.96.72A7.462 7.462 0 015 15.5c1.59 0 3.06.497 4.25 1.32V4.313z" />
    </svg>
  );
}

function CogIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ── Demo wrapper ── */

function PatternBox({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-muted rounded-lg overflow-hidden">
      <div className="bg-surface px-hsp-lg py-vsp-xs border-b border-muted">
        <span className="text-small text-muted font-mono">
          #{number.toString().padStart(2, "0")}
        </span>
        <span className="text-small text-fg ml-hsp-sm font-medium">
          {title}
        </span>
      </div>
      <div className="px-hsp-xl py-vsp-md">{children}</div>
    </div>
  );
}

/* ── Breadcrumb item type ── */
type BreadcrumbItem = { label: string; href?: string };

const defaultItems: BreadcrumbItem[] = [
  { label: "Home", href: "#" },
  { label: "Documentation", href: "#" },
  { label: "Getting Started", href: "#" },
  { label: "Installation" },
];

/* ===========================
 * 20 Breadcrumb Patterns
 * =========================== */

/* 1. Simple text with / separator */
function Pattern01() {
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <span className="text-muted">/</span>}
          {item.href ? (
            <a href={item.href} className="text-accent hover:text-accent-hover">
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 2. Chevron separator */
function Pattern02() {
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <ChevronIcon className="text-muted" />}
          {item.href ? (
            <a href={item.href} className="text-accent hover:text-accent-hover">
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 3. Arrow separator */
function Pattern03() {
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <span className="text-muted">→</span>}
          {item.href ? (
            <a href={item.href} className="text-accent hover:text-accent-hover">
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 4. Dot separator */
function Pattern04() {
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <span className="text-muted">•</span>}
          {item.href ? (
            <a href={item.href} className="text-accent hover:text-accent-hover">
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 5. With home icon */
function Pattern05() {
  const items: BreadcrumbItem[] = [
    { label: "Home", href: "#" },
    { label: "Documentation", href: "#" },
    { label: "Getting Started", href: "#" },
    { label: "Installation" },
  ];
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <ChevronIcon className="text-muted" />}
          {i === 0 ? (
            <a
              href={item.href}
              className="text-accent hover:text-accent-hover flex items-center"
              aria-label="Home"
            >
              <HomeIcon />
            </a>
          ) : item.href ? (
            <a href={item.href} className="text-accent hover:text-accent-hover">
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 6. Pill/badge style */
function Pattern06() {
  return (
    <nav className="flex items-center gap-hsp-xs text-small">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-xs">
          {i > 0 && <ChevronIcon className="text-muted" />}
          {item.href ? (
            <a
              href={item.href}
              className="bg-surface text-accent hover:bg-sel-bg px-hsp-sm py-vsp-2xs rounded-full"
            >
              {item.label}
            </a>
          ) : (
            <span className="bg-accent text-bg px-hsp-sm py-vsp-2xs rounded-full font-medium">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 7. With dropdown on item */
function Pattern07() {
  const [open, setOpen] = useState(false);
  const siblings = ["Getting Started", "API Reference", "Guides", "FAQ"];
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      <a href="#" className="text-accent hover:text-accent-hover">
        Home
      </a>
      <ChevronIcon className="text-muted" />
      <a href="#" className="text-accent hover:text-accent-hover">
        Documentation
      </a>
      <ChevronIcon className="text-muted" />
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="text-accent hover:text-accent-hover flex items-center gap-hsp-2xs"
        >
          Getting Started
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-vsp-2xs bg-surface border border-muted rounded-lg shadow-lg py-vsp-2xs min-w-[180px] z-10">
            {siblings.map((s) => (
              <a
                key={s}
                href="#"
                className="block px-hsp-md py-vsp-2xs text-small text-fg hover:bg-sel-bg hover:text-accent"
              >
                {s}
              </a>
            ))}
          </div>
        )}
      </div>
      <ChevronIcon className="text-muted" />
      <span className="text-fg">Installation</span>
    </nav>
  );
}

/* 8. Truncated/ellipsis */
function Pattern08() {
  const items: BreadcrumbItem[] = [
    { label: "Home", href: "#" },
    { label: "...", href: "#" },
    { label: "Getting Started", href: "#" },
    { label: "Installation" },
  ];
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <ChevronIcon className="text-muted" />}
          {item.label === "..." ? (
            <button className="text-muted hover:text-fg px-hsp-xs">
              •••
            </button>
          ) : item.href ? (
            <a href={item.href} className="text-accent hover:text-accent-hover">
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 9. Large/prominent */
function Pattern09() {
  return (
    <nav className="flex items-center gap-hsp-md text-subheading">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-md">
          {i > 0 && <span className="text-muted text-heading">/</span>}
          {item.href ? (
            <a
              href={item.href}
              className="text-muted hover:text-accent font-medium"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-fg font-bold text-heading">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 10. Small/subtle */
function Pattern10() {
  return (
    <nav className="flex items-center gap-hsp-xs text-caption">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-xs">
          {i > 0 && <span className="text-muted">/</span>}
          {item.href ? (
            <a href={item.href} className="text-muted hover:text-accent">
              {item.label}
            </a>
          ) : (
            <span className="text-muted">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 11. Underline links */
function Pattern11() {
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <ChevronIcon className="text-muted" />}
          {item.href ? (
            <a
              href={item.href}
              className="text-fg hover:text-accent underline decoration-muted hover:decoration-accent underline-offset-4"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 12. Background highlight */
function Pattern12() {
  return (
    <nav className="flex items-center gap-px text-small">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center">
          {item.href ? (
            <a
              href={item.href}
              className="bg-surface hover:bg-sel-bg text-fg hover:text-accent px-hsp-md py-vsp-2xs"
            >
              {item.label}
            </a>
          ) : (
            <span className="bg-accent text-bg px-hsp-md py-vsp-2xs font-medium">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 13. With current page bold */
function Pattern13() {
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && <span className="text-muted">/</span>}
          {item.href ? (
            <a href={item.href} className="text-muted hover:text-accent">
              {item.label}
            </a>
          ) : (
            <span className="text-fg font-bold" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 14. Slash separated monospace */
function Pattern14() {
  const pathItems: BreadcrumbItem[] = [
    { label: "~", href: "#" },
    { label: "docs", href: "#" },
    { label: "getting-started", href: "#" },
    { label: "installation.md" },
  ];
  return (
    <nav className="flex items-center text-small font-mono bg-surface px-hsp-md py-vsp-xs rounded-lg">
      {pathItems.map((item, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <span className="text-muted mx-hsp-2xs">/</span>}
          {item.href ? (
            <a href={item.href} className="text-accent hover:text-accent-hover">
              {item.label}
            </a>
          ) : (
            <span className="text-fg">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 15. Step indicator style */
function Pattern15() {
  const steps = ["Home", "Documentation", "Getting Started", "Installation"];
  const currentStep = 3;
  return (
    <nav className="flex items-center gap-hsp-md text-small">
      {steps.map((step, i) => (
        <span key={i} className="flex items-center gap-hsp-md">
          {i > 0 && (
            <div
              className={`w-8 h-px ${i <= currentStep ? "bg-accent" : "bg-muted"}`}
            />
          )}
          <span className="flex items-center gap-hsp-xs">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-caption font-bold ${
                i < currentStep
                  ? "bg-accent text-bg"
                  : i === currentStep
                    ? "border-2 border-accent text-accent"
                    : "border border-muted text-muted"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={
                i <= currentStep ? "text-fg font-medium" : "text-muted"
              }
            >
              {step}
            </span>
          </span>
        </span>
      ))}
    </nav>
  );
}

/* 16. With icons per item */
function Pattern16() {
  const iconItems = [
    { label: "Home", href: "#", icon: HomeIcon },
    { label: "Documentation", href: "#", icon: BookIcon },
    { label: "Getting Started", href: "#", icon: FolderIcon },
    { label: "Installation", icon: CogIcon },
  ];
  return (
    <nav className="flex items-center gap-hsp-sm text-body">
      {iconItems.map((item, i) => {
        const Icon = item.icon;
        return (
          <span key={i} className="flex items-center gap-hsp-sm">
            {i > 0 && <ChevronIcon className="text-muted" />}
            {item.href ? (
              <a
                href={item.href}
                className="text-accent hover:text-accent-hover flex items-center gap-hsp-2xs"
              >
                <Icon />
                {item.label}
              </a>
            ) : (
              <span className="text-fg flex items-center gap-hsp-2xs">
                <Icon />
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* 17. Vertical breadcrumb */
function Pattern17() {
  return (
    <nav className="flex flex-col text-body">
      {defaultItems.map((item, i) => (
        <div
          key={i}
          className="flex items-center"
          style={{ paddingLeft: `${i * 1.25}rem` }}
        >
          {i > 0 && (
            <span className="text-muted mr-hsp-sm text-small">└</span>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="text-accent hover:text-accent-hover py-vsp-2xs"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-fg font-medium py-vsp-2xs">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

/* 18. Animated separator */
function Pattern18() {
  return (
    <nav className="flex items-center gap-hsp-sm text-body group/bc">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-sm">
          {i > 0 && (
            <span className="text-muted transition-transform duration-300 group-hover/bc:translate-x-0.5 inline-block">
              <ChevronIcon />
            </span>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="text-accent hover:text-accent-hover transition-colors duration-200"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-fg transition-colors duration-200">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* 19. Color-coded depth */
function Pattern19() {
  const depthColors = [
    "text-p4",
    "text-p6",
    "text-p2",
    "text-p5",
  ];
  const depthBgs = [
    "bg-p4/15",
    "bg-p6/15",
    "bg-p2/15",
    "bg-p5/15",
  ];
  return (
    <nav className="flex items-center gap-hsp-xs text-body">
      {defaultItems.map((item, i) => (
        <span key={i} className="flex items-center gap-hsp-xs">
          {i > 0 && <ChevronIcon className="text-muted" />}
          <span
            className={`${depthColors[i]} ${depthBgs[i]} px-hsp-sm py-vsp-2xs rounded ${
              item.href ? "hover:opacity-80 cursor-pointer" : "font-medium"
            }`}
          >
            {item.label}
          </span>
        </span>
      ))}
    </nav>
  );
}

/* 20. Card breadcrumb */
function Pattern20() {
  return (
    <div className="bg-surface border border-muted rounded-lg px-hsp-lg py-vsp-sm">
      <nav className="flex items-center gap-hsp-sm text-body">
        {defaultItems.map((item, i) => (
          <span key={i} className="flex items-center gap-hsp-sm">
            {i > 0 && <ChevronIcon className="text-muted" />}
            {item.href ? (
              <a
                href={item.href}
                className="text-accent hover:text-accent-hover"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-fg font-semibold">{item.label}</span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}

/* ── Main page ── */

export default function BreadcrumbsPage() {
  const patterns = [
    { title: "Simple text with / separator", Component: Pattern01 },
    { title: "Chevron separator", Component: Pattern02 },
    { title: "Arrow separator", Component: Pattern03 },
    { title: "Dot separator", Component: Pattern04 },
    { title: "With home icon", Component: Pattern05 },
    { title: "Pill / badge style", Component: Pattern06 },
    { title: "With dropdown on item", Component: Pattern07 },
    { title: "Truncated / ellipsis", Component: Pattern08 },
    { title: "Large / prominent", Component: Pattern09 },
    { title: "Small / subtle", Component: Pattern10 },
    { title: "Underline links", Component: Pattern11 },
    { title: "Background highlight", Component: Pattern12 },
    { title: "With current page bold", Component: Pattern13 },
    { title: "Slash separated monospace", Component: Pattern14 },
    { title: "Step indicator style", Component: Pattern15 },
    { title: "With icons per item", Component: Pattern16 },
    { title: "Vertical breadcrumb", Component: Pattern17 },
    { title: "Animated separator", Component: Pattern18 },
    { title: "Color-coded depth", Component: Pattern19 },
    { title: "Card breadcrumb", Component: Pattern20 },
  ];

  return (
    <div className="px-hsp-xl py-vsp-xl max-w-[960px] mx-auto">
      <h1 className="text-display font-bold mb-vsp-sm">Breadcrumbs</h1>
      <p className="text-muted mb-vsp-xl text-subheading">
        20 breadcrumb navigation design patterns
      </p>
      <div className="flex flex-col gap-vsp-lg">
        {patterns.map((p, i) => (
          <PatternBox key={i} number={i + 1} title={p.title}>
            <p.Component />
          </PatternBox>
        ))}
      </div>
    </div>
  );
}
