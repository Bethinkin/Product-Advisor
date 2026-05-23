"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils/cn";
import { ToolCallCard } from "./tool-call-card";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  parts: DisplayPart[];
}

export type DisplayPart =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
      status: "running" | "done" | "error";
      result?: unknown;
      error?: string;
    };

export function MessageList({ messages }: { messages: DisplayMessage[] }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} />
      ))}
    </div>
  );
}

function Bubble({ message }: { message: DisplayMessage }) {
  if (message.role === "user") {
    const text = message.parts.find((p) => p.type === "text");
    return (
      <div className="flex justify-end">
        <div className="rounded-lg px-3 py-2 max-w-[80%] bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
          {text && text.type === "text" ? text.text : ""}
        </div>
      </div>
    );
  }

  if (message.parts.length === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
        Thinking…
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 text-sm")}>
      {message.parts.map((p, i) => {
        if (p.type === "text") {
          return (
            <div key={i} className="prose-tight max-w-none">
              <ReactMarkdown>{p.text}</ReactMarkdown>
            </div>
          );
        }
        return (
          <ToolCallCard
            key={i}
            name={p.name}
            input={p.input}
            status={p.status}
            result={p.result}
            error={p.error}
          />
        );
      })}
    </div>
  );
}
