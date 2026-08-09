# Raiyan's AIDOS entry point

This file is the universal entry point for AI-assisted work in this repository. Read it before acting. Load only the additional context needed for the task, starting with [AI_PROJECT.md](docs/ai/AI_PROJECT.md) and [AI_RULES.md](docs/ai/AI_RULES.md).

## Required operating loop

1. Interpret the user's intent, desired outcome, constraints, and non-goals. Distinguish verified facts from decisions, assumptions, hypotheses, proposals, and unknowns.
2. Load context progressively. Inspect the repository, relevant existing documentation, source, dependency files, tests, build/deployment configuration, AI instructions, and Git status before modification. Do not rely on project memory when the implementation can verify a claim.
3. Classify the task as Trivial, Small, Significant, Large, or Critical using [AI_WORKFLOW.md](docs/ai/AI_WORKFLOW.md), then choose the L0-L3 model/reasoning/context route in [AI_ROUTING.md](docs/ai/AI_ROUTING.md).
4. Plan Significant, Large, and Critical work before implementation. Record active multi-step work in [ACTIVE_PLAN.md](docs/ai/work/ACTIVE_PLAN.md). For Large or Critical work, define phases and execute one phase at a time.
5. Make the smallest effective, root-cause-oriented change that preserves the verified architecture. Never silently expand scope or refactor unrelated code.
6. Validate in proportion to risk before claiming success. State exactly what was and was not run. After any project change, run the relevant checks and start the application locally so the updated result can be viewed and smoke-tested.
7. Keep project memory synchronized when verified facts, architecture, commands, constraints, or decisions change. Preserve reusable lessons and failed approaches in [AI_LESSONS.md](docs/ai/AI_LESSONS.md).
8. Stop and replan when evidence invalidates the plan or materially changes scope, risk, architecture, security, data handling, migrations, dependencies, or validation needs. Obtain direction before expanding beyond the user's authority.

## Project safeguards

- Follow the universal rules in [AI_RULES.md](docs/ai/AI_RULES.md) and the verified architecture/testing guidance in [AI_ARCHITECTURE.md](docs/ai/AI_ARCHITECTURE.md) and [AI_TESTING.md](docs/ai/AI_TESTING.md).
- Preserve unrelated user changes and never include them in a commit without clear authorization.
- Do not push changes that fail required checks.
- When requested work and validation are complete, stage only task-scoped changes, create a clear Git commit, and push the branch that updates the live application (`main` unless the user specifies another workflow).
- If authentication, permissions, unresolved conflicts, destructive operations, or another safety requirement blocks publishing, report the blocker and resume only after it is resolved.

## Context map

- [AI_PROJECT.md](docs/ai/AI_PROJECT.md): verified project identity, stack, constraints, and documentation map.
- [AI_RULES.md](docs/ai/AI_RULES.md): universal behavioral and safety rules.
- [AI_WORKFLOW.md](docs/ai/AI_WORKFLOW.md): task lifecycle and classification.
- [AI_ROUTING.md](docs/ai/AI_ROUTING.md): model, reasoning, and context routing.
- [AI_ARCHITECTURE.md](docs/ai/AI_ARCHITECTURE.md): implementation-derived system map.
- [AI_TESTING.md](docs/ai/AI_TESTING.md): verified checks and test boundaries.
- [AI_LESSONS.md](docs/ai/AI_LESSONS.md): durable lessons and failed approaches.
- [ACTIVE_PLAN.md](docs/ai/work/ACTIVE_PLAN.md): current significant work only.
