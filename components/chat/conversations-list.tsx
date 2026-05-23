"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface Conversation {
  id: string;
  title: string;
  updated_at: number;
  message_count: number;
}

export function ConversationsList({ activeId }: { activeId?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations || []));
  }, [activeId]);

  return (
    <aside className="w-64 border-r flex flex-col bg-muted/30">
      <div className="p-3 border-b">
        <Link
          href="/chat"
          className="block text-center px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          + New conversation
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-4">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className={cn(
              "block px-3 py-2 mx-2 my-0.5 rounded text-sm",
              activeId === c.id
                ? "bg-background border"
                : "hover:bg-background/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="truncate font-medium text-foreground">{c.title || "Untitled"}</div>
            <div className="text-xs text-muted-foreground">
              {c.message_count} msg · {timeAgo(c.updated_at)}
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
  return `${Math.floor(d / 86400_000)}d ago`;
}
