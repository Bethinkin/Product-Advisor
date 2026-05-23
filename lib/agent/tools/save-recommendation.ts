import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../../db/client";
import type { ToolDef } from "./types";

const schema = z.object({
  title: z.string().min(1),
  situation: z.string(),
  assumptions: z.string(),
  open_questions: z.string(),
  hypothesis: z.string(),
  recommendation: z.string(),
  next_steps: z.string(),
  linked_artifact_ids: z.array(z.string()).optional(),
});

export const saveRecommendation: ToolDef<typeof schema> = {
  name: "save_recommendation",
  description:
    "Persist a structured recommendation as a local artifact (kind=recommendation). Useful for memos the user wants to refer back to. Independent of save_to_notion — call both if the user wants it in Notion too.",
  schema,
  execute: (args, ctx) => {
    const id = nanoid();
    const markdown = `# ${args.title}

**Situation:** ${args.situation}

**Assumptions:** ${args.assumptions}

**Open questions:** ${args.open_questions}

**Hypothesis:** ${args.hypothesis}

**Recommendation:** ${args.recommendation}

**Next steps:**
${args.next_steps}
`;
    db().prepare(
      `INSERT INTO artifacts (id, kind, source, title, description, metadata_json, content_hash, created_at)
       VALUES (?, 'recommendation', 'agent', ?, ?, ?, ?, ?)`,
    ).run(
      id,
      args.title,
      args.situation.slice(0, 200),
      JSON.stringify({
        markdown,
        linked_artifact_ids: args.linked_artifact_ids || [],
        conversation_id: ctx.conversationId,
      }),
      null,
      Date.now(),
    );
    return { artifact_id: id };
  },
};
