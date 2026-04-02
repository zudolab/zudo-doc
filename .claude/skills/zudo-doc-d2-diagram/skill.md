---
name: d2-diagram
description: Generate well-styled D2 diagrams following zudo-doc conventions. Use when creating architecture, flow, or system diagrams in D2 language.
trigger: auto
match:
  - d2 diagram
  - d2 chart
  - create d2
  - make d2
  - generate d2
  - draw d2
  - architecture diagram
  - system diagram
---

# D2 Diagram Generation Rules

Follow these conventions when generating D2 diagrams for zudo-doc projects.

## Layout and Rendering Defaults

- **Layout engine**: `elk` (default, hierarchical layout)
- **Padding**: 20px
- **Theme**: 0 (light), 200 (dark) — automatically injected by zudo-doc's theme system
- **Supported layouts**: `elk`, `dagre` only (WASM-compatible). Do NOT use `tala`.

## Styling Guidelines

### Keep Diagrams Focused

- One concept per diagram — split complex systems into multiple diagrams
- Maximum 8-12 nodes per diagram for readability
- Use `direction: right` for horizontal flows, default for vertical

### Use D2 Classes for Consistency

Define reusable style classes at the top of the diagram:

```d2
classes: {
  service: {
    style.border-radius: 8
    style.stroke-width: 2
  }
  database: {
    style.border-radius: 4
    style.stroke-width: 2
    shape: cylinder
  }
  external: {
    style.stroke-dash: 3
    style.border-radius: 8
  }
}
```

### Shapes for Different Node Types

- **Services/components**: rectangle (default) with `border-radius: 8`
- **Databases**: `shape: cylinder`
- **Queues**: `shape: queue`
- **Users/actors**: `shape: person`
- **External services**: dashed stroke (`style.stroke-dash: 3`)
- **Decisions**: `shape: diamond`
- **Containers/groups**: nested objects with labels

### Connection Styles

- **Normal flow**: default solid arrow
- **Async/event**: `style.stroke-dash: 3` (dashed)
- **Important path**: `style.stroke-width: 3`
- **Bidirectional**: `<->` syntax

### When to Use Explicit Colors

- **Most diagrams**: Let the theme system handle colors (no explicit `style.fill`/`style.stroke`)
- **Add explicit colors ONLY when**:
  - Differentiating specific components (e.g., red for deprecated, green for new)
  - Highlighting a specific path or component
  - Creating a legend-based color scheme
- When using explicit colors, prefer the project's palette colors

### Container Best Practices

- Avoid more than 2 levels of nesting — it makes text too small
- Use containers for logical grouping only (e.g., "Frontend", "Backend", "Data Layer")
- Use `fill-pattern: dots` for background containers that shouldn't draw focus

## Code Block Format

Write D2 in fenced code blocks:

````md
```d2

direction: right

web -> api: REST
api -> db: SQL

```
````

### Per-Block Attributes (astro-d2 build mode)

Available attributes after `d2` language identifier:

```
```d2 layout=elk pad=20 width=720 sketch
```

- `layout`: `elk` or `dagre`
- `pad`: padding in pixels
- `width`: max width
- `sketch`: hand-drawn style
- `title`: diagram title
- `theme`: override theme (0-303)
- `darkTheme`: override dark theme

## Do NOT

- Use `tala` layout (not available in WASM)
- Create diagrams with more than 15 nodes
- Nest containers more than 2 levels deep
- Use CSS custom properties in `style.*` values (D2 doesn't support them)
- Add `vars { d2-config { ... } }` blocks — zudo-doc injects these automatically
- Use `fill` on connections (shape-only property)
- Use `animated` on shapes (connection-only property)

## Example: Architecture Diagram

```d2

direction: right

classes: {
  service: {
    style.border-radius: 8
    style.stroke-width: 2
  }
  store: {
    shape: cylinder
    style.stroke-width: 2
  }
}

client: Browser {
  shape: person
}

api: API Gateway {
  class: service
}

auth: Auth Service {
  class: service
}

db: PostgreSQL {
  class: store
}

cache: Redis {
  class: store
}

client -> api: HTTPS
api -> auth: Validate token
api -> db: Queries
api -> cache: Cache lookups {
  style.stroke-dash: 3
}

```
