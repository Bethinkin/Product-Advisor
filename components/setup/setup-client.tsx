"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface SetupState {
  notion_root_page_ids: string[];
  outputs_db_id: string | null;
  mcp_status: { limitless: boolean; notion: boolean };
}

export function SetupClient() {
  const [state, setState] = useState<SetupState | null>(null);
  const [urlsText, setUrlsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const r = await fetch("/api/setup");
    const d = (await r.json()) as SetupState;
    setState(d);
    if (d.notion_root_page_ids?.length) {
      setUrlsText(d.notion_root_page_ids.join("\n"));
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const urls = urlsText.split(/\s+/).filter(Boolean);
    const r = await fetch("/api/setup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_root_urls: urls }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Failed to save");
    } else {
      setMessage("Saved");
      if (d.outputs_db_warning) setError(`Outputs DB not auto-created: ${d.outputs_db_warning}`);
    }
    setSaving(false);
    refresh();
  }

  if (!state) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold mb-2">Integration status</h2>
        <ul className="text-sm space-y-1">
          <li className="flex items-center gap-2">
            <Dot ok={state.mcp_status.limitless} />
            Limitless MCP —{" "}
            {state.mcp_status.limitless
              ? "configured (LIMITLESS_MCP_COMMAND / URL set)"
              : "not configured — set LIMITLESS_MCP_COMMAND in .env"}
          </li>
          <li className="flex items-center gap-2">
            <Dot ok={state.mcp_status.notion} />
            Notion MCP —{" "}
            {state.mcp_status.notion
              ? "configured (NOTION_MCP_COMMAND / URL set)"
              : "not configured — set NOTION_MCP_COMMAND in .env"}
          </li>
        </ul>
      </section>

      {state.mcp_status.notion && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Notion scope</h2>
          <p className="text-sm text-muted-foreground">
            Paste 1–5 Notion page URLs (or 32-char page ids) — one per line. These define the scope
            within which <code>search_notion</code> and <code>read_notion_page</code> operate. The
            first root will host the &quot;Product-Advisor Outputs&quot; database created on save.
          </p>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={5}
            placeholder="https://www.notion.so/your-workspace/Strategy-abc123..."
            className="w-full rounded border px-3 py-2 text-sm bg-background font-mono"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & validate"}
            </button>
            {message && <span className="text-xs text-emerald-600">{message}</span>}
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
          {state.outputs_db_id && (
            <p className="text-xs text-muted-foreground">
              Outputs database id: <code>{state.outputs_db_id}</code>
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2">Environment variables</h2>
        <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">
{`ANTHROPIC_API_KEY=...
LIMITLESS_MCP_COMMAND=...   # e.g. npx -y @limitless/mcp-server
LIMITLESS_API_KEY=...
NOTION_MCP_COMMAND=...
NOTION_API_KEY=...
DATABASE_PATH=./data/product-advisor.db`}
        </pre>
      </section>
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        ok ? "bg-emerald-500" : "bg-muted-foreground/50",
      )}
    />
  );
}
