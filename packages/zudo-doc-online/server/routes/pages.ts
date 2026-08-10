/**
 * Page read/write routes — the content half of the API.
 *
 * A write returns `warnings[]` from the authoring lint. They describe zudo-doc
 * conventions the body breaks and never block the write: an agent mid-edit
 * needs its draft saved, and the advice is more useful attached to the saved
 * state than as a rejection.
 */

import { Hono } from "hono";
import { z } from "zod";

import type { AppDeps } from "../app";
import { lintMarkdown } from "../authoring-lint";
import { assertPageId, assertProjectSlug } from "../store/file-store";
import { pageFrontmatterSchema } from "../store/frontmatter";
import { badRequest, readJsonBody } from "./projects";

/** Matches the app-wide body limit; a page far past this is not hand-authored. */
const MAX_MARKDOWN_CHARS = 1_000_000;

const pageWriteSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  /** Omitted means "leave the stored frontmatter alone". */
  frontmatter: pageFrontmatterSchema.optional(),
  /** Omitted means "leave the stored body alone". */
  markdown: z.string().max(MAX_MARKDOWN_CHARS).optional(),
  clientId: z.string().min(1).max(128).optional(),
});

export function createPageRoutes(deps: AppDeps): Hono {
  const routes = new Hono();

  routes.get("/:project/pages/:pageId", async (c) => {
    const slug = c.req.param("project");
    const pageId = c.req.param("pageId");
    assertProjectSlug(slug);
    assertPageId(pageId);

    const page = await deps.store.readPage(slug, pageId);
    return c.json({
      id: page.id,
      slug: page.slug,
      categoryId: page.categoryId,
      revision: page.revision,
      frontmatter: page.frontmatter,
      markdown: page.markdown,
      warnings: lintMarkdown(page.markdown),
    });
  });

  routes.put("/:project/pages/:pageId", async (c) => {
    const slug = c.req.param("project");
    const pageId = c.req.param("pageId");
    assertProjectSlug(slug);
    assertPageId(pageId);

    const parsed = pageWriteSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) throw badRequest(parsed.error);

    const outcome = await deps.store.writePage(slug, pageId, {
      expectedRevision: parsed.data.expectedRevision,
      ...(parsed.data.frontmatter ? { frontmatter: parsed.data.frontmatter } : {}),
      ...(parsed.data.markdown !== undefined ? { markdown: parsed.data.markdown } : {}),
    });

    if (outcome.changed) {
      deps.events.publish(slug, {
        type: "page-changed",
        pageId,
        revision: outcome.page.revision,
        ...(parsed.data.clientId ? { origin: parsed.data.clientId } : {}),
      });
    }

    return c.json({
      id: outcome.page.id,
      slug: outcome.page.slug,
      categoryId: outcome.page.categoryId,
      revision: outcome.page.revision,
      changed: outcome.changed,
      frontmatter: outcome.page.frontmatter,
      markdown: outcome.page.markdown,
      warnings: lintMarkdown(outcome.page.markdown),
    });
  });

  return routes;
}
