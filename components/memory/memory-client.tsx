"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils/cn";

interface MemoryDoc {
  id: string;
  slug: string;
  title: string;
  content: string;
  tags: string[];
  created_by: string;
  created_at: number;
  updated_at: number;
}

interface Revision {
  id: string;
  prev_content: string | null;
  next_content: string | null;
  changed_by: string;
  rationale: string | null;
  created_at: number;
}

export function MemoryClient() {
  const [docs, setDocs] = useState<MemoryDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<MemoryDoc | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editMode, setEditMode] = useState<"view" | "edit">("view");
  const [showHistory, setShowHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshList() {
    const r = await fetch("/api/memory");
    const d = await r.json();
    setDocs(d.memories || []);
  }

  async function loadDoc(id: string) {
    const r = await fetch(`/api/memory/${id}`);
    if (!r.ok) {
      setSelected(null);
      return;
    }
    const d = await r.json();
    setSelected(d.memory);
    setRevisions(d.revisions || []);
    setEditTitle(d.memory.title);
    setEditContent(d.memory.content);
    setEditTags(d.memory.tags.join(", "));
    setEditMode("view");
  }

  useEffect(() => {
    refreshList();
  }, []);

  useEffect(() => {
    if (selectedId) loadDoc(selectedId);
    else {
      setSelected(null);
      setRevisions([]);
    }
  }, [selectedId]);

  async function createDoc(title: string) {
    setError(null);
    const r = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: "" }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Failed");
      return;
    }
    setCreating(false);
    await refreshList();
    setSelectedId(d.memory.id);
  }

  async function save() {
    if (!selected) return;
    setError(null);
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const r = await fetch(`/api/memory/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, content: editContent, tags }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Failed");
      return;
    }
    await refreshList();
    await loadDoc(selected.id);
  }

  async function remove() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.title}"? Revisions are kept but the document is gone.`)) return;
    await fetch(`/api/memory/${selected.id}`, { method: "DELETE" });
    setSelectedId(null);
    refreshList();
  }

  return (
    <div className="flex gap-4 min-h-[60vh]">
      <aside className="w-72 border rounded flex flex-col">
        <div className="p-2 border-b">
          {creating ? (
            <CreateInline
              onCreate={createDoc}
              onCancel={() => setCreating(false)}
              error={error}
            />
          ) : (
            <button
              onClick={() => {
                setCreating(true);
                setError(null);
              }}
              className="w-full text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground"
            >
              + New document
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {docs.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No memory documents yet.</p>
          ) : (
            docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "w-full text-left px-3 py-2 border-b last:border-b-0 text-sm hover:bg-muted/40",
                  selectedId === d.id && "bg-muted/60",
                )}
              >
                <div className="font-medium truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{d.created_by === "agent" ? "agent" : "you"}</span>
                  <span>·</span>
                  <span>{new Date(d.updated_at).toLocaleDateString()}</span>
                  {d.tags.length > 0 && (
                    <span className="truncate">· {d.tags.join(", ")}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex-1 border rounded min-w-0">
        {!selected ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Select a document on the left, or create a new one.
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b flex items-center gap-2">
              {editMode === "edit" ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                />
              ) : (
                <h2 className="flex-1 font-semibold truncate">{selected.title}</h2>
              )}
              <span className="text-xs text-muted-foreground">
                /{selected.slug}
              </span>
              {editMode === "view" ? (
                <>
                  <button
                    onClick={() => setEditMode("edit")}
                    className="text-xs px-2 py-1 rounded hover:bg-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="text-xs px-2 py-1 rounded hover:bg-secondary"
                  >
                    {showHistory ? "Hide history" : "History"}
                  </button>
                  <button
                    onClick={remove}
                    className="text-xs px-2 py-1 rounded text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => loadDoc(selected.id)}
                    className="text-xs px-2 py-1 rounded hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
                  >
                    Save
                  </button>
                </>
              )}
            </div>

            {editMode === "edit" && (
              <div className="px-3 pt-2">
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Tags (comma-separated)"
                  className="w-full rounded border px-2 py-1 text-xs"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {editMode === "edit" ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="w-full h-full min-h-[400px] rounded border p-3 text-sm font-mono"
                  placeholder="Markdown…"
                />
              ) : selected.content ? (
                <div className="prose-tight text-sm">
                  <ReactMarkdown>{selected.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">(empty)</p>
              )}
            </div>

            {error && <div className="text-xs text-destructive px-3 py-2 border-t">{error}</div>}

            {showHistory && (
              <div className="border-t p-3 max-h-64 overflow-y-auto">
                <h3 className="text-xs font-semibold mb-2">Revision history ({revisions.length})</h3>
                <ul className="space-y-2 text-xs">
                  {revisions.map((r) => (
                    <li key={r.id} className="border rounded px-2 py-1.5">
                      <div className="flex justify-between">
                        <span>
                          <span className="font-medium">{r.changed_by}</span>
                          {r.rationale && <span className="text-muted-foreground"> — {r.rationale}</span>}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function CreateInline({
  onCreate,
  onCancel,
  error,
}: {
  onCreate: (title: string) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-2">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) onCreate(title.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Document title"
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <div className="flex justify-end gap-1 text-xs">
        <button
          onClick={onCancel}
          className="px-2 py-1 rounded hover:bg-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => title.trim() && onCreate(title.trim())}
          disabled={!title.trim()}
          className="px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
        >
          Create
        </button>
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
