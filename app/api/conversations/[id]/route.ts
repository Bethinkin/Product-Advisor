import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const convo = db().prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
  if (!convo) return new Response("Not found", { status: 404 });
  const messages = db()
    .prepare(
      `SELECT id, role, content, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, created_at
       FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    )
    .all(id) as Record<string, unknown>[];
  return Response.json({
    conversation: convo,
    messages: messages.map((m) => ({ ...m, content: JSON.parse(String(m.content)) })),
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  db().prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
  return Response.json({ ok: true });
}
