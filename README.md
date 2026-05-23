# Product-Advisor

A personal AI consultant that becomes an expert in product management, product strategy, and product design.

Drop in meeting transcripts and product data. The advisor asks clarifying questions like a real consultant would, then gives strategic insights and execution plans grounded in your actual context.

## What it does

- **Chat with a senior product consultant.** Uses Claude (Sonnet by default, Opus for strategic memos) with a system prompt encoding consulting behavior, framework knowledge (JTBD, RICE, NSM, OKRs, Continuous Discovery, Nielsen heuristics, etc.), and an output template (`Situation → Assumptions → Open questions → Hypothesis → Recommendation → Next steps`).
- **Reads your stuff.** Upload `.txt`/`.docx`/`.pdf`/`.vtt` transcripts and CSV data — file bytes are stored in the SQLite database, so the whole app state is one portable file. The agent searches transcripts (FTS5/BM25), reads chunks, and runs read-only SQL over your CSVs.
- **Remembers your product.** A structured Product Profile (NSM, target users, OKRs, constraints) plus free-form **memory documents** — titled markdown notes the agent maintains across conversations (discovery findings, hypothesis logs, decision records, open questions). Both writable by you and the agent, with revision audit logs.
- **Pulls from where you already work.** Optional MCP integrations with Limitless (lifelogs) and Notion (PRDs, OKRs, meeting notes). Writes back to Notion only with explicit confirmation.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn-style UI
- Anthropic Claude API with prompt caching + tool use
- SQLite (`better-sqlite3`) + FTS5 for full-text search
- `@modelcontextprotocol/sdk` for Limitless / Notion MCP clients

## Setup

```bash
cp .env.example .env        # fill in ANTHROPIC_API_KEY (MCP vars optional)
npm install
npm run db:init             # create the SQLite schema
npm run dev                 # http://localhost:3000
```

## First-run flow

1. Open `/profile` and seed the Product Profile (name, target users, NSM, OKRs).
2. Open `/artifacts` and upload a transcript + a CSV.
3. (Optional) Open `/memory` and seed a memory doc, or let the agent create them from conversations.
4. Open `/setup` if you want to connect Notion — paste 1-5 root page URLs. The app creates a "Product-Advisor Outputs" database for storing recommendations.
5. Open `/chat` and ask away.

## Layout

```
app/                Next.js App Router (chat, artifacts, memory, profile, setup, api/*)
lib/agent/          Tool-use loop, system prompt, model routing, tool registry
lib/agent/tools/    One file per tool (search_transcripts, query_data, write_memory, save_to_notion, ...)
lib/agent/mcp/      MCP clients for Limitless + Notion
lib/db/             SQLite schema + client (file blobs live in the artifacts table)
lib/ingest/         Transcript and CSV parsers
lib/memory/         Memory document store (CRUD + revisions + FTS)
lib/search/         FTS5 wrapper for transcripts
lib/knowledge/      PM/design framework reference (embedded in system prompt)
components/         UI components
data/               SQLite DB (gitignored)
```
