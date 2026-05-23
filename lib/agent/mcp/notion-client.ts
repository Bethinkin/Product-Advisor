import { db } from "../../db/client";
import { getMcpClient } from "./client";

export async function getNotionClient() {
  const command = process.env.NOTION_MCP_COMMAND;
  const env: Record<string, string> = {};
  if (process.env.NOTION_API_KEY) env.NOTION_API_KEY = process.env.NOTION_API_KEY;
  return getMcpClient({ name: "notion", command, env });
}

export function getConfiguredRootIds(): string[] {
  const row = db().prepare("SELECT value FROM settings WHERE key = 'notion_root_page_ids'").get() as
    | { value: string }
    | undefined;
  if (!row) return [];
  try {
    const v = JSON.parse(row.value);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function getOutputsDbId(): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = 'outputs_db_id'").get() as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export async function notionSearch(query: string, filter?: Record<string, unknown>): Promise<unknown> {
  const client = await getNotionClient();
  if (!client) throw new Error("Notion MCP is not configured");
  return client.callTool("notion-search", { query, ...(filter || {}) });
}

export async function notionFetch(id: string): Promise<unknown> {
  const client = await getNotionClient();
  if (!client) throw new Error("Notion MCP is not configured");
  return client.callTool("notion-fetch", { id });
}

export async function notionCreatePage(args: Record<string, unknown>): Promise<unknown> {
  const client = await getNotionClient();
  if (!client) throw new Error("Notion MCP is not configured");
  return client.callTool("notion-create-pages", args);
}

export async function notionUpdatePage(args: Record<string, unknown>): Promise<unknown> {
  const client = await getNotionClient();
  if (!client) throw new Error("Notion MCP is not configured");
  return client.callTool("notion-update-page", args);
}

export async function notionCreateDatabase(args: Record<string, unknown>): Promise<unknown> {
  const client = await getNotionClient();
  if (!client) throw new Error("Notion MCP is not configured");
  return client.callTool("notion-create-database", args);
}
