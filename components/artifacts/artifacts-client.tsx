"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface Artifact {
  id: string;
  kind: string;
  source: string;
  original_filename: string | null;
  title: string;
  description: string;
  metadata_json: string;
  byte_size: number;
  created_at: number;
}

export function ArtifactsClient() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");

  async function refresh() {
    const r = await fetch("/api/artifacts");
    const d = await r.json();
    setArtifacts(d.artifacts || []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/artifacts", { method: "POST", body: form });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(`Upload failed (${file.name}): ${d.error || r.statusText}`);
      }
    }
    setUploading(false);
    refresh();
  }

  async function submitPaste() {
    if (!pasteText.trim()) return;
    setUploading(true);
    setError(null);
    const r = await fetch("/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText, title: pasteTitle || "Pasted text" }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(`Paste failed: ${d.error || r.statusText}`);
    } else {
      setPasteText("");
      setPasteTitle("");
      setPasteOpen(false);
    }
    setUploading(false);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this artifact?")) return;
    await fetch(`/api/artifacts/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center",
          uploading ? "opacity-50" : "hover:bg-muted/30",
        )}
      >
        <p className="text-sm">
          Drop files here, or{" "}
          <label className="underline cursor-pointer">
            choose files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
          </label>
          .
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports .txt, .md, .docx, .pdf, .vtt, .csv
        </p>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          or paste text instead
        </button>
      </div>

      {pasteOpen && (
        <div className="border rounded p-4 space-y-2">
          <input
            type="text"
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded border px-3 py-1.5 text-sm bg-background"
          />
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            placeholder="Paste transcript or notes…"
            className="w-full rounded border px-3 py-2 text-sm bg-background font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPasteOpen(false)}
              className="text-sm px-3 py-1.5 rounded hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={submitPaste}
              disabled={uploading || !pasteText.trim()}
              className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-right px-3 py-2">Size</th>
              <th className="text-left px-3 py-2">Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {artifacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No artifacts yet.
                </td>
              </tr>
            )}
            {artifacts.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{a.title}</div>
                  {a.description && (
                    <div className="text-xs text-muted-foreground">{a.description}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs uppercase">{a.kind}</td>
                <td className="px-3 py-2 text-xs">{a.source}</td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                  {formatBytes(a.byte_size)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => remove(a.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
