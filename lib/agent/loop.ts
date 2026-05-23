import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import { buildSystemBlocks } from "./system-prompt";
import { selectModel, type ModelName } from "./models";
import { availableTools, toAnthropicTools, toolByName } from "./tools";
import type { ToolDef } from "./tools/types";

const MAX_TOOL_ITERATIONS = 12;
const MAX_TOKENS = 4096;

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string; input: unknown }
  | { type: "tool_use_result"; id: string; name: string; result: unknown; error?: string }
  | { type: "message_done"; messageId: string; usage: UsageRow }
  | { type: "done" }
  | { type: "error"; message: string };

interface UsageRow {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export interface RunOpts {
  conversationId: string;
  userMessage: string;
  override?: "default" | "deep";
  emit: (event: StreamEvent) => void;
}

export async function runAgentTurn(opts: RunOpts): Promise<void> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = availableTools();
  const toolSpecs = toAnthropicTools(tools);
  const model: ModelName = selectModel({
    override: opts.override,
    lastUserMessage: opts.userMessage,
  });

  // Persist user message
  const userMessageId = nanoid();
  const now = Date.now();
  db().prepare(
    `INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?, ?, 'user', ?, NULL, ?)`,
  ).run(
    userMessageId,
    opts.conversationId,
    JSON.stringify([{ type: "text", text: opts.userMessage }]),
    now,
  );
  db().prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, opts.conversationId);

  // Build full message history for this conversation (in Anthropic format)
  const history = loadHistory(opts.conversationId);
  // history already includes the new user message we just persisted.

  const system = buildSystemBlocks().blocks;
  // Mark the last tool spec as cached together with system + tools by adding
  // cache_control via the tools array's final element. Anthropic SDK accepts
  // this via _request_options or by attaching directly when supported.
  const cachedToolSpecs = toolSpecs.map((t, i) =>
    i === toolSpecs.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t,
  );

  let iterations = 0;
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const usage: UsageRow = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    };

    const assistantBlocks: Anthropic.ContentBlock[] = [];
    const stream = anthropic.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system,
      tools: cachedToolSpecs as unknown as Anthropic.Tool[],
      messages: history as unknown as Anthropic.MessageParam[],
    });

    stream.on("text", (delta) => {
      opts.emit({ type: "text_delta", text: delta });
    });

    const final = await stream.finalMessage();
    for (const block of final.content) assistantBlocks.push(block);

    if (final.usage) {
      usage.input_tokens = final.usage.input_tokens ?? 0;
      usage.output_tokens = final.usage.output_tokens ?? 0;
      usage.cache_read_tokens = (final.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;
      usage.cache_creation_tokens = (final.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
    }

    // Persist assistant message
    const assistantId = nanoid();
    db().prepare(
      `INSERT INTO messages (id, conversation_id, role, content, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      assistantId,
      opts.conversationId,
      JSON.stringify(assistantBlocks),
      model,
      usage.input_tokens,
      usage.output_tokens,
      usage.cache_read_tokens,
      usage.cache_creation_tokens,
      Date.now(),
    );
    opts.emit({ type: "message_done", messageId: assistantId, usage });

    history.push({ role: "assistant", content: assistantBlocks });

    if (final.stop_reason !== "tool_use") {
      break;
    }

    // Execute tool calls
    const toolUses = assistantBlocks.filter((b) => b.type === "tool_use") as Extract<
      Anthropic.ContentBlock,
      { type: "tool_use" }
    >[];
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      const tool = toolByName(tu.name);
      let resultPayload: unknown;
      let isError = false;

      if (!tool) {
        resultPayload = { error: `Unknown tool: ${tu.name}` };
        isError = true;
      } else {
        opts.emit({ type: "tool_use_start", id: tu.id, name: tu.name, input: tu.input });
        try {
          const parsed = tool.schema.safeParse(tu.input);
          if (!parsed.success) {
            resultPayload = { error: `Invalid tool input: ${parsed.error.message}` };
            isError = true;
          } else {
            resultPayload = await tool.execute(parsed.data, {
              conversationId: opts.conversationId,
              messageId: assistantId,
            });
          }
        } catch (err) {
          isError = true;
          resultPayload = { error: err instanceof Error ? err.message : String(err) };
        }
        opts.emit({
          type: "tool_use_result",
          id: tu.id,
          name: tu.name,
          result: resultPayload,
          error: isError ? String((resultPayload as { error?: string }).error) : undefined,
        });
      }

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(resultPayload),
        is_error: isError || undefined,
      });
    }

    // Persist tool results as a single tool_result-bearing user message
    const toolResultMsgId = nanoid();
    db().prepare(
      `INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?, ?, 'tool_result', ?, NULL, ?)`,
    ).run(toolResultMsgId, opts.conversationId, JSON.stringify(toolResultBlocks), Date.now());

    history.push({ role: "user", content: toolResultBlocks });
  }

  opts.emit({ type: "done" });
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: unknown;
}

function loadHistory(conversationId: string): HistoryMessage[] {
  const rows = db()
    .prepare(
      `SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    )
    .all(conversationId) as { role: string; content: string }[];

  return rows.map((r) => {
    const parsed = JSON.parse(r.content);
    if (r.role === "assistant") return { role: "assistant", content: parsed };
    // 'user' (typed text) or 'tool_result' (list of tool_result blocks) both
    // become role:user in Anthropic's API.
    return { role: "user", content: parsed };
  });
}
