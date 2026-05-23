import { NextRequest } from "next/server";
import { listMemories, writeMemory } from "@/lib/memory/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag") || undefined;
  const docs = listMemories({ tag });
  return Response.json({ memories: docs });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    title: string;
    content?: string;
    tags?: string[];
    slug?: string;
  };
  if (!body.title?.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }
  try {
    const doc = writeMemory({
      title: body.title,
      content: body.content ?? "",
      tags: body.tags,
      slug: body.slug,
      mode: "create",
      changed_by: "user",
      rationale: "Manual create",
    });
    return Response.json({ memory: doc });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
