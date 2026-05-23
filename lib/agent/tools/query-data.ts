import { z } from "zod";
import { readOnlyDb } from "../../db/client";
import type { ToolDef } from "./types";

const schema = z.object({
  sql: z.string().min(1).describe("A SELECT statement. Only SELECT is allowed. No ATTACH, PRAGMA, INSERT, etc."),
  max_rows: z.number().int().min(1).max(2000).optional(),
});

export const queryData: ToolDef<typeof schema> = {
  name: "query_data",
  description:
    "Run a read-only SQL SELECT against uploaded CSV tables. Table names and column schemas are listed in the session context. Use this for any quantitative claim about the user's data — don't speculate.",
  schema,
  execute: (args) => {
    const sql = args.sql.trim();
    if (!isAllowed(sql)) {
      throw new Error(
        "Only single SELECT statements are allowed. No PRAGMA, ATTACH, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, or REPLACE.",
      );
    }
    const maxRows = args.max_rows ?? 200;

    const stmt = readOnlyDb().prepare(sql);
    stmt.raw(true);
    const rowsRaw = stmt.all() as unknown[][];
    const columns = stmt.columns().map((c) => c.name);
    const truncated = rowsRaw.length > maxRows;
    const rows = rowsRaw.slice(0, maxRows);
    return { columns, rows, row_count: rows.length, truncated };
  },
};

function isAllowed(sql: string): boolean {
  const lower = sql.toLowerCase();
  // Must start with select or with (CTE)
  if (!/^(select\b|with\b)/.test(lower)) return false;
  // Disallow dangerous tokens anywhere
  const forbidden = [
    "insert ",
    "update ",
    "delete ",
    "drop ",
    "alter ",
    "create ",
    "replace ",
    "attach ",
    "detach ",
    "pragma ",
    "vacuum",
    "reindex",
  ];
  for (const f of forbidden) {
    if (lower.includes(f)) return false;
  }
  // No multiple statements
  if (sql.split(";").filter((s) => s.trim()).length > 1) return false;
  return true;
}
