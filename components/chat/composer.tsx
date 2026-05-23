"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface Props {
  onSend: (text: string) => void;
  streaming: boolean;
  override: "default" | "deep";
  setOverride: (v: "default" | "deep") => void;
}

export function Composer({ onSend, streaming, override, setOverride }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="border-t bg-background">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask the advisor… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={submit}
            disabled={streaming || !value.trim()}
            className={cn(
              "rounded px-4 py-2 text-sm font-medium",
              streaming || !value.trim()
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:opacity-90",
            )}
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>Model:</span>
          <button
            type="button"
            onClick={() => setOverride("default")}
            className={cn(
              "rounded px-2 py-0.5",
              override === "default" ? "bg-secondary text-foreground" : "hover:text-foreground",
            )}
          >
            Sonnet (default)
          </button>
          <button
            type="button"
            onClick={() => setOverride("deep")}
            className={cn(
              "rounded px-2 py-0.5",
              override === "deep" ? "bg-secondary text-foreground" : "hover:text-foreground",
            )}
          >
            Opus (deep)
          </button>
        </div>
      </div>
    </div>
  );
}
