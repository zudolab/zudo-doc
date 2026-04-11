---
name: zudo-doc-design-system
description: "Project-specific CSS and component rules for zudo-doc. Must be consulted before writing or editing CSS, Tailwind classes, color tokens, or component markup in this project. Covers: component-first strategy, design token system, three-tier color architecture, and palette index convention. Triggered by 'design system', 'zudo-doc-design-system', 'zudo-doc-css-wisdom' (old name)."
user-invocable: true
argument-hint: "[topic: tokens, colors, component-first, palette]"
---

# zudo-doc CSS & Component Rules

**IMPORTANT**: These rules are mandatory for all code changes in this project that touch CSS, Tailwind classes, color tokens, or component markup. Read the relevant section before making changes.

## How to Use

Based on the topic, read the specific reference doc:

| Topic | File |
|-------|------|
| Spacing, typography, layout tokens | `src/content/docs/reference/design-system.mdx` |
| Component-first methodology | `src/content/docs/reference/component-first.mdx` |
| Color tokens, palette, schemes | `src/content/docs/reference/color.mdx` |

Read ONLY the file relevant to your task. Apply its rules strictly.

## Quick Rules (always apply)

### Component First (no custom CSS classes)

- **NEVER** create CSS module files, custom class names, or separate stylesheets
- **ALWAYS** use Tailwind utility classes directly in component markup
- The component itself is the abstraction — `.card`, `.btn-primary` are forbidden
- Use props for variants, not CSS modifiers

### Design Tokens (no arbitrary values)

- **NEVER** use Tailwind default colors (`bg-gray-500`, `text-blue-600`) — they are reset to `initial`
- **NEVER** use arbitrary values (`text-[0.875rem]`, `p-[1.2rem]`) when a token exists
- **ALWAYS** use project tokens: `text-fg`, `bg-surface`, `border-muted`, `p-hsp-md`, `text-small`
- Spacing: `hsp-*` (horizontal), `vsp-*` (vertical) — see design-system.mdx for full list
- Typography: `text-caption`, `text-small`, `text-body`, `text-heading` etc.

### Color Tokens (three-tier system)

- **Tier 1** (palette): `p0`–`p15` — raw colors, use only when no semantic token fits
- **Tier 2** (semantic): `text-fg`, `bg-surface`, `border-muted`, `text-accent` — prefer these
- **NEVER** use hardcoded hex values in components
- Palette index convention (consistent across all themes):
  - p1=danger, p2=success, p3=warning, p4=info, p5=accent
  - p8=muted, p9=background, p10=surface, p11=text primary

### Astro vs React

- Default to **Astro components** (`.astro`) — zero JS, server-rendered
- Use **React islands** (`client:load`) only when client-side interactivity is needed
- Both follow the same utility-class approach
