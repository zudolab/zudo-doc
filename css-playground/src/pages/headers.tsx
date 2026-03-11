/* ── Pattern Wrapper ── */

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
      <div className="px-hsp-lg py-vsp-xs border-b border-muted bg-surface">
        <span className="text-caption text-muted">
          Pattern {number} — {title}
        </span>
      </div>
      <div className="bg-bg px-hsp-xl py-vsp-lg">{children}</div>
    </div>
  );
}

/* ── Body text helper ── */
function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-body text-muted leading-relaxed">{children}</p>
  );
}

/* ════════════════════════════════════════
 * 30 Heading Patterns (h2 / h3 / h4)
 * ════════════════════════════════════════ */

/* 1. Double border h2 — zpaper-inspired */
function Heading01() {
  return (
    <PatternBox number={1} title="Double Border (zpaper-inspired)">
      <h2 className="text-heading font-bold border-t-[8px] border-b border-accent pt-vsp-sm pb-vsp-xs mb-vsp-md">
        Configuration
      </h2>
      <Body>
        All configuration is managed through a single settings file at the
        root of your project.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm border-b border-muted pb-vsp-xs">
        Environment Variables
      </h3>
      <Body>
        Environment variables are loaded from a .env file and validated at
        startup.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        Database Settings
      </h4>
      <Body>
        Connection strings and pool sizes are configured per environment.
      </Body>
    </PatternBox>
  );
}

/* 2. Bottom border only */
function Heading02() {
  return (
    <PatternBox number={2} title="Bottom Border Only">
      <h2 className="text-heading font-bold border-b-4 border-accent pb-vsp-xs mb-vsp-md">
        Getting Started
      </h2>
      <Body>
        Follow these steps to set up the project on your local machine.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg border-b-2 border-muted pb-vsp-xs mb-vsp-sm">
        Prerequisites
      </h3>
      <Body>
        Make sure you have Node.js 20 or later installed before proceeding.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md border-b border-muted pb-vsp-xs mb-vsp-xs">
        System Requirements
      </h4>
      <Body>
        At least 4 GB of RAM and 2 GB of free disk space are recommended.
      </Body>
    </PatternBox>
  );
}

/* 3. Left accent bar */
function Heading03() {
  return (
    <PatternBox number={3} title="Left Accent Bar">
      <h2 className="text-heading font-bold border-l-4 border-accent pl-hsp-md mb-vsp-md">
        Architecture
      </h2>
      <Body>
        The system follows a layered architecture with clear separation of
        concerns.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg border-l-[3px] border-muted pl-hsp-md mb-vsp-sm">
        Data Layer
      </h3>
      <Body>
        All database operations are encapsulated in repository classes.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md border-l-2 border-muted pl-hsp-md mb-vsp-xs">
        Query Optimization
      </h4>
      <Body>
        Indexes are automatically created for frequently accessed columns.
      </Body>
    </PatternBox>
  );
}

/* 4. Underline gradient */
function Heading04() {
  return (
    <PatternBox number={4} title="Underline Gradient">
      <h2
        className="text-heading font-bold pb-vsp-xs mb-vsp-md"
        style={{
          borderBottom: "3px solid transparent",
          borderImage: "linear-gradient(to right, var(--zd-accent), transparent) 1",
        }}
      >
        Deployment
      </h2>
      <Body>
        The application can be deployed to any cloud provider that supports
        containers.
      </Body>
      <h3
        className="text-subheading font-semibold mt-vsp-lg pb-vsp-xs mb-vsp-sm"
        style={{
          borderBottom: "2px solid transparent",
          borderImage: "linear-gradient(to right, var(--zd-muted), transparent) 1",
        }}
      >
        CI/CD Pipeline
      </h3>
      <Body>
        Automated builds run on every push to the main branch.
      </Body>
      <h4
        className="text-body font-semibold mt-vsp-md pb-vsp-xs mb-vsp-xs"
        style={{
          borderBottom: "1px solid transparent",
          borderImage: "linear-gradient(to right, var(--zd-muted), transparent) 1",
        }}
      >
        Staging Environment
      </h4>
      <Body>
        Changes are validated in staging before being promoted to production.
      </Body>
    </PatternBox>
  );
}

/* 5. Background band */
function Heading05() {
  return (
    <PatternBox number={5} title="Background Band">
      <h2 className="text-heading font-bold bg-surface px-hsp-md py-vsp-xs rounded mb-vsp-md">
        Authentication
      </h2>
      <Body>
        User authentication is handled through JWT tokens with refresh
        capability.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg bg-surface/50 px-hsp-md py-vsp-xs rounded mb-vsp-sm">
        OAuth Providers
      </h3>
      <Body>
        Google, GitHub, and Microsoft are supported as identity providers.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md px-hsp-md py-vsp-xs mb-vsp-xs">
        Token Expiration
      </h4>
      <Body>
        Access tokens expire after 15 minutes; refresh tokens last 7 days.
      </Body>
    </PatternBox>
  );
}

/* 6. Numbered headings */
function Heading06() {
  return (
    <PatternBox number={6} title="Numbered Headings">
      <h2 className="text-heading font-bold mb-vsp-md">
        <span className="text-accent mr-hsp-sm">1.</span>
        Installation
      </h2>
      <Body>
        Install the package using your preferred package manager.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        <span className="text-muted mr-hsp-sm">1.1</span>
        Package Manager Setup
      </h3>
      <Body>
        We recommend pnpm for faster install times and disk efficiency.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        <span className="text-muted mr-hsp-sm">1.1.1</span>
        Global Installation
      </h4>
      <Body>
        Install pnpm globally with npm install -g pnpm if not already available.
      </Body>
    </PatternBox>
  );
}

/* 7. Uppercase h2 */
function Heading07() {
  return (
    <PatternBox number={7} title="Uppercase h2">
      <h2 className="text-heading font-bold uppercase tracking-[0.15em] mb-vsp-md">
        API Reference
      </h2>
      <Body>
        Complete reference documentation for all public API endpoints.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        Authentication Endpoints
      </h3>
      <Body>
        All endpoints require a valid Bearer token in the Authorization header.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        Rate Limiting
      </h4>
      <Body>
        API calls are limited to 100 requests per minute per API key.
      </Body>
    </PatternBox>
  );
}

/* 8. Monospace headings */
function Heading08() {
  return (
    <PatternBox number={8} title="Monospace Headings">
      <h2 className="text-heading font-bold font-mono mb-vsp-md">
        CLI Commands
      </h2>
      <Body>
        The CLI provides commands for scaffolding, building, and deploying.
      </Body>
      <h3 className="text-subheading font-semibold font-mono mt-vsp-lg mb-vsp-sm">
        build
      </h3>
      <Body>
        Compiles the project and outputs static files to the dist directory.
      </Body>
      <h4 className="text-body font-semibold font-mono mt-vsp-md mb-vsp-xs">
        --output-dir
      </h4>
      <Body>
        Specifies a custom output directory instead of the default dist folder.
      </Body>
    </PatternBox>
  );
}

/* 9. Thin rule above */
function Heading09() {
  return (
    <PatternBox number={9} title="Thin Rule Above">
      <h2 className="text-heading font-bold border-t border-muted pt-vsp-sm mb-vsp-md">
        Plugins
      </h2>
      <Body>
        Extend functionality through a rich ecosystem of community plugins.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg border-t border-muted pt-vsp-sm mb-vsp-sm">
        Official Plugins
      </h3>
      <Body>
        First-party plugins are maintained by the core team and receive
        priority updates.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md border-t border-muted pt-vsp-xs mb-vsp-xs">
        Community Plugins
      </h4>
      <Body>
        Browse community-contributed plugins in the official plugin registry.
      </Body>
    </PatternBox>
  );
}

/* 10. Hash prefix (markdown style) */
function Heading10() {
  return (
    <PatternBox number={10} title="Hash Prefix (Markdown Style)">
      <h2 className="text-heading font-bold mb-vsp-md">
        <span className="text-muted mr-hsp-sm font-normal">##</span>
        Routing
      </h2>
      <Body>
        File-based routing maps your directory structure to URL paths.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        <span className="text-muted mr-hsp-sm font-normal">###</span>
        Dynamic Routes
      </h3>
      <Body>
        Use bracket notation like [slug] to create dynamic route segments.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        <span className="text-muted mr-hsp-sm font-normal">####</span>
        Catch-All Routes
      </h4>
      <Body>
        Use [...slug] for routes that match multiple path segments.
      </Body>
    </PatternBox>
  );
}

/* 11. Dot separator */
function Heading11() {
  return (
    <PatternBox number={11} title="Dot Separator">
      <h2 className="text-heading font-bold mb-vsp-md">
        <span className="text-accent mr-hsp-sm">●</span>
        Theming
      </h2>
      <Body>
        Customize the look and feel by modifying the design token system.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        <span className="text-muted mr-hsp-sm">◉</span>
        Color Schemes
      </h3>
      <Body>
        Switch between built-in color schemes or create your own from scratch.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        <span className="text-muted mr-hsp-sm">○</span>
        Dark Mode
      </h4>
      <Body>
        Dark mode is the default and all tokens are designed for dark backgrounds.
      </Body>
    </PatternBox>
  );
}

/* 12. Accent text h2 */
function Heading12() {
  return (
    <PatternBox number={12} title="Accent Text h2">
      <h2 className="text-heading font-bold text-accent mb-vsp-md">
        Migration Guide
      </h2>
      <Body>
        Step-by-step instructions for upgrading from the previous major version.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg text-fg mb-vsp-sm">
        Breaking Changes
      </h3>
      <Body>
        Review the full list of breaking changes before starting the migration.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md text-muted mb-vsp-xs">
        Deprecated Features
      </h4>
      <Body>
        Deprecated APIs will continue to work but will be removed in the next
        release.
      </Body>
    </PatternBox>
  );
}

/* 13. Indented hierarchy */
function Heading13() {
  return (
    <PatternBox number={13} title="Indented Hierarchy">
      <h2 className="text-heading font-bold mb-vsp-md">
        Testing
      </h2>
      <Body>
        A comprehensive testing strategy ensures reliability across all modules.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg pl-hsp-xl mb-vsp-sm">
        Unit Tests
      </h3>
      <div className="pl-hsp-xl">
        <Body>
          Each module includes co-located unit tests using the Vitest framework.
        </Body>
      </div>
      <h4 className="text-body font-semibold mt-vsp-md pl-hsp-2xl mb-vsp-xs">
        Mocking Strategies
      </h4>
      <div className="pl-hsp-2xl">
        <Body>
          Use dependency injection rather than module mocks for better test
          isolation.
        </Body>
      </div>
    </PatternBox>
  );
}

/* 14. Size-only */
function Heading14() {
  return (
    <PatternBox number={14} title="Size Only (No Decorations)">
      <h2 className="text-heading font-bold mb-vsp-md">
        Performance
      </h2>
      <Body>
        The framework is optimized for fast initial load and minimal runtime
        overhead.
      </Body>
      <h3 className="text-subheading font-medium mt-vsp-lg mb-vsp-sm">
        Bundle Size
      </h3>
      <Body>
        Tree-shaking eliminates unused code, keeping the final bundle lean.
      </Body>
      <h4 className="text-body font-medium mt-vsp-md mb-vsp-xs">
        Lazy Loading
      </h4>
      <Body>
        Routes and heavy components are loaded on demand to reduce initial
        payload.
      </Body>
    </PatternBox>
  );
}

/* 15. Double line (top + bottom) */
function Heading15() {
  return (
    <PatternBox number={15} title="Double Line (Top + Bottom)">
      <h2 className="text-heading font-bold border-t-2 border-b-2 border-accent py-vsp-xs mb-vsp-md">
        Security
      </h2>
      <Body>
        Security best practices are enforced at the framework level by default.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg border-t border-b border-muted py-vsp-xs mb-vsp-sm">
        Input Validation
      </h3>
      <Body>
        All user input is validated and sanitized before processing.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md border-b border-muted pb-vsp-xs mb-vsp-xs">
        SQL Injection Prevention
      </h4>
      <Body>
        Parameterized queries are used exclusively to prevent injection attacks.
      </Body>
    </PatternBox>
  );
}

/* 16. Boxed h2 */
function Heading16() {
  return (
    <PatternBox number={16} title="Boxed h2">
      <h2 className="text-heading font-bold border-2 border-accent px-hsp-md py-vsp-xs rounded mb-vsp-md">
        Internationalization
      </h2>
      <Body>
        Built-in i18n support lets you serve content in multiple languages.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        Translation Files
      </h3>
      <Body>
        Translations are stored as JSON files organized by locale code.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        Pluralization Rules
      </h4>
      <Body>
        Complex pluralization is handled automatically based on the active locale.
      </Body>
    </PatternBox>
  );
}

/* 17. Bracket style */
function Heading17() {
  return (
    <PatternBox number={17} title="Bracket Style">
      <h2 className="text-heading font-bold mb-vsp-md">
        <span className="text-muted font-normal">[</span>
        {" "}Content Management{" "}
        <span className="text-muted font-normal">]</span>
      </h2>
      <Body>
        Content is authored in MDX and processed through the build pipeline.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        <span className="text-muted font-normal">[</span>
        {" "}Frontmatter{" "}
        <span className="text-muted font-normal">]</span>
      </h3>
      <Body>
        Each document requires a title field in its YAML frontmatter block.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        <span className="text-muted font-normal">[</span>
        {" "}Custom Fields{" "}
        <span className="text-muted font-normal">]</span>
      </h4>
      <Body>
        Add custom metadata fields by extending the content schema definition.
      </Body>
    </PatternBox>
  );
}

/* 18. Small caps h2 */
function Heading18() {
  return (
    <PatternBox number={18} title="Small Caps h2">
      <h2
        className="text-heading font-bold mb-vsp-md tracking-[0.1em]"
        style={{ fontVariant: "small-caps" }}
      >
        Middleware
      </h2>
      <Body>
        Middleware functions run before each request hits the route handler.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        Request Logging
      </h3>
      <Body>
        Every incoming request is logged with timestamp, method, and status.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        Custom Middleware
      </h4>
      <Body>
        Create custom middleware by exporting a function that receives the
        context object.
      </Body>
    </PatternBox>
  );
}

/* 19. Dashed borders */
function Heading19() {
  return (
    <PatternBox number={19} title="Dashed Borders">
      <h2 className="text-heading font-bold border-b-2 border-dashed border-accent pb-vsp-xs mb-vsp-md">
        Error Handling
      </h2>
      <Body>
        Centralized error handling catches and formats all unhandled exceptions.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg border-b border-dashed border-muted pb-vsp-xs mb-vsp-sm">
        Error Boundaries
      </h3>
      <Body>
        React error boundaries prevent a single component crash from taking down
        the page.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md border-b border-dotted border-muted pb-vsp-xs mb-vsp-xs">
        Fallback UI
      </h4>
      <Body>
        Custom fallback components are displayed when an error boundary triggers.
      </Body>
    </PatternBox>
  );
}

/* 20. Right-aligned decoration */
function Heading20() {
  return (
    <PatternBox number={20} title="Right-Aligned Decoration">
      <h2 className="text-heading font-bold mb-vsp-md flex items-center">
        <span>Caching</span>
        <span className="flex-1 h-px bg-muted mx-hsp-md" />
        <span className="text-caption text-muted font-normal">§</span>
      </h2>
      <Body>
        Built-in caching reduces redundant computation and speeds up responses.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm flex items-center">
        <span>In-Memory Cache</span>
        <span className="flex-1 h-px bg-muted mx-hsp-md" />
        <span className="text-caption text-muted font-normal">§</span>
      </h3>
      <Body>
        Frequently accessed data is kept in an LRU cache with configurable
        capacity.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs flex items-center">
        <span>Cache Invalidation</span>
        <span className="flex-1 h-px bg-muted mx-hsp-sm" />
      </h4>
      <Body>
        Cache entries are automatically invalidated when the underlying data
        changes.
      </Body>
    </PatternBox>
  );
}

/* 21. Badge prefix */
function Heading21() {
  return (
    <PatternBox number={21} title="Badge Prefix">
      <h2 className="text-heading font-bold mb-vsp-md flex items-center gap-hsp-sm">
        <span className="w-3 h-3 rounded-full bg-accent inline-block shrink-0" />
        Logging
      </h2>
      <Body>
        Structured logging is enabled by default with JSON output for
        production.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm flex items-center gap-hsp-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-muted inline-block shrink-0" />
        Log Levels
      </h3>
      <Body>
        Supported levels are debug, info, warn, error, and fatal.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs flex items-center gap-hsp-sm">
        <span className="w-2 h-2 rounded-full bg-muted inline-block shrink-0" />
        Log Rotation
      </h4>
      <Body>
        Log files are rotated daily and archived to prevent disk exhaustion.
      </Body>
    </PatternBox>
  );
}

/* 22. Background stripe */
function Heading22() {
  return (
    <PatternBox number={22} title="Background Stripe">
      <h2
        className="text-heading font-bold px-hsp-md py-vsp-xs mb-vsp-md rounded"
        style={{
          backgroundImage: `repeating-linear-gradient(
            135deg,
            var(--zd-surface),
            var(--zd-surface) 10px,
            transparent 10px,
            transparent 12px
          )`,
        }}
      >
        Event System
      </h2>
      <Body>
        A publish-subscribe event bus decouples modules and enables extensibility.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        Event Listeners
      </h3>
      <Body>
        Register listeners with typed event names for compile-time safety.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        Event Ordering
      </h4>
      <Body>
        Listeners execute in registration order unless a priority is specified.
      </Body>
    </PatternBox>
  );
}

/* 23. Icon prefix (§ / ¶) */
function Heading23() {
  return (
    <PatternBox number={23} title="Icon Prefix (§ / ¶)">
      <h2 className="text-heading font-bold mb-vsp-md">
        <span className="text-accent mr-hsp-sm">§</span>
        File Storage
      </h2>
      <Body>
        Files are stored in object storage with automatic CDN distribution.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        <span className="text-muted mr-hsp-sm">¶</span>
        Upload Limits
      </h3>
      <Body>
        Maximum file size is 50 MB per upload; batch uploads support up to 100
        files.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        <span className="text-muted mr-hsp-sm">›</span>
        Supported Formats
      </h4>
      <Body>
        PNG, JPG, WebP, SVG, PDF, and ZIP are accepted by default.
      </Body>
    </PatternBox>
  );
}

/* 24. Shadow text */
function Heading24() {
  return (
    <PatternBox number={24} title="Shadow Text">
      <h2
        className="text-heading font-bold mb-vsp-md"
        style={{ textShadow: "2px 2px 4px var(--zd-0)" }}
      >
        Notifications
      </h2>
      <Body>
        Real-time notifications keep users informed of important system events.
      </Body>
      <h3
        className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm"
        style={{ textShadow: "1px 1px 3px var(--zd-0)" }}
      >
        Email Notifications
      </h3>
      <Body>
        Transactional emails are sent through a configurable SMTP provider.
      </Body>
      <h4
        className="text-body font-semibold mt-vsp-md mb-vsp-xs"
        style={{ textShadow: "1px 1px 2px var(--zd-0)" }}
      >
        Notification Preferences
      </h4>
      <Body>
        Users can opt in or out of each notification category individually.
      </Body>
    </PatternBox>
  );
}

/* 25. Step numbers (circled) */
function Heading25() {
  return (
    <PatternBox number={25} title="Step Numbers (Circled)">
      <h2 className="text-heading font-bold mb-vsp-md flex items-center gap-hsp-md">
        <span className="w-8 h-8 rounded-full border-2 border-accent text-accent flex items-center justify-center text-body font-bold shrink-0">
          1
        </span>
        Project Setup
      </h2>
      <Body>
        Initialize the project with the scaffolding CLI to get a working
        template.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm flex items-center gap-hsp-sm">
        <span className="w-6 h-6 rounded-full border border-muted text-muted flex items-center justify-center text-small shrink-0">
          2
        </span>
        Install Dependencies
      </h3>
      <Body>
        Run pnpm install to fetch all required packages from the registry.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs flex items-center gap-hsp-sm">
        <span className="w-5 h-5 rounded-full border border-muted text-muted flex items-center justify-center text-caption shrink-0">
          3
        </span>
        Start Dev Server
      </h4>
      <Body>
        Launch the development server with pnpm dev and open localhost:4321.
      </Body>
    </PatternBox>
  );
}

/* 26. Gradient text */
function Heading26() {
  return (
    <PatternBox number={26} title="Gradient Text">
      <h2
        className="text-heading font-bold mb-vsp-md"
        style={{
          background: `linear-gradient(135deg, var(--zd-accent), var(--zd-5))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Data Modeling
      </h2>
      <Body>
        Define your data models with TypeScript interfaces and Zod schemas.
      </Body>
      <h3
        className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm"
        style={{
          background: `linear-gradient(135deg, var(--zd-fg), var(--zd-muted))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Schema Validation
      </h3>
      <Body>
        Schemas are validated at build time and runtime for maximum safety.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs text-muted">
        Type Inference
      </h4>
      <Body>
        TypeScript types are automatically inferred from Zod schemas.
      </Body>
    </PatternBox>
  );
}

/* 27. Two-tone (first word accent) */
function Heading27() {
  return (
    <PatternBox number={27} title="Two-Tone (First Word Accent)">
      <h2 className="text-heading font-bold mb-vsp-md">
        <span className="text-accent">Search</span>{" "}
        Integration
      </h2>
      <Body>
        Full-text search is powered by Pagefind with zero-config setup.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg mb-vsp-sm">
        <span className="text-accent">Index</span>{" "}
        Configuration
      </h3>
      <Body>
        Control which pages and content sections are included in the search
        index.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md mb-vsp-xs">
        <span className="text-accent">Filter</span>{" "}
        Options
      </h4>
      <Body>
        Users can filter search results by category, date, or content type.
      </Body>
    </PatternBox>
  );
}

/* 28. Border + background combo */
function Heading28() {
  return (
    <PatternBox number={28} title="Border + Background Combo">
      <h2 className="text-heading font-bold border-l-4 border-accent bg-surface px-hsp-md py-vsp-xs mb-vsp-md">
        Webhooks
      </h2>
      <Body>
        Configure outgoing webhooks to notify external systems of events.
      </Body>
      <h3 className="text-subheading font-semibold mt-vsp-lg border-l-[3px] border-muted bg-surface/50 px-hsp-md py-vsp-xs mb-vsp-sm">
        Payload Format
      </h3>
      <Body>
        Webhook payloads are sent as JSON with a consistent envelope structure.
      </Body>
      <h4 className="text-body font-semibold mt-vsp-md border-l-2 border-muted px-hsp-md py-vsp-xs mb-vsp-xs">
        Retry Logic
      </h4>
      <Body>
        Failed deliveries are retried up to three times with exponential backoff.
      </Body>
    </PatternBox>
  );
}

/* 29. Terminal style */
function Heading29() {
  return (
    <PatternBox number={29} title="Terminal Style">
      <h2 className="text-heading font-bold font-mono mb-vsp-md">
        <span className="text-accent mr-hsp-sm">&gt;</span>
        build_system
      </h2>
      <Body>
        The build system compiles, bundles, and optimizes assets for production.
      </Body>
      <h3 className="text-subheading font-semibold font-mono mt-vsp-lg mb-vsp-sm">
        <span className="text-muted mr-hsp-sm">$</span>
        watch_mode
      </h3>
      <Body>
        File changes trigger incremental rebuilds in under 100 milliseconds.
      </Body>
      <h4 className="text-body font-semibold font-mono mt-vsp-md mb-vsp-xs">
        <span className="text-muted mr-hsp-sm">#</span>
        source_maps
      </h4>
      <Body>
        Source maps are generated in development for accurate debugging.
      </Body>
    </PatternBox>
  );
}

/* 30. Minimal zen */
function Heading30() {
  return (
    <PatternBox number={30} title="Minimal Zen">
      <div className="py-vsp-md">
        <h2 className="text-heading font-bold mb-vsp-lg mt-vsp-lg">
          Accessibility
        </h2>
        <Body>
          Semantic HTML and ARIA attributes ensure the interface works for
          everyone.
        </Body>
        <h3 className="text-subheading font-medium mt-vsp-xl mb-vsp-md">
          Keyboard Navigation
        </h3>
        <Body>
          All interactive elements are reachable and operable via keyboard alone.
        </Body>
        <h4 className="text-body font-medium mt-vsp-lg mb-vsp-sm">
          Screen Reader Support
        </h4>
        <Body>
          Landmarks and live regions provide context for assistive technology
          users.
        </Body>
      </div>
    </PatternBox>
  );
}

/* ── Page Component ── */

export default function HeadersPage() {
  return (
    <div className="px-hsp-xl py-vsp-xl max-w-[960px] mx-auto">
      <h1 className="text-heading font-bold mb-vsp-xs">Heading Patterns</h1>
      <p className="text-muted mb-vsp-xl text-small">
        30 heading typography patterns (h2 / h3 / h4) for documentation content.
      </p>
      <div className="flex flex-col gap-vsp-xl">
        <Heading01 />
        <Heading02 />
        <Heading03 />
        <Heading04 />
        <Heading05 />
        <Heading06 />
        <Heading07 />
        <Heading08 />
        <Heading09 />
        <Heading10 />
        <Heading11 />
        <Heading12 />
        <Heading13 />
        <Heading14 />
        <Heading15 />
        <Heading16 />
        <Heading17 />
        <Heading18 />
        <Heading19 />
        <Heading20 />
        <Heading21 />
        <Heading22 />
        <Heading23 />
        <Heading24 />
        <Heading25 />
        <Heading26 />
        <Heading27 />
        <Heading28 />
        <Heading29 />
        <Heading30 />
      </div>
    </div>
  );
}
