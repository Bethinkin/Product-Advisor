import { z } from "zod";
import {
  deleteMemory,
  getMemoryById,
  listMemories,
  searchMemories,
  writeMemory,
} from "../../memory/store";
import type { ToolDef } from "./types";

const listSchema = z.object({
  tag: z.string().optional(),
});
export const listMemoriesTool: ToolDef<typeof listSchema> = {
  name: "list_memories",
  description:
    "List all memory documents (titled markdown the advisor maintains across conversations — e.g. discovery notes, hypothesis logs, decision records). Returns id, slug, title, tags, updated_at. Cheap; call freely.",
  schema: listSchema,
  execute: (args) => {
    const docs = listMemories({ tag: args.tag }).map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      tags: d.tags,
      updated_at: d.updated_at,
      created_by: d.created_by,
      content_chars: d.content.length,
    }));
    return { memories: docs };
  },
};

const readSchema = z.object({
  id_or_slug: z.string().min(1),
});
export const readMemoryTool: ToolDef<typeof readSchema> = {
  name: "read_memory",
  description:
    "Fetch the full content of a memory document by id or slug. Returns title, content (markdown), tags, timestamps.",
  schema: readSchema,
  execute: (args) => {
    const doc = getMemoryById(args.id_or_slug);
    if (!doc) throw new Error(`Memory document ${args.id_or_slug} not found`);
    return doc;
  },
};

const searchSchema = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(20).optional(),
});
export const searchMemoriesTool: ToolDef<typeof searchSchema> = {
  name: "search_memories",
  description:
    "Full-text search (BM25) across memory document titles and content. Use to find prior notes/hypotheses/decisions relevant to the current question before duplicating work.",
  schema: searchSchema,
  execute: (args) => {
    const hits = searchMemories(args.query, args.k ?? 8);
    return { hits };
  },
};

const writeSchema = z.object({
  id_or_slug: z
    .string()
    .optional()
    .describe("Target an existing document by id or slug. Omit when creating a new one."),
  title: z
    .string()
    .optional()
    .describe("Required for mode='create'. Optional rename for replace/append."),
  content: z.string().describe("Markdown content. For 'append', this is appended to existing."),
  mode: z
    .enum(["create", "replace", "append"])
    .describe(
      "create = new document (title required); replace = overwrite existing; append = add to end of existing",
    ),
  tags: z.array(z.string()).optional(),
  slug: z
    .string()
    .optional()
    .describe("Custom slug for new documents; otherwise derived from title."),
  rationale: z
    .string()
    .min(1)
    .describe("One sentence: why this update, citing the source (meeting, user, prior memory)."),
});
export const writeMemoryTool: ToolDef<typeof writeSchema> = {
  name: "write_memory",
  description:
    "Create or update a memory document the advisor maintains across conversations. Use for: discovery notes, hypothesis logs, decision records, recurring themes, open questions. Each write is recorded in a revision audit log. Don't write the same content into both Product Profile and a memory document — Product Profile is for durable structured facts; memory docs are for narrative knowledge.",
  schema: writeSchema,
  execute: (args, ctx) => {
    const doc = writeMemory({
      id: args.id_or_slug,
      slug: args.slug,
      title: args.title,
      content: args.content,
      tags: args.tags,
      mode: args.mode,
      changed_by: "agent",
      message_id: ctx.messageId,
      rationale: args.rationale,
    });
    return {
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      mode: args.mode,
      content_chars: doc.content.length,
    };
  },
};

const deleteSchema = z.object({
  id_or_slug: z.string().min(1),
  rationale: z.string().min(1),
});
export const deleteMemoryTool: ToolDef<typeof deleteSchema> = {
  name: "delete_memory",
  description:
    "Delete a memory document. Irreversible (the final state is recorded in revisions, but the live row is gone). Only use when the user explicitly asks, or when the document is clearly obsolete and you've confirmed.",
  schema: deleteSchema,
  execute: (args) => deleteMemory(args.id_or_slug, "agent", args.rationale),
};
