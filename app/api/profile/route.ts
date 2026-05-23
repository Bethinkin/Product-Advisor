import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

const FIELDS = [
  "name",
  "one_liner",
  "target_users",
  "value_prop",
  "north_star_metric",
  "current_okrs",
  "known_constraints",
  "freeform_notes",
] as const;

export async function GET() {
  const profile = db().prepare(`SELECT * FROM product_profile WHERE id = 'default'`).get();
  const revisions = db()
    .prepare(`SELECT * FROM profile_revisions ORDER BY created_at DESC LIMIT 50`)
    .all();
  return Response.json({ profile, revisions });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Record<string, string>;
  const current = db()
    .prepare(`SELECT * FROM product_profile WHERE id = 'default'`)
    .get() as Record<string, string>;

  const updates: Record<string, string> = {};
  for (const f of FIELDS) {
    if (typeof body[f] === "string" && body[f] !== current[f]) {
      updates[f] = body[f];
    }
  }
  if (Object.keys(updates).length === 0) return Response.json({ ok: true, unchanged: true });

  const now = Date.now();
  const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  db().prepare(
    `UPDATE product_profile SET ${setClause}, updated_at = ? WHERE id = 'default'`,
  ).run(...Object.values(updates), now);

  const insertRev = db().prepare(
    `INSERT INTO profile_revisions (id, field, old_value, new_value, changed_by, rationale, created_at) VALUES (?, ?, ?, ?, 'user', ?, ?)`,
  );
  for (const [field, value] of Object.entries(updates)) {
    insertRev.run(nanoid(), field, current[field], value, "Manual edit", now);
  }
  return Response.json({ ok: true, updated_fields: Object.keys(updates) });
}
