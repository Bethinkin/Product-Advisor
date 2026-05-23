import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET() {
  const rows = db()
    .prepare(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
       FROM conversations c ORDER BY c.updated_at DESC LIMIT 200`,
    )
    .all();
  return Response.json({ conversations: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as { title?: string }));
  const id = nanoid();
  const now = Date.now();
  db().prepare(
    `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
  ).run(id, body.title || "New conversation", now, now);
  return Response.json({ id });
}
