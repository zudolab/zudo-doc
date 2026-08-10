/**
 * The MCP tool surface: definitions, input validation and the mapping from
 * `client.ts`'s `ApiError` onto structured tool errors.
 *
 * Every handler is a plain async function of `(args) -> CallToolResult`, kept
 * independent of `McpServer` so a test can call one directly without standing
 * up a transport. `index.ts` is the only file that touches `McpServer`; it
 * just loops `createTools(client)` into `registerTool`.
 *
 * Nothing here ever throws past its own handler — every branch that can fail
 * (a bad response from the API, an unreachable server) is caught and turned
 * into a tool result with `isError: true`, per the design rule that parsers
 * never throw on server errors.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { AUTHORING_GUIDE } from "./authoring-guide";
import {
  ApiError,
  type OutlineCommand,
  type ProjectSnapshot,
  type ZudoDocOnlineClient,
} from "./client";

// ------------------------------------------------------------- tool result

function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(payload: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

/**
 * The one place an `ApiError` becomes a tool result. `revision-mismatch` gets
 * its own `stale-revision` code and `latestRevision` (epic #3333's contract);
 * every other server error code is surfaced verbatim so an agent can act on
 * it (`page-not-found`, `slug-conflict`, ...) without a second lookup table.
 */
function toToolError(error: unknown): CallToolResult {
  if (error instanceof ApiError) {
    if (error.code === "revision-mismatch") {
      return errorResult({
        code: "stale-revision",
        message:
          "The project changed since this revision was read. Call get_project or " +
          "outline_overview to re-read the current state, then retry with its revision.",
        latestRevision: error.snapshot?.revision,
      });
    }
    return errorResult({ code: error.code, message: error.message });
  }
  return errorResult({
    code: "unexpected-error",
    message: error instanceof Error ? error.message : String(error),
  });
}

// --------------------------------------------------------- outline overview

/**
 * Renders a compact human-readable tree: categories, slugs, page titles and
 * draft markers. This is the orientation call — an agent reads this instead
 * of the full JSON snapshot when it only needs the shape of the project.
 */
export function renderOutlineOverview(snapshot: ProjectSnapshot): string {
  const pageById = new Map(snapshot.pages.map((page) => [page.id, page]));
  const lines: string[] = [
    `${snapshot.title} (revision ${snapshot.revision}) [project: ${snapshot.slug}]`,
  ];

  if (snapshot.outline.categories.length === 0) {
    lines.push("", "(no categories yet)");
    return lines.join("\n");
  }

  for (const category of snapshot.outline.categories) {
    lines.push("", `${category.title} [category: ${category.id} / ${category.slug}]`);
    if (category.pages.length === 0) {
      lines.push("  (no pages)");
      continue;
    }
    for (const ref of category.pages) {
      const page = pageById.get(ref.id);
      const title = page?.title ?? ref.slug;
      const draftMark = page?.draft ? " (draft)" : "";
      lines.push(`  - ${title} [page: ${ref.id} / ${ref.slug}]${draftMark}`);
    }
  }

  return lines.join("\n");
}

// --------------------------------------------------------- outline commands

const addCategoryCommandSchema = z.object({
  type: z.literal("add-category"),
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
});

const renameCategoryCommandSchema = z.object({
  type: z.literal("rename-category"),
  categoryId: z.string().min(1),
  title: z.string().min(1),
});

const removeCategoryCommandSchema = z.object({
  type: z.literal("remove-category"),
  categoryId: z.string().min(1),
});

const moveCategoryCommandSchema = z.object({
  type: z.literal("move-category"),
  categoryId: z.string().min(1),
  toIndex: z.number().int().nonnegative(),
});

const addPageCommandSchema = z.object({
  type: z.literal("add-page"),
  categoryId: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  pageId: z.string().min(1).optional(),
});

const setPageSlugCommandSchema = z.object({
  type: z.literal("set-page-slug"),
  pageId: z.string().min(1),
  slug: z.string().min(1),
});

const removePageCommandSchema = z.object({
  type: z.literal("remove-page"),
  pageId: z.string().min(1),
});

const movePageCommandSchema = z.object({
  type: z.literal("move-page"),
  pageId: z.string().min(1),
  toCategoryId: z.string().min(1),
  toIndex: z.number().int().nonnegative(),
});

const reorderPagesCommandSchema = z.object({
  type: z.literal("reorder-pages"),
  categoryId: z.string().min(1),
  orderedPageIds: z.array(z.string().min(1)),
});

/**
 * `doc` is deliberately unchecked here (`z.unknown()`): the server's
 * `applyCommand` already re-validates a `replace-doc` payload field by field
 * (`validateOutlineDoc`) and reports a precise `invalid-doc` failure. A second
 * shape check here could only drift from that one.
 */
const replaceDocCommandSchema = z.object({
  type: z.literal("replace-doc"),
  doc: z.unknown(),
});

const outlineCommandSchema = z.discriminatedUnion("type", [
  addCategoryCommandSchema,
  renameCategoryCommandSchema,
  removeCategoryCommandSchema,
  moveCategoryCommandSchema,
  addPageCommandSchema,
  setPageSlugCommandSchema,
  removePageCommandSchema,
  movePageCommandSchema,
  reorderPagesCommandSchema,
  replaceDocCommandSchema,
]);

const OUTLINE_COMMAND_DESCRIPTION = `Applies one outline command to a project's structure (categories and page \
placement — never content; page content is write_page's job). Every call \
must carry the project's current "expectedRevision"; a stale one produces a \
"stale-revision" tool error with "latestRevision" — re-read via get_project \
or outline_overview and retry with that revision. There is no rename-page \
command: a page's title lives in its frontmatter, set with write_page.

Command shapes ("command.type"):
- add-category: { type: "add-category", title, slug? }
  e.g. { type: "add-category", title: "Guides" }
- rename-category: { type: "rename-category", categoryId, title }
- remove-category: { type: "remove-category", categoryId } (also removes its pages)
- move-category: { type: "move-category", categoryId, toIndex }
- add-page: { type: "add-page", categoryId, title, slug?, pageId? }
  e.g. { type: "add-page", categoryId: "category-1", title: "Deploying" }
  The result's "createdPage" gives the new page's id — write its body next with write_page.
- set-page-slug: { type: "set-page-slug", pageId, slug }
- remove-page: { type: "remove-page", pageId }
- move-page: { type: "move-page", pageId, toCategoryId, toIndex } (works across categories)
  e.g. { type: "move-page", pageId: "page-2", toCategoryId: "category-2", toIndex: 0 }
- reorder-pages: { type: "reorder-pages", categoryId, orderedPageIds }
  "orderedPageIds" must list every page of that category exactly once.
- replace-doc: { type: "replace-doc", doc } — wholesale structure replacement;
  "doc" must match the shape of get_project's "outline" field. Validated and
  normalized server-side.`;

// ------------------------------------------------------------- frontmatter

const pageFrontmatterInputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    draft: z.boolean().optional(),
  })
  .strict();

// ------------------------------------------------------------- tool registry

export type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

/**
 * A raw input shape, typed against zod's classic `ZodType` (which carries
 * `.safeParse` etc.) rather than the package's own `z.ZodRawShape` alias —
 * that alias points at zod v4's core `$ZodType` for MCP-SDK interop and loses
 * those instance methods in its declared type, even though the schemas it
 * wraps still have them at runtime.
 */
type ToolInputShape = Record<string, z.ZodType>;

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: ToolInputShape;
  handler: ToolHandler;
}

/**
 * Pairs a handler with the exact input shape it was written against, then
 * widens both into `ToolDefinition` for storage in one heterogeneous array.
 * The cast is safe by construction — `defineTool` is the only place a
 * `ToolDefinition` is built, so `inputSchema` and `handler` always agree.
 */
function defineTool<Shape extends ToolInputShape>(
  name: string,
  config: { title: string; description: string; inputSchema: Shape },
  handler: (args: { [K in keyof Shape]: z.infer<Shape[K]> }) => Promise<CallToolResult>,
): ToolDefinition {
  return {
    name,
    title: config.title,
    description: config.description,
    inputSchema: config.inputSchema,
    handler: handler as ToolHandler,
  };
}

export function createTools(client: ZudoDocOnlineClient): ToolDefinition[] {
  return [
    defineTool(
      "list_projects",
      {
        title: "List projects",
        description:
          "Lists every project this zudo-doc online server knows about, with its " +
          "current revision. Start here when the target project's slug is not yet known.",
        inputSchema: {},
      },
      async () => {
        try {
          return jsonResult(await client.listProjects());
        } catch (error) {
          return toToolError(error);
        }
      },
    ),

    defineTool(
      "create_project",
      {
        title: "Create project",
        description:
          "Creates a new documentation base with one seeded category and page, and " +
          "returns its full snapshot (revision starts at 1). Use the snapshot's page id " +
          "to write real content with write_page next.",
        inputSchema: { title: z.string().min(1).max(200) },
      },
      async (args) => {
        try {
          return jsonResult(await client.createProject(args.title));
        } catch (error) {
          return toToolError(error);
        }
      },
    ),

    defineTool(
      "get_project",
      {
        title: "Get project",
        description:
          "Returns a project's full snapshot: outline (categories, pages), each page's " +
          "title/description/draft flag, and the current revision. Use this revision as " +
          "expectedRevision for the next mutation. For a shorter, human-readable view, use " +
          "outline_overview instead.",
        inputSchema: { project: z.string().min(1) },
      },
      async (args) => {
        try {
          return jsonResult(await client.getProject(args.project));
        } catch (error) {
          return toToolError(error);
        }
      },
    ),

    defineTool(
      "outline_overview",
      {
        title: "Outline overview",
        description:
          "Returns a compact, human-readable tree of a project's structure: category " +
          "titles and slugs, each page's title/slug/id and draft marker. This is the " +
          "orientation call — read this before restructuring or writing pages. For the " +
          "full JSON snapshot (needed for expectedRevision), use get_project.",
        inputSchema: { project: z.string().min(1) },
      },
      async (args) => {
        try {
          const snapshot = await client.getProject(args.project);
          return textResult(renderOutlineOverview(snapshot));
        } catch (error) {
          return toToolError(error);
        }
      },
    ),

    defineTool(
      "apply_outline_command",
      {
        title: "Apply outline command",
        description: OUTLINE_COMMAND_DESCRIPTION,
        inputSchema: {
          project: z.string().min(1),
          expectedRevision: z.number().int().nonnegative(),
          command: outlineCommandSchema,
        },
      },
      async (args) => {
        try {
          const outcome = await client.applyOutlineCommand(args.project, {
            expectedRevision: args.expectedRevision,
            command: args.command as OutlineCommand,
          });
          return jsonResult({
            revision: outcome.revision,
            changed: outcome.changed,
            selectedId: outcome.selectedId,
            ...(outcome.createdPage ? { createdPage: outcome.createdPage } : {}),
          });
        } catch (error) {
          return toToolError(error);
        }
      },
    ),

    defineTool(
      "get_page",
      {
        title: "Get page",
        description:
          "Reads one page's frontmatter (title, description, draft) and markdown body, " +
          "plus any authoring-lint warnings the current body already has.",
        inputSchema: { project: z.string().min(1), pageId: z.string().min(1) },
      },
      async (args) => {
        try {
          return jsonResult(await client.getPage(args.project, args.pageId));
        } catch (error) {
          return toToolError(error);
        }
      },
    ),

    defineTool(
      "write_page",
      {
        title: "Write page",
        description:
          'Writes a page\'s frontmatter and/or markdown body. Omit "frontmatter" or ' +
          '"markdown" to leave that half untouched. Requires the page\'s current ' +
          '"expectedRevision" (from get_project/get_page); a stale one produces a ' +
          '"stale-revision" error. The result\'s "warnings" list zudo-doc content ' +
          "conventions the body breaks (see authoring_guide) — the write still lands; " +
          "warnings are advice, not a rejection.",
        inputSchema: {
          project: z.string().min(1),
          pageId: z.string().min(1),
          expectedRevision: z.number().int().nonnegative(),
          frontmatter: pageFrontmatterInputSchema.optional(),
          markdown: z.string().optional(),
        },
      },
      async (args) => {
        try {
          const outcome = await client.writePage(args.project, args.pageId, {
            expectedRevision: args.expectedRevision,
            ...(args.frontmatter !== undefined ? { frontmatter: args.frontmatter } : {}),
            ...(args.markdown !== undefined ? { markdown: args.markdown } : {}),
          });
          return jsonResult({
            id: outcome.id,
            slug: outcome.slug,
            revision: outcome.revision,
            changed: outcome.changed,
            warnings: outcome.warnings,
          });
        } catch (error) {
          return toToolError(error);
        }
      },
    ),

    defineTool(
      "authoring_guide",
      {
        title: "Authoring guide",
        description:
          "Returns the zudo-doc content-authoring guide as markdown: the frontmatter " +
          "contract, heading rules, admonition syntax, and slug conventions. Read this " +
          "once before writing pages.",
        inputSchema: {},
      },
      async () => textResult(AUTHORING_GUIDE),
    ),
  ];
}
