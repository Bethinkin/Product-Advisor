import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../../db/client";
import type { ToolDef } from "./types";

const PROFILE_FIELDS = [
  "name",
  "one_liner",
  "target_users",
  "value_prop",
  "north_star_metric",
  "current_okrs",
  "known_constraints",
  "freeform_notes",
] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];

const readSchema = z.object({});

export const readProductProfile: ToolDef<typeof readSchema> = {
  name: "read_product_profile",
  description:
    "Read the canonical Product Profile. The cached snapshot in the system prompt is usually fresh; call this if you suspect it's stale or want to verify.",
  schema: readSchema,
  execute: () => {
    const row = db()
      .prepare("SELECT * FROM product_profile WHERE id = 'default'")
      .get() as Record<string, unknown>;
    return { profile: row };
  },
};

const patchSchema = z.object({
  patches: z
    .array(
      z.object({
        field: z.enum(PROFILE_FIELDS),
        value: z.string(),
        mode: z.enum(["replace", "append"]),
      }),
    )
    .min(1),
  rationale: z.string().min(1).describe("One sentence: why this update, citing the source if possible."),
});

export const updateProductProfile: ToolDef<typeof patchSchema> = {
  name: "update_product_profile",
  description:
    "Persist durable facts about the product into the Product Profile. Use whenever the user reveals a fact worth remembering across conversations (NSM, target users, constraints, decisions). Include a one-sentence rationale citing where the fact came from.",
  schema: patchSchema,
  execute: (args, ctx) => {
    const current = db()
      .prepare("SELECT * FROM product_profile WHERE id = 'default'")
      .get() as Record<ProfileField, string>;

    const updates: Partial<Record<ProfileField, string>> = {};
    const revisions: { field: ProfileField; old: string; next: string }[] = [];
    for (const p of args.patches) {
      const old = String(current[p.field] || "");
      const next = p.mode === "append" && old ? `${old}\n${p.value}` : p.value;
      updates[p.field] = next;
      revisions.push({ field: p.field, old, next });
    }

    const now = Date.now();
    const setClause = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(", ");
    const values = Object.values(updates);
    db().prepare(`UPDATE product_profile SET ${setClause}, updated_at = ? WHERE id = 'default'`).run(
      ...values,
      now,
    );

    const insertRev = db().prepare(
      `INSERT INTO profile_revisions (id, field, old_value, new_value, changed_by, message_id, rationale, created_at)
       VALUES (?, ?, ?, ?, 'agent', ?, ?, ?)`,
    );
    for (const r of revisions) {
      insertRev.run(nanoid(), r.field, r.old, r.next, ctx.messageId || null, args.rationale, now);
    }

    const after = db()
      .prepare("SELECT * FROM product_profile WHERE id = 'default'")
      .get() as Record<string, unknown>;
    return { updated_fields: Object.keys(updates), profile_after: after };
  },
};
