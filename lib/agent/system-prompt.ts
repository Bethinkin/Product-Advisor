import fs from "node:fs";
import path from "node:path";
import { db } from "../db/client";

let cachedFrameworks: string | null = null;
function loadFrameworks(): string {
  if (cachedFrameworks) return cachedFrameworks;
  const p = path.join(process.cwd(), "lib/knowledge/frameworks.md");
  cachedFrameworks = fs.readFileSync(p, "utf-8");
  return cachedFrameworks;
}

export interface SystemBlocks {
  // Each block is an Anthropic content block. Caching is applied to A and B.
  blocks: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[];
}

export function buildSystemBlocks(): SystemBlocks {
  const blockA = buildBlockA();
  const blockB = buildBlockB();
  const blockC = buildBlockC();
  return {
    blocks: [
      { type: "text", text: blockA, cache_control: { type: "ephemeral" } },
      { type: "text", text: blockB, cache_control: { type: "ephemeral" } },
      { type: "text", text: blockC },
    ],
  };
}

function buildBlockA(): string {
  const frameworks = loadFrameworks();
  return `You are Product-Advisor, a senior product management, product strategy, and product design consultant. You operate as a thinking partner for the user — analytical, plainspoken, opinionated when asked, humble when uncertain.

## Operating principles

1. **Ask clarifying questions before recommending** when material facts are missing, the user's goal is unstated, or the situation is ambiguous. But: never ask a question you could answer by calling a tool first. Try tools, then ask only what's left.
2. **Cite specific evidence.** When you reference a transcript, a metric, or a Notion doc, name it (title + timestamp or quote). Never fabricate citations.
3. **Distinguish observation, assumption, hypothesis, and recommendation.** Make the distinction explicit in your output.
4. **Frameworks are scaffolding, not performance.** Pick the right one for the question. Don't dump frameworks the user didn't ask for.
5. **Be concrete.** "Increase activation" is not advice. "Add a single-call setup flow that defers SSO config" is.

## Clarifying-question protocol

When the situation calls for clarification:
- Give a one-paragraph framing of what you currently understand.
- Ask at most 3 numbered questions.
- After you have answers, then propose.

## Tool-use guidance

- At the start of a new conversation (or when context is thin), call \`list_artifacts\` and \`read_product_profile\`. Call \`list_notion_roots\` if Notion is configured.
- Use \`search_transcripts\` before asking the user about anything that might be in a past meeting.
- Use \`search_notion\` / \`read_notion_page\` to pull PRDs, OKRs, strategy docs when relevant. Scope is limited to configured roots.
- For any quantitative claim, use \`query_data\` against the relevant CSV table. Don't speculate about numbers.
- Use \`update_product_profile\` whenever the user states a durable fact about the product (NSM, target users, OKRs, constraints). Include a one-sentence rationale.
- **Never write to Notion (\`save_to_notion\`, \`append_to_notion_page\`) without explicit user confirmation in the chat.** The UI will render a confirmation card; only proceed when the user clicks confirm.

## Output template (for recommendations)

When asked to recommend, decide, or propose a strategy, structure your response as:

\`\`\`
Situation: ...
Assumptions: ...
Open questions: ...
Hypothesis: ...
Recommendation: ...
Next steps:
- [concrete step]
- [concrete step]
\`\`\`

For lighter exchanges (clarifications, summaries, framing questions), respond conversationally — no template.

## Anti-patterns to avoid

- Vague advice ("focus on the customer", "iterate based on data").
- Framework dumps without application to the user's specific situation.
- False certainty when evidence is thin.
- Ignoring evidence the user just provided in the message.
- Restating the question back at the user as a "summary".
- Performative empathy ("Great question!").

## Framework knowledge

${frameworks}`;
}

function buildBlockB(): string {
  const profile = db()
    .prepare("SELECT * FROM product_profile WHERE id = 'default'")
    .get() as Record<string, string | number> | undefined;
  if (!profile) return "## Product Profile\n\n(not yet configured)";

  const fields: [string, string][] = [
    ["Name", String(profile.name || "")],
    ["One-liner", String(profile.one_liner || "")],
    ["Target users", String(profile.target_users || "")],
    ["Value proposition", String(profile.value_prop || "")],
    ["North star metric", String(profile.north_star_metric || "")],
    ["Current OKRs", String(profile.current_okrs || "")],
    ["Known constraints", String(profile.known_constraints || "")],
    ["Agent notes (durable memory)", String(profile.freeform_notes || "")],
  ];
  const body = fields
    .map(([k, v]) => `### ${k}\n${v || "(empty)"}`)
    .join("\n\n");
  return `## Product Profile\n\nThis is the user's product. Treat it as ground truth; update it via \`update_product_profile\` when the user reveals new durable facts.\n\n${body}`;
}

function buildBlockC(): string {
  const artifacts = db()
    .prepare(
      `SELECT id, kind, title, description, metadata_json, created_at
       FROM artifacts ORDER BY created_at DESC LIMIT 60`,
    )
    .all() as {
    id: string;
    kind: string;
    title: string;
    description: string;
    metadata_json: string;
    created_at: number;
  }[];

  const csvTables = db()
    .prepare(
      `SELECT c.table_name, c.columns_json, c.row_count, a.title
       FROM csv_tables c JOIN artifacts a ON a.id = c.artifact_id`,
    )
    .all() as { table_name: string; columns_json: string; row_count: number; title: string }[];

  const notionRoots = getSetting("notion_root_page_ids");
  const outputsDb = getSetting("outputs_db_id");

  const date = new Date().toISOString().slice(0, 10);

  let s = `## Session context\n\nCurrent date: ${date}\n\n`;

  s += `### Available artifacts (${artifacts.length})\n`;
  if (artifacts.length === 0) {
    s += "(none yet — ask the user to upload transcripts or data, or paste content directly)\n\n";
  } else {
    for (const a of artifacts) {
      s += `- \`${a.id}\` [${a.kind}] **${a.title}** — ${new Date(a.created_at).toISOString().slice(0, 10)}${a.description ? `: ${a.description}` : ""}\n`;
    }
    s += "\n";
  }

  if (csvTables.length > 0) {
    s += `### CSV tables (queryable via \`query_data\`)\n`;
    for (const t of csvTables) {
      const cols = JSON.parse(t.columns_json) as { sanitized: string; original: string; type: string }[];
      s += `- **${t.table_name}** (from "${t.title}", ${t.row_count} rows)\n`;
      s += `  Columns: ${cols.map((c) => `\`${c.sanitized}\` (${c.type})`).join(", ")}\n`;
    }
    s += "\n";
  }

  if (notionRoots) {
    const ids = safeJsonArray(notionRoots);
    s += `### Notion scope\nConfigured root pages: ${ids.length}. Outputs DB id: ${outputsDb || "(not yet created)"}.\nUse \`search_notion\` / \`read_notion_page\` — they are scoped to these roots.\n\n`;
  } else {
    s += `### Notion\nNotion is not configured. The Notion tools will return an error if called.\n\n`;
  }

  const limitless = process.env.LIMITLESS_MCP_COMMAND || process.env.LIMITLESS_MCP_URL;
  if (limitless) {
    s += `### Limitless\nLimitless lifelogs are available via \`search_limitless\`.\n`;
  } else {
    s += `### Limitless\nLimitless is not configured.\n`;
  }

  return s;
}

function getSetting(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function safeJsonArray(s: string): unknown[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
