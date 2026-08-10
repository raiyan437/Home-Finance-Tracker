# Active plan

Use this file only for current Significant, Large, or Critical work. Replace completed task detail with the idle state after durable facts and lessons have been synchronized.

## Current status

Critical production authorization recovery is active. Both documented hosts serve the same current online-only bundle. The client and Rules currently deadlock on legacy house documents that need roster-index repair, and transient failed sync state is not scoped to the current auth/house session. The Firebase CLI credential exposed by diagnostic output was revoked; production data remains unchanged.

## Plan

1. [completed] Trace the live bundle, auth identity path, sync status lifecycle, Rules membership predicates, and available production access.
2. [completed] Add a Rules-validated legacy roster repair path, invoke it before household subscriptions/writes, and scope/reset sync status by auth-house session.
3. [completed] Add client and Rules regression coverage and run frontend, Rules, functions, type, lint, build, and browser smoke validation.
4. [in_progress] Re-authenticate Firebase CLI, back up/audit live records, deploy Rules, push main, and verify both production hosts.
5. [in_progress] Synchronize architecture/lessons, record release evidence, and close the incident only after authenticated household flows pass.
