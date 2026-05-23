"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface Props {
  name: string;
  input: unknown;
  status: "running" | "done" | "error";
  result?: unknown;
  error?: string;
}

const TOOL_LABELS: Record<string, string> = {
  list_artifacts: "Listed artifacts",
  search_transcripts: "Searched transcripts",
  read_artifact: "Read artifact",
  query_data: "Ran SQL query",
  read_product_profile: "Read product profile",
  update_product_profile: "Updated product profile",
  search_limitless: "Searched Limitless lifelogs",
  list_notion_roots: "Listed Notion roots",
  search_notion: "Searched Notion",
  read_notion_page: "Read Notion page",
  save_to_notion: "Saved to Notion",
  append_to_notion_page: "Appended to Notion page",
  sync_profile_to_notion: "Synced profile to Notion",
  save_recommendation: "Saved recommendation",
};

export function ToolCallCard({ name, input, status, result, error }: Props) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[name] || name;
  const summary = summarize(name, input, result);

  return (
    <div
      className={cn(
        "border rounded text-xs bg-muted/40",
        status === "error" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 flex items-center gap-2"
      >
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            status === "running" && "bg-amber-500 animate-pulse",
            status === "done" && "bg-emerald-500",
            status === "error" && "bg-destructive",
          )}
        />
        <span className="font-medium">{label}</span>
        {summary && <span className="text-muted-foreground truncate">— {summary}</span>}
        <span className="ml-auto text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <Pre title="Input" value={input} />
          {error ? <Pre title="Error" value={error} /> : <Pre title="Result" value={result} />}
        </div>
      )}
    </div>
  );
}

function Pre({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground mb-1">{title}</div>
      <pre className="bg-background border rounded p-2 overflow-x-auto text-[11px]">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function summarize(name: string, input: unknown, result: unknown): string {
  if (!input || typeof input !== "object") return "";
  const i = input as Record<string, unknown>;
  if (name === "search_transcripts" || name === "search_notion" || name === "search_limitless") {
    const hits =
      result && typeof result === "object"
        ? (result as { hits?: unknown[]; results?: unknown[] }).hits ||
          (result as { results?: unknown[] }).results
        : undefined;
    const count = Array.isArray(hits) ? hits.length : undefined;
    return `“${i.query}”${count !== undefined ? ` — ${count} hit${count === 1 ? "" : "s"}` : ""}`;
  }
  if (name === "query_data") {
    const r = result as { row_count?: number } | undefined;
    return `${i.sql ? String(i.sql).slice(0, 60) : ""}${r?.row_count !== undefined ? ` → ${r.row_count} rows` : ""}`;
  }
  if (name === "read_artifact") return `id=${i.artifact_id}`;
  if (name === "read_notion_page") return `id=${i.id}`;
  if (name === "update_product_profile") {
    const patches = i.patches as { field: string }[] | undefined;
    return patches ? patches.map((p) => p.field).join(", ") : "";
  }
  if (name === "save_to_notion") return `“${i.title}”`;
  return "";
}
