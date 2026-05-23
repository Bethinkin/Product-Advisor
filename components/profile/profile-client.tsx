"use client";

import { useEffect, useState } from "react";

interface Profile {
  name: string;
  one_liner: string;
  target_users: string;
  value_prop: string;
  north_star_metric: string;
  current_okrs: string;
  known_constraints: string;
  freeform_notes: string;
}

interface Revision {
  id: string;
  field: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  rationale: string;
  created_at: number;
}

const FIELDS: { key: keyof Profile; label: string; multiline?: boolean; placeholder?: string }[] = [
  { key: "name", label: "Product name", placeholder: "e.g. Acme Insights" },
  {
    key: "one_liner",
    label: "One-liner",
    placeholder: "e.g. The fastest way for B2B teams to ship usage-based pricing.",
  },
  {
    key: "target_users",
    label: "Target users",
    multiline: true,
    placeholder: "Who's it for? Roles, company stage, jobs-to-be-done.",
  },
  { key: "value_prop", label: "Value proposition", multiline: true },
  {
    key: "north_star_metric",
    label: "North Star metric",
    placeholder: "e.g. Weekly active teams completing >=1 meaningful action",
  },
  { key: "current_okrs", label: "Current OKRs", multiline: true, placeholder: "Markdown OK." },
  {
    key: "known_constraints",
    label: "Known constraints",
    multiline: true,
    placeholder: "Team size, runway, must-not-break commitments, regulatory limits, etc.",
  },
  {
    key: "freeform_notes",
    label: "Agent notes (durable memory)",
    multiline: true,
    placeholder: "The assistant writes here. Edits are allowed but not recommended.",
  },
];

export function ProfileClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const r = await fetch("/api/profile");
    const d = await r.json();
    setProfile(d.profile);
    setRevisions(d.revisions || []);
  }

  function update<K extends keyof Profile>(k: K, v: string) {
    if (!profile) return;
    setProfile({ ...profile, [k]: v });
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    const r = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (r.ok) setSavedAt(Date.now());
    setSaving(false);
    refresh();
  }

  if (!profile) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium uppercase text-muted-foreground mb-1">
              {f.label}
            </label>
            {f.multiline ? (
              <textarea
                value={profile[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={4}
                className="w-full rounded border px-3 py-2 text-sm bg-background font-mono"
              />
            ) : (
              <input
                type="text"
                value={profile[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded border px-3 py-2 text-sm bg-background"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedAt && <span className="text-xs text-muted-foreground">Saved</span>}
      </div>

      {revisions.length > 0 && (
        <div className="border-t pt-4">
          <h2 className="text-sm font-semibold mb-3">Revision history</h2>
          <ul className="space-y-2 text-xs">
            {revisions.map((r) => (
              <li key={r.id} className="border rounded px-3 py-2">
                <div className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{r.field}</span> changed by{" "}
                    <span className="text-muted-foreground">{r.changed_by}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {r.rationale && (
                  <div className="text-muted-foreground mt-1">— {r.rationale}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
