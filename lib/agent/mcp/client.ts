import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpClientHandle {
  client: Client;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  listTools: () => Promise<{ name: string; description?: string }[]>;
  close: () => Promise<void>;
}

interface Cached {
  handle: McpClientHandle;
  key: string;
}

const cache = new Map<string, Cached>();

export async function getMcpClient(opts: {
  name: string;
  command?: string;
  env?: Record<string, string>;
}): Promise<McpClientHandle | null> {
  if (!opts.command) return null;
  const key = `${opts.name}:${opts.command}:${JSON.stringify(opts.env || {})}`;
  const hit = cache.get(opts.name);
  if (hit && hit.key === key) return hit.handle;
  if (hit) await hit.handle.close();

  const [cmd, ...args] = opts.command.split(/\s+/);
  const transport = new StdioClientTransport({
    command: cmd,
    args,
    env: { ...process.env, ...(opts.env || {}) } as Record<string, string>,
  });

  const client = new Client(
    { name: `product-advisor-${opts.name}`, version: "0.1.0" },
    { capabilities: {} },
  );
  await client.connect(transport);

  const handle: McpClientHandle = {
    client,
    callTool: async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      return result;
    },
    listTools: async () => {
      const result = await client.listTools();
      return result.tools.map((t) => ({ name: t.name, description: t.description }));
    },
    close: async () => {
      await client.close();
      cache.delete(opts.name);
    },
  };

  cache.set(opts.name, { handle, key });
  return handle;
}

export async function closeAllMcp(): Promise<void> {
  for (const c of cache.values()) await c.handle.close();
  cache.clear();
}
