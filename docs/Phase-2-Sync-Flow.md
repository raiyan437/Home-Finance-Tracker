# Phase 2 synchronization flow

## Flow observed before Phase 2

1. `App.tsx` loaded scoped LocalStorage records for the active household and user wallet.
2. Event handlers immediately updated React state and LocalStorage, then commonly called a Firebase sync function without awaiting it.
3. `firebaseSync.ts` attempted a Firestore write or callable ledger mutation. Any thrown error was treated as retryable and written to the single global `home_finance_sync_outbox_v1` key.
4. Firestore listeners received collection snapshots and merged every outbox entry back into the visible collection. Deletes were hidden and sets replaced the cloud copy.
5. The merged listener result was written back to the scoped LocalStorage cache.
6. Because the outbox had no authenticated UID, household ID, retry limit, failure class, or failed state, a permanent rejection could remain visible indefinitely and a shared browser could replay another account's mutation.

Profile reads followed a similar path: an `onSnapshot` callback started asynchronous profile resolution and household reconciliation without ordering protection. A later result could therefore overwrite a newer account, roster, or wallet snapshot.

## Phase 2 flow

```text
user action
  -> optimistic React state + scoped LocalStorage
  -> versioned mutation (UID + house ID)
  -> direct full replacement / explicit profile patch / callable ledger write
       | success
       v
    remove matching outbox entry; Firestore snapshot converges
       | retryable transport failure
       v
    pending outbox entry -> bounded backoff -> replay in order
       | permanent or auth failure
       v
    failed outbox status; no snapshot overlay; optimistic state rolls back
```

The v2 outbox stores mutation type, collection, entity ID, authenticated UID,
house ID when applicable, timestamp, retry count, retry limit, next attempt,
last safe error, mutation version, and status. Only `pending` entries overlay a
snapshot. Profile identity, avatar, wallet, and membership use independent
mutation types; membership is never restored from a stale local profile.

Domain aggregates use full replacement writes so omitted optional fields are
removed. Profile patches use merge writes with explicit `deleteField()` values
for removals such as avatar. Snapshot listeners are scoped to the current
account/house and the auth/house providers invalidate stale asynchronous work
when the session or household changes.
