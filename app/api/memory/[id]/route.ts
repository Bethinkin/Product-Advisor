import { NextRequest } from "next/server";
import {
  deleteMemory,
  getMemoryById,
  listRevisions,
  writeMemory,
} from "@/lib/memory/store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const doc = getMemoryById(id);
  if (!doc) return new Response("Not found", { status: 404 });
  const revisions = listRevisions(doc.id);
  return Response.json({ memory: doc, revisions });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    title?: string;
    content?: string;
    tags?: string[];
    rationale?: string;
  };
  try {
    const doc = writeMemory({
      id,
      title: body.title,
      content: body.content,
      tags: body.tags,
      mode: "replace",
      changed_by: "user",
      rationale: body.rationale ?? "Manual edit",
    });
    return Response.json({ memory: doc });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const result = deleteMemory(id, "user", "Manual delete");
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 },
    );
  }
}
