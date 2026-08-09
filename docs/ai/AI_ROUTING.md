# Model, reasoning, and context routing

Route work by the highest level warranted after evaluating complexity, uncertainty, blast radius, consequence, architecture impact, security/data sensitivity, and validation difficulty.

| Route | Use when | Model recommendation | Reasoning | Context |
| --- | --- | --- | --- | --- |
| L0 Minimal | Trivial, deterministic, isolated, easily reversible | Fast capable model | Minimal | `AGENTS.md`, target file, focused check |
| L1 Normal | Small work using established patterns | General coding model | Normal | Project/rules memory plus directly related code and tests |
| L2 Significant | Significant cross-file behavior, moderate uncertainty, architecture impact, or difficult validation | Strong coding model with reliable tool use | High | Relevant architecture, domain source, dependency/configuration, tests, Git diff/history as needed |
| L3 Deep/Critical | Large/Critical work; auth, security, financial integrity, migrations, destructive or production-data impact | Strongest available engineering model | Deep/maximum | Broad but targeted repository context, trust boundaries, history/decisions, deployment, recovery, and full validation evidence |

## Evaluation guide

- **Complexity**: number and coupling of concepts, not just files.
- **Uncertainty**: missing evidence, unfamiliar code, conflicting documentation, or unclear reproduction.
- **Blast radius**: users, modules, environments, and data affected if wrong.
- **Consequence**: reversibility and cost of an error.
- **Architecture impact**: boundary, contract, persistence, dependency, or deployment changes.
- **Security/data sensitivity**: authentication, authorization, secrets, private/financial data, and rules.
- **Validation difficulty**: ability to reproduce, isolate, automate, and observe success/failure.

## Significant-work recommendation

For Significant work, default to **L2**: a strong coding model, high reasoning, and a broad-but-targeted context set covering `AGENTS.md`, `AI_PROJECT.md`, `AI_RULES.md`, the relevant architecture section, affected source and tests, package/configuration files, and current Git state. Escalate to L3 immediately when authentication, authorization, financial correctness, security rules, migrations, destructive actions, or production data are materially involved.

Do not load the whole repository by habit. Expand context progressively when evidence, imports, call paths, tests, or risk boundaries require it.
