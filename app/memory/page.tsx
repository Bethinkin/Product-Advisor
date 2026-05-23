import { MemoryClient } from "@/components/memory/memory-client";

export default function MemoryPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-1">Memory documents</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Titled markdown documents the advisor maintains across conversations — discovery notes,
          hypothesis logs, decision records, recurring themes, open questions. Both you and the
          agent can write here; every change is recorded in a revision log.
        </p>
        <MemoryClient />
      </div>
    </div>
  );
}
