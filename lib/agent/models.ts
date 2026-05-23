export const MODELS = {
  default: "claude-sonnet-4-6",
  deep: "claude-opus-4-7",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

// V1: explicit user toggle (override) or simple cue-based routing.
// Auto-router stays conservative: only escalate when the user explicitly asks
// for a recommendation/strategy/decision — never speculatively.
export function selectModel(opts: {
  override?: "default" | "deep";
  lastUserMessage?: string;
}): ModelName {
  if (opts.override === "deep") return MODELS.deep;
  if (opts.override === "default") return MODELS.default;
  const m = (opts.lastUserMessage || "").toLowerCase();
  if (/\b(give me the recommendation|strategy memo|decide between|make the call|write the memo|deep dive)\b/.test(m)) {
    return MODELS.deep;
  }
  return MODELS.default;
}
