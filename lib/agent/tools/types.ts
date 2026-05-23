import type { z } from "zod";

// Specific tool definitions keep their narrow schema types for execute() arg
// inference. The registry stores tools as AnyTool (schema type erased) so a
// heterogeneous array typechecks under Zod's invariant generics.
export interface ToolDef<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>, ctx: ToolContext) => Promise<unknown> | unknown;
  requiresConfirmation?: boolean;
}

export interface AnyTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute: (args: unknown, ctx: ToolContext) => Promise<unknown> | unknown;
  requiresConfirmation?: boolean;
}

export interface ToolContext {
  conversationId: string;
  messageId?: string;
}

export interface AnthropicToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
