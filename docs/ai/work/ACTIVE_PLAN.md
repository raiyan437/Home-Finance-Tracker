# Active plan

Use this file only for current Significant, Large, or Critical work. Replace completed task detail with the idle state after durable facts and lessons have been synchronized.

## Current status

Critical production sync remediation is active. The live Firebase build still exposes a durable offline outbox, so a stale queue can survive refresh and keep the sidebar at `offline, queued`. The requested target is an online-only Firebase path that clears legacy queued records, never persists new transport failures, and reports a clean synced state after reload.

## Plan

1. Verify the current production-path queue lifecycle, cache boundaries, and deployment state.
2. Implement online-only Firebase sync: startup cleanup of legacy outbox keys, no new offline queueing, and truthful failure handling without a queued sidebar state.
3. Add regression coverage for cleanup, retryable failures, and hard-refresh state derivation; run tests, lint, typecheck, build, and local preview smoke checks.
4. Synchronize durable lessons, commit only task-scoped changes, push `main`, and verify both production hosts serve the new bundle.
