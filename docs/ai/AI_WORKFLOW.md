# AIDOS workflow

Use this loop for every task:

`Intent -> Context -> Inspection -> Classification -> Plan -> Implementation -> Validation -> Memory -> Lessons`

## Stages

1. **Intent**: Restate the outcome, constraints, acceptance criteria, non-goals, and authority implied by the request.
2. **Context**: Load `AGENTS.md`, project memory, and only the relevant domain documentation.
3. **Inspection**: Verify Git state and inspect the affected source, dependencies, tests, build/deploy configuration, and instruction files. Prefer current code/configuration over stale prose.
4. **Classification**: Choose the task class and L0-L3 route before editing.
5. **Plan**: For Significant or higher work, record ordered, verifiable steps in `work/ACTIVE_PLAN.md`. Large/Critical plans must be phased.
6. **Implementation**: Apply the smallest task-scoped change. Protect unrelated work and preserve architecture unless a justified decision changes it.
7. **Validation**: Run focused checks first, then broader checks proportional to blast radius. Smoke-test the application after project changes. Report exact evidence.
8. **Memory**: Update only durable, verified project facts made stale by the work.
9. **Lessons**: Record reusable discoveries, important decisions, and failed approaches; omit transient narration.

## Task classes

| Class | Typical characteristics | Planning and execution |
| --- | --- | --- |
| Trivial | Local, obvious, low-risk, no behavioral ambiguity | Brief mental plan; focused verification |
| Small | Few files, known pattern, limited blast radius | Short plan; focused tests plus relevant checks |
| Significant | Multiple components or non-obvious behavior; meaningful validation | Written plan; recommend model/reasoning/context route; update memory if facts change |
| Large | Cross-cutting architecture, substantial migration, or many dependent steps | Written phased plan; one phase at a time; validate each phase before continuing |
| Critical | Security, auth, financial integrity, destructive operations, production data, or high-consequence migration | L3 route; explicit risks and recovery; one approved phase at a time; strongest available validation |

Classification uses the highest applicable risk, not file count alone. A one-line authorization or financial-calculation change can be Critical.

## Stop and replan triggers

- The requested outcome or acceptance criteria become ambiguous in a consequential way.
- New evidence changes the root cause, scope, blast radius, architecture, data model, or security boundary.
- Existing user changes overlap the intended edit and cannot be safely preserved.
- A new dependency, migration, destructive action, external write, or broader authority becomes necessary.
- Validation fails outside the understood change or disproves a key assumption.

On a trigger: stop the current phase, preserve evidence, update the plan and risk classification, and request direction if the new path exceeds existing authority.
