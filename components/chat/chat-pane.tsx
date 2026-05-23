"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageList, type DisplayMessage } from "./message-list";
import { Composer } from "./composer";

interface Props {
  conversationId?: string;
}

export function ChatPane({ conversationId }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [override, setOverride] = useState<"default" | "deep">("default");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages) setMessages(rowsToDisplay(d.messages));
      });
  }, [conversationId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setStreaming(true);
    const userMsg: DisplayMessage = { id: `tmp-${Date.now()}`, role: "user", parts: [{ type: "text", text }] };
    const pending: DisplayMessage = { id: `tmp-a-${Date.now()}`, role: "assistant", parts: [] };
    setMessages((prev) => [...prev, userMsg, pending]);

    let activeConversationId = conversationId;
    let assistantParts: DisplayMessage["parts"] = [];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, override }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const evt of events) {
          const parsed = parseSse(evt);
          if (!parsed) continue;

          if (parsed.event === "meta") {
            const meta = JSON.parse(parsed.data) as { conversationId: string };
            activeConversationId = meta.conversationId;
            continue;
          }
          const data = JSON.parse(parsed.data);

          if (data.type === "text_delta" && data.text) {
            const lastText = lastTextPart(assistantParts);
            if (lastText) lastText.text += data.text;
            else assistantParts.push({ type: "text", text: data.text });
            updateLast({ ...pending, parts: [...assistantParts] });
          } else if (data.type === "tool_use_start") {
            assistantParts.push({
              type: "tool_use",
              id: data.id,
              name: data.name,
              input: data.input,
              status: "running",
            });
            updateLast({ ...pending, parts: [...assistantParts] });
          } else if (data.type === "tool_use_result") {
            const part = assistantParts.find(
              (p) => p.type === "tool_use" && p.id === data.id,
            );
            if (part && part.type === "tool_use") {
              part.status = data.error ? "error" : "done";
              part.result = data.result;
              part.error = data.error;
            }
            updateLast({ ...pending, parts: [...assistantParts] });
          } else if (data.type === "message_done") {
            // Reset for the next assistant turn within the same agent loop —
            // tool_use messages create a new logical assistant message.
            if (data.usage) {
              // No-op for now; could surface token usage in UI later.
            }
            // Start a fresh assistant bubble when more text follows.
            assistantParts = [];
            const fresh: DisplayMessage = { id: `tmp-a-${Date.now()}-${Math.random()}`, role: "assistant", parts: [] };
            setMessages((prev) => [...prev, fresh]);
          } else if (data.type === "error") {
            assistantParts.push({ type: "text", text: `\n\n_Error: ${data.message}_` });
            updateLast({ ...pending, parts: [...assistantParts] });
          }
        }
      }

      if (!conversationId && activeConversationId) {
        router.push(`/chat/${activeConversationId}`);
      } else {
        // Refresh the conversation list timestamps
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      assistantParts.push({
        type: "text",
        text: `\n\n_Network error: ${err instanceof Error ? err.message : String(err)}_`,
      });
      updateLast({ ...pending, parts: [...assistantParts] });
    } finally {
      setStreaming(false);
    }

    function updateLast(next: DisplayMessage) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = next;
        return copy;
      });
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !streaming ? <EmptyState /> : <MessageList messages={messages} />}
      </div>
      <Composer onSend={send} streaming={streaming} override={override} setOverride={setOverride} />
    </div>
  );
}

function lastTextPart(parts: DisplayMessage["parts"]) {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].type === "text") return parts[i] as { type: "text"; text: string };
  }
  return null;
}

interface RowMessage {
  id: string;
  role: string;
  content: unknown;
}

function rowsToDisplay(rows: RowMessage[]): DisplayMessage[] {
  const out: DisplayMessage[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      const content = row.content as { type: string; text?: string }[];
      const text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("\n");
      out.push({ id: row.id, role: "user", parts: [{ type: "text", text }] });
    } else if (row.role === "assistant") {
      const blocks = row.content as Array<Record<string, unknown>>;
      const parts: DisplayMessage["parts"] = [];
      for (const b of blocks) {
        if (b.type === "text") parts.push({ type: "text", text: String(b.text || "") });
        else if (b.type === "tool_use") {
          parts.push({
            type: "tool_use",
            id: String(b.id),
            name: String(b.name),
            input: b.input,
            status: "done",
          });
        }
      }
      out.push({ id: row.id, role: "assistant", parts });
    } else if (row.role === "tool_result") {
      // Attach results onto the most recent assistant message.
      const blocks = row.content as Array<{ tool_use_id: string; content: string; is_error?: boolean }>;
      const lastAssistant = [...out].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        for (const block of blocks) {
          const part = lastAssistant.parts.find(
            (p) => p.type === "tool_use" && p.id === block.tool_use_id,
          );
          if (part && part.type === "tool_use") {
            part.status = block.is_error ? "error" : "done";
            try {
              part.result = JSON.parse(block.content);
            } catch {
              part.result = block.content;
            }
          }
        }
      }
    }
  }
  return out;
}

function parseSse(raw: string): { event?: string; data: string } | null {
  const lines = raw.split("\n").filter(Boolean);
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const l of lines) {
    if (l.startsWith("event:")) event = l.slice(6).trim();
    else if (l.startsWith("data:")) dataLines.push(l.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

function EmptyState() {
  return (
    <div className="max-w-2xl mx-auto p-8 text-sm text-muted-foreground">
      <h2 className="text-lg font-semibold text-foreground mb-2">Start a new conversation</h2>
      <p className="mb-4">
        Ask the advisor for help on any product question. It will read your{" "}
        <a className="underline" href="/profile">
          Product Profile
        </a>
        ,{" "}
        <a className="underline" href="/artifacts">
          uploaded artifacts
        </a>
        , and (if configured) your Notion + Limitless data, then either ask clarifying questions or
        give a structured recommendation.
      </p>
      <p>Try:</p>
      <ul className="list-disc pl-5 mt-2 space-y-1">
        <li>&ldquo;Based on the recent customer interviews, where&apos;s the biggest activation risk?&rdquo;</li>
        <li>&ldquo;Critique our Q3 OKRs — are the KRs outcomes or ship dates?&rdquo;</li>
        <li>&ldquo;Help me decide: build self-serve onboarding now, or wait until enterprise SSO ships?&rdquo;</li>
      </ul>
    </div>
  );
}
