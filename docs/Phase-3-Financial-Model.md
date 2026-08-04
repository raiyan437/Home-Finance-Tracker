# Phase 3 financial model

## Ledger signs

All monetary values are integer cents/poisha. A member's net balance is:

`total paid - assigned share + completed settlements sent - completed settlements received`

Positive means the member should receive money; negative means the member owes money. Every household calculation validates that all member balances sum to zero. Departed identities are keyed by UID and remain separate from one another.

## Monthly versus cumulative views

Monthly spending filters expenses by their expense date. Outstanding debt is an as-of calculation at the selected month's final instant:

- household expenses dated on or before month-end are included;
- completed settlements are included from completion until their effective reversal;
- a reversal removes the settlement only from its reversal timestamp onward.

Example: A pays 10,000 in July for an equal A/B split. July spending is 10,000 and the July month-end balances are A `+5,000`, B `-5,000`. If B pays A 5,000 in August, the July view still shows 5,000 outstanding, while the August month-end view includes the July expense and August payment and shows zero outstanding. If the payment is reversed in September, the August view remains settled and the September view restores the 5,000 debt.

## Settlement audit

Completed settlement documents are immutable audit records in the normal UI. Reversal changes the status and appends reversal metadata; it does not delete the original. History can be filtered by status and completion month.

## Personal cash ledger

New wallet settings store `cashOpeningBalanceCents` and `cashOpeningAt`. The displayed cash is the opening balance plus derived ledger entries for cash personal expenses on or after the opening date. Card expenses create no cash entry. Because entries are derived from the current cloud expense set, create/edit/delete and cash/card changes reconcile deterministically across devices. Legacy `cashBalanceCents`/`cashTrackedExpenseCents` profiles remain readable until the user saves a new opening balance.

