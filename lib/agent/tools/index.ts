import { zodToJsonSchema } from "./zod-to-json";
import type { AnthropicToolSpec, AnyTool } from "./types";
import { listArtifacts } from "./list-artifacts";
import { searchTranscriptsTool } from "./search-transcripts";
import { readArtifact } from "./read-artifact";
import { queryData } from "./query-data";
import { readProductProfile, updateProductProfile } from "./profile";
import { searchLimitlessTool } from "./limitless";
import {
  listNotionRoots,
  searchNotion,
  readNotionPage,
  saveToNotion,
  appendToNotionPage,
  syncProfileToNotion,
} from "./notion";
import { saveRecommendation } from "./save-recommendation";

// Erase the invariant schema generic so heterogeneous tools live in one array.
export const ALL_TOOLS: AnyTool[] = ([
  listArtifacts,
  searchTranscriptsTool,
  readArtifact,
  queryData,
  readProductProfile,
  updateProductProfile,
  searchLimitlessTool,
  listNotionRoots,
  searchNotion,
  readNotionPage,
  saveToNotion,
  appendToNotionPage,
  syncProfileToNotion,
  saveRecommendation,
] as unknown[]) as AnyTool[];

const NOTION_TOOL_NAMES = new Set([
  "list_notion_roots",
  "search_notion",
  "read_notion_page",
  "save_to_notion",
  "append_to_notion_page",
  "sync_profile_to_notion",
]);

// Filter tools based on which integrations are configured.
export function availableTools(): AnyTool[] {
  const hasLimitless = !!(process.env.LIMITLESS_MCP_COMMAND || process.env.LIMITLESS_MCP_URL);
  const hasNotion = !!(process.env.NOTION_MCP_COMMAND || process.env.NOTION_MCP_URL);
  return ALL_TOOLS.filter((t) => {
    if (t.name === "search_limitless") return hasLimitless;
    if (NOTION_TOOL_NAMES.has(t.name)) return hasNotion;
    return true;
  });
}

export function toolByName(name: string): AnyTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

export function toAnthropicTools(tools: AnyTool[]): AnthropicToolSpec[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.schema),
  }));
}
