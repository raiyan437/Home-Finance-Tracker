# Universal AI Documentation & Repository Guidelines

## 1. Dynamic Agent Prefix & Location Rule
Identify your agent identity (e.g., `GEMINI`, `CLAUDE`, `COPILOT`, `CODEX`).

* **Prefix:** All AI-generated support documentation created MUST start with your agent name in ALL CAPS followed by an underscore: `[AGENT_NAME]_`.
  * *Examples:* `GEMINI_Architecture.md`, `CLAUDE_Architecture.md`, `COPILOT_Roadmap.md`
  * *Forbidden:* Generic filenames like `architecture.md`, `notes.md`, `roadmap.md`, or `audit.md`.
* **Location:** Save all generated documentation inside `/docs/[agent_name_lowercase]/`.
  * *Examples:* `/docs/gemini/`, `/docs/claude/`, `/docs/copilot/`
  * If the folder does not exist, create it. Consolidate misplaced documents into this directory if found.

## 2. Documentation Management & Context
Documentation is the project's memory; Code is the source of truth.

* **Read First:** Before modifying or creating anything, check `/docs` and `/docs/[agent_name_lowercase]`. Understand existing architecture, decisions, and context.
* **Incremental Updates:** Always prefer appending to or updating existing `[AGENT_NAME]_` documents over creating new files.
* **Preserve History:** Never overwrite or rewrite existing knowledge unless it is explicitly obsolete or incorrect.

## 3. Cross-Agent Compatibility
Multiple AI agents (Claude, Copilot, Gemini, Codex, etc.) may work in this repository simultaneously.

* **DO NOT** delete, rename, replace, or automatically merge documentation created by other agents.
* **DO** link to, extend, and build upon other agents' documentation when relevant.

## 4. Standard Document Structure
Every document created must include:
* Purpose
* Last Updated
* Current Status
* Relevant Files
* Decisions & Rationale
* Outstanding Work / Next Steps

For technical design/architecture documents, also include:
* Architecture Notes
* Constraints & Risks
* Future Considerations

## 5. Core Operating Principles
1. Always understand before modifying.
2. Prefer the smallest effective change that solves the root problem.
3. Keep documentation strictly synchronized with the codebase state.
4. Preserve working functionality unless explicitly instructed otherwise.
