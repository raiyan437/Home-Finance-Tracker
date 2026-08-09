# Phase 4 lifecycle policy

## Canonical identity

Firebase Authentication UID is the account identity. Signup normalizes email and display name, updates the Auth display name, and waits for the complete Firestore profile write before exposing a session. A missing profile is recoverable for the authenticated UID; the app never creates a second Auth account.

The current household document is authoritative for membership and leadership. A user is a leader only when house.leaderUid equals auth.uid; users/{uid}.role is repaired metadata. Firestore rules remain the final authorization boundary.

## Recovery and account changes

Cloud profile membership is preferred over device storage. If houseId is absent, the app searches canonical memberUids. Exactly one match is repaired into the profile. Multiple matches are a controlled recovery conflict and are never resolved by choosing the first result. Account changes clear the active profile, household, subscriptions, and in-memory ledger state before the next account loads.

## Membership mutations

Joining reads the house code, latest house, and latest user profile inside one transaction. It is idempotent, derives the role from leaderUid, rejects a second active household, and atomically updates the roster and profile. The member limit is enforced from the transaction snapshot.

Leadership transfer reads the latest house and constructs a fresh roster from that snapshot. It preserves member identity fields and ledger revision, updates the canonical leader, both profile roles, and the code index in one transaction.

Leaving and removal require no pending ledger mutations and a zero net balance, including both amounts owed and amounts due. Their transactions derive the roster from the latest house. Financial records keep departed UIDs as historical identities, so names and balances do not get silently reassigned.

## Closure and audit policy

Only the canonical leader can close a household. The UI requires typing the exact household name and explains that the active household and join code will be removed. Firestore refuses closure unless one active member remains, all balances are zero, and the profile is cleared in the same transaction.

Closure creates houseArchives/{houseId}, deletes the active household and code index, and clears the final profile membership atomically. Expenses and settlements are deliberately retained in place as audit data under the archived household ID. The archive member can read those records; active-household reads still require the live roster. Export financial data before closure when an external copy is required.

## Photos

Avatar removal writes an explicit avatarRemovedAt tombstone and deletes the avatar field. The tombstone prevents Firebase Auth's stale photoURL or an older roster snapshot from restoring the image. The private profile and shared roster are reconciled transactionally, and the same semantics apply to leaders and members.
