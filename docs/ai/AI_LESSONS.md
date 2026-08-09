# Durable AIDOS lessons

Record only reusable, evidence-backed lessons. Include the date and affected area; preserve failed approaches when they can prevent repetition.

## 2026-08-09 ? AIDOS initialization

- Current source and configuration must outrank historical handover/agent analysis. Some existing Gemini documents refer to earlier filenames and proposed gaps that current code has since addressed.
- Hosting knowledge is conflicting: GitHub Pages automation and Vercel routing/links coexist. Verify the actual production target before changing deployment assumptions.
- Git inspection must precede edits. At initialization, `.agents/skills/` and `docs/SRS/` were untracked user-owned content and were deliberately excluded from AIDOS work.
- Security-rule and trusted-function tests are configured separately from the root CI path. Do not assume a green GitHub Pages workflow proves emulator rules or function logic passed.
- Financial, auth/household lifecycle, and synchronization changes cross several boundaries (`App.tsx`, `AuthContext.tsx`, domain engines, sync services, rules, and functions); route them at L3 when integrity or authorization is involved.

## Entry template

```text
## YYYY-MM-DD ? Area
- FACT/DECISION: What was learned or decided.
- Evidence: Source, command, test, incident, or commit.
- Consequence: How future work should change.
- Failed approach (if applicable): What failed and why.
```
