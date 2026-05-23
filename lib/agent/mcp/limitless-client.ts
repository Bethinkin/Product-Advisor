import { getMcpClient } from "./client";

export async function getLimitlessClient() {
  const command = process.env.LIMITLESS_MCP_COMMAND;
  const env: Record<string, string> = {};
  if (process.env.LIMITLESS_API_KEY) env.LIMITLESS_API_KEY = process.env.LIMITLESS_API_KEY;
  return getMcpClient({ name: "limitless", command, env });
}

export async function searchLimitless(args: {
  query: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<unknown> {
  const client = await getLimitlessClient();
  if (!client) throw new Error("Limitless MCP is not configured");
  return client.callTool("searchLifelogsWithTranscripts", args);
}
