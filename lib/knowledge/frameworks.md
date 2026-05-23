# Product Frameworks Reference

Use these as scaffolding for thinking, not as performance. Pick the right tool for the question; don't dump a framework when a direct answer will do.

## Discovery & Customer Understanding

**Jobs-to-be-Done (JTBD).** Customers "hire" products to make progress on a job. A job statement: *When [situation], I want to [motivation], so I can [expected outcome].* Use when the team is confused about who the product is for or why people churn. Anti-pattern: confusing a persona for a job.

**Continuous Discovery (Torres).** Weekly contact with customers. Map opportunities (customer needs/pains/desires), then solutions, then assumption tests. Use the Opportunity Solution Tree (OST) to keep discovery linked to a measurable outcome.

**Five Whys.** Ask why iteratively to get from symptom to root cause. Stop when the answer becomes a system, not a person.

## Prioritization

**RICE.** Score = (Reach × Impact × Confidence) / Effort. Use when comparing well-scoped initiatives that share similar metrics. Weakness: invites false precision; treat as a sorting heuristic, not a ranking truth.

**ICE.** Quick Impact × Confidence × Ease scoring. Use for fast triage in a backlog of small bets.

**Kano Model.** Features bucketed into Must-Be, Performance, Excitement, Indifferent, Reverse. Use for roadmap conversations about *quality* vs *novelty*.

**Cost of Delay (CoD) / WSJF.** WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Use when sequencing matters more than absolute priority.

**Now-Next-Later.** A roadmap format that resists date overpromises. Default for external/exec roadmaps.

## Metrics & Strategy

**North Star Metric (NSM).** One leading metric that captures customer value delivered. Should move before revenue does. Pair with 3-5 inputs the team can directly influence. Anti-pattern: picking a vanity metric (signups, sessions) instead of value-delivered (active teams, weekly meaningful actions).

**OKRs.** Objective (qualitative, ambitious) + 3-5 Key Results (measurable outcomes, not outputs). Critique an OKR by asking: would moving these KRs actually mean we achieved the Objective? Are the KRs outcomes, not feature ship dates?

**Pirate Metrics (AARRR).** Acquisition, Activation, Retention, Referral, Revenue. Use to locate a funnel problem fast; combine with cohort views.

**Engagement = Breadth × Depth × Frequency.** Quick way to decompose "are people engaged" into measurable parts.

**Strategy stack.** Vision → Strategy → Bets → Initiatives → Tasks. Each level should be testable by the level above. A strategy that doesn't constrain choices isn't a strategy.

## Design

**Nielsen heuristics (10).** Visibility of system status, match between system and real world, user control & freedom, consistency & standards, error prevention, recognition over recall, flexibility & efficiency, aesthetic & minimalist design, help users recognize/diagnose/recover from errors, help & documentation.

**Cognitive load.** Reduce extraneous (UI clutter), preserve germane (helps learning), minimize intrinsic (split complex tasks). Most product UX problems are extraneous load problems.

**Progressive disclosure.** Show only what's needed now. Reveal complexity on demand.

**Empty states matter more than the loaded state** — they're the user's first impression of a feature.

**Accessibility baseline.** WCAG AA: 4.5:1 contrast for body text, keyboard nav, focus rings, semantic HTML, labels on inputs, never rely on color alone.

## Pricing & Packaging

**Value metric.** Bill on the dimension that scales with value the customer gets (seats, runs, GB, agents, etc.). Picking the right value metric matters more than the price point.

**Good-better-best.** Three tiers. Anchor the middle. Best tier exists to make better look reasonable.

**Land-and-expand.** Low-friction entry tier optimized for activation; expansion via seats, usage, or feature gates.

## Decision-making

**Type 1 vs Type 2 decisions (Bezos).** Type 1: irreversible, high-stakes — go slow, gather signal. Type 2: reversible — go fast, learn from doing.

**Disagree and commit.** Healthy disagreement followed by full commitment beats consensus-by-attrition.

**Pre-mortem.** Imagine the project failed; work backward to causes. Surfaces risks teams won't otherwise voice.

## Anti-patterns to call out

- Roadmaps as feature lists with dates (instead of outcomes).
- Personas without jobs.
- OKRs whose KRs are ship dates.
- A/B testing before the funnel is instrumented end-to-end.
- "We need to do discovery" with no link to a measurable outcome.
- Adding a setting instead of making a decision.
- Optimizing engagement without distinguishing valuable from compulsive usage.
