import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { notionCreateDatabase, notionFetch } from "@/lib/agent/mcp/notion-client";

export const runtime = "nodejs";

export async function GET() {
  const rootsRow = db().prepare(`SELECT value FROM settings WHERE key = 'notion_root_page_ids'`).get() as
    | { value: string }
    | undefined;
  const outputsRow = db().prepare(`SELECT value FROM settings WHERE key = 'outputs_db_id'`).get() as
    | { value: string }
    | undefined;
  const roots: string[] = rootsRow ? safeParseArray(rootsRow.value) : [];
  return Response.json({
    notion_root_page_ids: roots,
    outputs_db_id: outputsRow?.value || null,
    mcp_status: {
      limitless: !!(process.env.LIMITLESS_MCP_COMMAND || process.env.LIMITLESS_MCP_URL),
      notion: !!(process.env.NOTION_MCP_COMMAND || process.env.NOTION_MCP_URL),
    },
  });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { notion_root_urls?: string[] };

  if (body.notion_root_urls) {
    const ids = body.notion_root_urls.map(extractPageId).filter(Boolean) as string[];
    if (ids.length === 0) return Response.json({ error: "No valid Notion URLs" }, { status: 400 });

    // Validate by fetching each
    const titles: { id: string; title: string }[] = [];
    for (const id of ids) {
      try {
        const result = (await notionFetch(id)) as { title?: string; name?: string };
        titles.push({ id, title: String(result?.title || result?.name || id) });
      } catch (err) {
        return Response.json(
          {
            error: `Could not fetch ${id}: ${err instanceof Error ? err.message : String(err)}`,
          },
          { status: 400 },
        );
      }
    }

    upsertSetting("notion_root_page_ids", JSON.stringify(ids));

    // Create outputs DB if not already present
    const existing = db()
      .prepare(`SELECT value FROM settings WHERE key = 'outputs_db_id'`)
      .get() as { value: string } | undefined;
    if (!existing) {
      try {
        const dbResult = (await notionCreateDatabase({
          parent: { page_id: ids[0] },
          title: "Product-Advisor Outputs",
          properties: {
            Title: { title: {} },
            Date: { date: {} },
            Type: {
              select: {
                options: [
                  { name: "Recommendation" },
                  { name: "Analysis" },
                  { name: "Summary" },
                  { name: "Decision" },
                ],
              },
            },
            Tags: { multi_select: { options: [] } },
            "Source Conversation": { rich_text: {} },
            Status: {
              select: {
                options: [{ name: "Draft" }, { name: "Reviewed" }],
              },
            },
          },
        })) as { id?: string };
        if (dbResult?.id) upsertSetting("outputs_db_id", dbResult.id);
      } catch (err) {
        // Surface but don't block — user may need to create the DB manually
        return Response.json({
          ok: true,
          roots: titles,
          outputs_db_warning: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return Response.json({ ok: true, roots: titles });
  }

  return Response.json({ ok: true });
}

function upsertSetting(key: string, value: string) {
  db().prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, value);
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function extractPageId(url: string): string | null {
  // Accept either a full Notion URL or a raw id
  const cleaned = url.trim();
  if (/^[0-9a-fA-F]{32}$/.test(cleaned.replace(/-/g, ""))) return cleaned;
  const m = /([0-9a-fA-F]{32})(?:\?|$|#)/.exec(cleaned.replace(/-/g, ""));
  if (m) return m[1];
  return null;
}
