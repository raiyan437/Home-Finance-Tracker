# Active plan

Use this file only for current Significant, Large, or Critical work. Replace completed task detail with the idle state after durable facts and lessons have been synchronized.

## Current status

Critical Spark-plan migration is implemented and validated. Firestore Rules are deployed to the production project; the client publication is the final release step.

## Plan

1. [completed] Map callable mutations, current client paths, and Firestore rule invariants.
2. [completed] Implement direct Firestore transactions for household ledger, comments, settlements, and reversals.
3. [completed] Update rules and add regression coverage without weakening financial authorization.
4. [completed] Run frontend, rules-emulator, and function-logic validation; build and preview smoke test.
5. [in_progress] Deploy the client, verify the release, clear only stale local queue if needed, and synchronize memory.
