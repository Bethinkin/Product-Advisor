import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";
import { runAgentTurn, type StreamEvent } from "@/lib/agent/loop";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ChatPayload {
  conversationId?: string;
  message: string;
  override?: "default" | "deep";
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatPayload;
  let conversationId = body.conversationId;

  if (!conversationId) {
    conversationId = nanoid();
    const now = Date.now();
    db().prepare(
      `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(conversationId, deriveTitle(body.message), now, now);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Always emit the conversationId first so the client can route subsequent requests.
      emit({ type: "text_delta", text: "" });
      controller.enqueue(
        encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversationId })}\n\n`),
      );

      try {
        await runAgentTurn({
          conversationId: conversationId!,
          userMessage: body.message,
          override: body.override,
          emit,
        });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function deriveTitle(message: string): string {
  return message.trim().slice(0, 60) || "New conversation";
}
