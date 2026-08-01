# 10 — Admin Panel

**PRD:** [§4.10](../../prd.md) · **Roadmap:** W1 · **Task IDs:** B9, F5.1–F5.3
**Status:** Backend ✅ 22/22 · Web 🟡

> The most complete backend area in the project, and the one whose UI lags furthest behind it.

---

## What it is

BoxArena ops. Dispute queue and resolution; user search and suspension; withdrawal approvals;
arena verification; runtime config editor; ledger reconciliation report; audit log.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| **Every mutation writes an `AuditLog`** — B9's done-when | Ops actions move other people's money; unlogged is indefensible |
| Dispute resolution requires a **mandatory admin note** | F5.2: resolving without a note must be impossible, not just discouraged |
| Wallet adjustment is **`super_admin` only** and requires a reason | The single most abusable endpoint in the system |
| Config editing is **`super_admin` only** | Runtime config includes `ENABLE_PAID_CHALLENGES` |
| Approving an application is blocked until **every checklist item is ticked** | F5.1's done-when |
| Overdue disputes are **visually unmistakable** | SLA is a trust metric, not a dashboard number |
| Approval creates Arena + Courts + PricingRules **and materialises slots** | One atomic go-live, not a half-listed venue |

## API surface — 22/22 ✅

| Method | Path | Notes |
|---|---|---|
| `GET` | `/admin/overview` | Not in contract — extra |
| `GET` | `/admin/disputes` | `?status=&overdue=true` |
| `GET` | `/admin/disputes/:id` | Both submissions side by side + evidence |
| `POST` | `/admin/disputes/:id/assign` | |
| `POST` | `/admin/disputes/:id/resolve` | `{ winnerTeamId?, isVoided, finalScore?, adminNote }` |
| `GET` | `/admin/users` | Search |
| `POST` | `/admin/users/:publicId/suspend` | `{ reason }` |
| `POST` | `/admin/users/:publicId/wallet-adjust` | **`super_admin` only**, reason mandatory |
| `GET` | `/admin/withdrawals` | Approval queue |
| `POST` | `/admin/withdrawals/:id/approve` · `/reject` | |
| `GET` | `/admin/applications` | `?status=` onboarding queue |
| `GET` | `/admin/applications/:publicId` | Full detail + verification checklist |
| `PATCH` | `/admin/applications/:publicId/verification` | Tick checklist items |
| `POST` | `/admin/applications/:publicId/approve` | Creates Arena + Courts + PricingRules, materialises slots |
| `POST` | `/admin/applications/:publicId/reject` | Structured reason |
| `GET` | `/admin/settlements` · `POST /admin/settlements/:id/approve` | |
| `GET` | `/admin/reconciliation` | Ledger-vs-balance drift report |
| `GET` | `/admin/config` · `PATCH /admin/config/:key` | **`super_admin` only** |
| `GET` | `/admin/audit-logs` | |

## Models

`Dispute` · `AuditLog` · `AppConfig` · `WithdrawalRequest` · `Settlement` · `ArenaApplication` · `User`

## Background jobs

`ledgerReconciliation` — daily 03:00 IST. Asserts invariants I1/I2 and **freezes + pages on drift**.
This is what `GET /admin/reconciliation` reports on.

## Where it's built

| Surface | Files | Status |
|---|---|---|
| Backend | [`modules/admin/`](../../../backend/src/modules/admin/) + [`admin.test.ts`](../../../backend/src/modules/admin/admin.test.ts) | ✅ complete |
| F5.1 application queue | [`admin/applications/`](../../../web/src/app/admin/applications/page.tsx) + [detail](../../../web/src/app/admin/applications/[publicId]/page.tsx) + [`verification-checklist.tsx`](../../../web/src/features/admin/components/verification-checklist.tsx) | ✅ |
| F5.2 disputes ⚠️ | [`admin/disputes/page.tsx`](../../../web/src/app/admin/disputes/page.tsx) (83 lines) | 🟡 |
| F5.3 money & ops | [`admin/users`](../../../web/src/app/admin/users/page.tsx), [`admin/audit`](../../../web/src/app/admin/audit/page.tsx) | ⬜ both stubs |

## Gaps

1. **F5.3 is entirely unbuilt.** Users and audit are 22-line stubs; there is no withdrawal queue, settlement approval, reconciliation report, or config editor on web — against 10 finished endpoints.
2. **The config editor is the one that stings.** `ENABLE_PAID_CHALLENGES` is the launch-defining flag, and there is no UI to see or flip it. Today that's an env-var deploy.
3. **No reconciliation UI**, yet the launch gate requires *"ledger reconciliation clean for 7 consecutive days on staging"* — someone has to read that report daily.
4. **Disputes UI is thin** (83 lines) for an ⚠️ awkward-state task: `[verify]` SLA countdown, side-by-side submissions, evidence viewer, mandatory-note enforcement, void option.
5. **Withdrawal queue has no inflow** — `POST /wallet/withdraw` doesn't exist (see [03](./03-booking-wallet.md)), so the approval queue can't receive anything.
6. `[verify]` F5.1's done-when: approval blocked until every checklist item is ticked.
7. `[verify]` B9's done-when: **every** mutation writes an `AuditLog`.

## Launch-gate ties

- Ledger reconciliation clean 7 consecutive days on staging (needs item 3).
- `ENABLE_PAID_CHALLENGES=false` in the launch build (needs item 2, or a documented deploy step).
