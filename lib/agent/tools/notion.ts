import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../../db/client";
import { sha256 } from "../../utils/hash";
import {
  getConfiguredRootIds,
  getOutputsDbId,
  notionFetch,
  notionSearch,
  notionCreatePage,
  notionUpdatePage,
} from "../mcp/notion-client";
import type { ToolDef } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;

const listRootsSchema = z.object({});
export const listNotionRoots: ToolDef<typeof listRootsSchema> = {
  name: "list_notion_roots",
  description:
    "Return the configured Notion root page ids (the scope within which search_notion / read_notion_page operate).",
  schema: listRootsSchema,
  execute: () => ({ root_page_ids: getConfiguredRootIds(), outputs_db_id: getOutputsDbId() }),
};

const searchSchema = z.object({
  query: z.string().min(1),
  filter: z.record(z.unknown()).optional(),
});
export const searchNotion: ToolDef<typeof searchSchema> = {
  name: "search_notion",
  description:
    "Search the user's Notion workspace (scoped to configured root pages). Returns matching page references — use read_notion_page to fetch full content.",
  schema: searchSchema,
  execute: async (args) => {
    const roots = getConfiguredRootIds();
    if (roots.length === 0) throw new Error("No Notion root pages are configured. Run /setup first.");
    const raw = await notionSearch(args.query, args.filter);
    return { results: raw, scoped_to_roots: roots };
  },
};

const fetchSchema = z.object({ id: z.string().min(1) });
export const readNotionPage: ToolDef<typeof fetchSchema> = {
  name: "read_notion_page",
  description:
    "Fetch a Notion page (and its children) by id. Cached for 1 hour. Use to read PRDs, OKRs, meeting notes, or strategy docs.",
  schema: fetchSchema,
  execute: async (args) => {
    const cached = db()
      .prepare("SELECT title, markdown, fetched_at FROM notion_cache WHERE page_id = ?")
      .get(args.id) as { title: string; markdown: string; fetched_at: number } | undefined;
    if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
      return { id: args.id, title: cached.title, markdown: cached.markdown, cached: true };
    }
    const raw = await notionFetch(args.id);
    const { title, markdown } = extractTitleAndMarkdown(raw);
    db().prepare(
      `INSERT OR REPLACE INTO notion_cache (page_id, title, markdown, fetched_at) VALUES (?, ?, ?, ?)`,
    ).run(args.id, title, markdown, Date.now());
    return { id: args.id, title, markdown, cached: false };
  },
};

const saveSchema = z.object({
  title: z.string().min(1),
  markdown: z.string().min(1),
  type: z.enum(["Recommendation", "Analysis", "Summary", "Decision"]).optional(),
  tags: z.array(z.string()).optional(),
});
export const saveToNotion: ToolDef<typeof saveSchema> = {
  name: "save_to_notion",
  description:
    "Create a new page in the Product-Advisor Outputs database. Use to save a recommendation, summary, analysis, or decision memo. REQUIRES EXPLICIT USER CONFIRMATION — the UI will surface a confirmation card before this runs.",
  schema: saveSchema,
  requiresConfirmation: true,
  execute: async (args, ctx) => {
    const outputsDb = getOutputsDbId();
    if (!outputsDb) throw new Error("Outputs database not configured. Run /setup first.");
    const props: Record<string, unknown> = {
      Title: { title: [{ text: { content: args.title } }] },
      Type: args.type ? { select: { name: args.type } } : undefined,
      Tags: args.tags
        ? { multi_select: args.tags.map((t) => ({ name: t })) }
        : undefined,
      Date: { date: { start: new Date().toISOString().slice(0, 10) } },
      "Source Conversation": {
        rich_text: [{ text: { content: ctx.conversationId } }],
      },
    };
    const cleanProps = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
    const result = await notionCreatePage({
      parent: { database_id: outputsDb },
      properties: cleanProps,
      markdown: args.markdown,
    });
    logAudit("save_to_notion", outputsDb, args);
    return result;
  },
};

const appendSchema = z.object({
  id: z.string().min(1),
  markdown: z.string().min(1),
});
export const appendToNotionPage: ToolDef<typeof appendSchema> = {
  name: "append_to_notion_page",
  description:
    "Append markdown content to an existing Notion page (by id). Only use when the user explicitly names the page to append to. REQUIRES EXPLICIT USER CONFIRMATION.",
  schema: appendSchema,
  requiresConfirmation: true,
  execute: async (args) => {
    const result = await notionUpdatePage({ id: args.id, markdown_append: args.markdown });
    logAudit("append_to_notion_page", args.id, args);
    return result;
  },
};

const syncSchema = z.object({});
export const syncProfileToNotion: ToolDef<typeof syncSchema> = {
  name: "sync_profile_to_notion",
  description:
    "One-way mirror: snapshot the current Product Profile to a Notion page so the user can read it in Notion. Edits made in Notion are not pulled back. REQUIRES EXPLICIT USER CONFIRMATION.",
  schema: syncSchema,
  requiresConfirmation: true,
  execute: async () => {
    const profile = db()
      .prepare("SELECT * FROM product_profile WHERE id = 'default'")
      .get() as Record<string, string | number>;
    const roots = getConfiguredRootIds();
    if (roots.length === 0) throw new Error("No Notion roots configured.");
    const md = renderProfileMarkdown(profile);
    const result = await notionCreatePage({
      parent: { page_id: roots[0] },
      title: `Product Profile snapshot — ${new Date().toISOString().slice(0, 10)}`,
      markdown: md,
    });
    logAudit("sync_profile_to_notion", roots[0], { profile });
    return result;
  },
};

function renderProfileMarkdown(p: Record<string, string | number>): string {
  return `# Product Profile

**Name:** ${p.name || "(empty)"}
**One-liner:** ${p.one_liner || "(empty)"}

## Target users
${p.target_users || "(empty)"}

## Value proposition
${p.value_prop || "(empty)"}

## North star metric
${p.north_star_metric || "(empty)"}

## Current OKRs
${p.current_okrs || "(empty)"}

## Known constraints
${p.known_constraints || "(empty)"}

## Agent notes
${p.freeform_notes || "(empty)"}

_Snapshot at ${new Date().toISOString()}_
`;
}

function logAudit(tool: string, target: string, payload: unknown) {
  const json = JSON.stringify(payload);
  db().prepare(
    `INSERT INTO audit_log (id, tool, target, content_hash, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(nanoid(), tool, target, sha256(json), json, Date.now());
}

function extractTitleAndMarkdown(raw: unknown): { title: string; markdown: string } {
  // MCP results are heterogeneous; coerce defensively.
  if (typeof raw === "string") return { title: "", markdown: raw };
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const title = String(r.title || r.name || "");
    const markdown =
      typeof r.markdown === "string"
        ? r.markdown
        : typeof r.content === "string"
          ? r.content
          : JSON.stringify(raw, null, 2);
    return { title, markdown };
  }
  return { title: "", markdown: JSON.stringify(raw) };
}
