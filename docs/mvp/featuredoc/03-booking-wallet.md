# 03 — Booking & Wallet

**PRD:** [§4.3](../../prd.md) · **Roadmap:** M3 + M4 · **Task IDs:** B5, B6, F2.4–F2.7, M3
**Status:** Backend 🟡 9/12 · Web 🔴 · Flutter 🔴

> **The hardest correctness work in the project.** `phased_roadmap.md` M3 says outright:
> do not rush it. Everything else can be rebuilt; a double-booking or a lost ₹500 costs trust
> that doesn't come back.

---

## What it is

A per-court slot grid by date, where booked and blocked slots are visually distinct.
Multi-hour bookings commit as **one atomic transaction**. A three-bucket wallet
(deposit / winnings / bonus) with Razorpay top-up funds it. Cancellation applies
policy-driven refund tiers; a 6-digit check-in code redeems at the venue.

## Acceptance criteria (PRD)

- Two users tapping the same slot simultaneously → **exactly one succeeds**, the other sees a
  clear message, **neither is charged twice**.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| **Two-phase booking**: `POST /bookings/hold` (atomic conditional update) → `POST /bookings` (confirm) | Holding and paying in one call means either double-books or orphaned charges |
| Multi-slot holds acquire **all or none, in sorted order** | Sorted acquisition is what prevents deadlock between two multi-hour bookings |
| `releaseExpiredHolds` every 60s | Abandoned checkouts must not freeze inventory |
| Debit order is **bonus → deposit → winnings** | Protects the only withdrawable bucket last |
| Conditional `$inc` guards; balance can **never** go negative | |
| Every mutation writes a `Transaction` with `balanceAfterPaise` + `idempotencyKey`, **in the same session** | The ledger is the source of truth; a balance without a row is unreconcilable |
| Razorpay webhook on a **raw-body** route, HMAC-verified, deduped on event id | Verifying re-serialised JSON always fails (edge case 31) |
| Client callback and webhook **converge idempotently** | Whichever lands first credits; the other is a no-op (edge case 32) |
| Bonus money is playable but **never withdrawable**, and says so in the API | |
| Financial mutations require `Idempotency-Key` | |

## API surface — 9/12

### Bookings — 5/6

| Method | Path | Status |
|---|---|---|
| `POST` | `/bookings/hold` — `{ slotIds[], expectedTotalPaise }` → `holdExpiresAt` | ✅ |
| `POST` | `/bookings` — `{ holdId, couponCode?, paymentMode }` + Idem | ✅ |
| `GET` | `/bookings` — `?status=&upcoming=true` | ✅ |
| `GET` | `/bookings/:publicId` — owner or arena owner only | ✅ |
| `POST` | `/bookings/:publicId/cancel` — refund tier; cascades to challenge | ✅ |
| `POST` | `/bookings/:publicId/check-in` | ⚠️ only as `/owner/bookings/:publicId/check-in` |

### Wallet & payments — 4/6

| Method | Path | Status |
|---|---|---|
| `GET` | `/wallet` — three buckets + locked + `bonusIsWithdrawable: false` | ✅ |
| `GET` | `/wallet/transactions` — cursor-paginated (§97) | ✅ |
| `POST` | `/wallet/topup/order` → Razorpay order | ✅ |
| `POST` | `/wallet/topup/verify` — client callback, converges with webhook | ✅ |
| `POST` | `/wallet/withdraw` — KYC-gated, winnings only, computes TDS | 🔴 **missing** |
| `GET` | `/wallet/withdrawals` | 🔴 **missing** |
| `POST` | `/webhooks/razorpay` — raw body, HMAC, dedupe | ✅ |

## Error codes

`SLOT_UNAVAILABLE` 409 (lost the race) · `PRICE_CHANGED` 409 (`details.newPricePaise`) ·
`INSUFFICIENT_BALANCE` 409 (`details.shortfallPaise`) · `IDEMPOTENCY_CONFLICT` 409 ·
`KYC_REQUIRED` 403 · `GEO_RESTRICTED` 403

## Models

`Slot` · `Booking` · `Transaction` · `PaymentOrder` · `WithdrawalRequest` · `PricingRule`

## Background jobs

`releaseExpiredHolds` 60s · `materialiseSlots` daily 02:00 IST ·
`reconcilePayments` 15 min (orders stuck in `created`/`attempted`) ·
`ledgerReconciliation` daily 03:00 IST (**invariants I1/I2 — freeze and page on drift**) ·
`slotReminders` 10 min

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | [`modules/booking/`](../../../backend/src/modules/booking/), [`modules/wallet/`](../../../backend/src/modules/wallet/), [`modules/payments/`](../../../backend/src/modules/payments/) | Tests exist: [`booking.concurrency.test.ts`](../../../backend/src/modules/booking/booking.concurrency.test.ts), [`wallet.integrity.test.ts`](../../../backend/src/modules/wallet/wallet.integrity.test.ts), [`payment.idempotency.test.ts`](../../../backend/src/modules/payments/payment.idempotency.test.ts) |
| Web | [`slot-grid.tsx`](../../../web/src/features/arenas/components/slot-grid.tsx) only | **No checkout, no bookings list, no wallet route** |
| Flutter | [`wallet_screen.dart`](../../../flutter_app/lib/features/wallet/presentation/wallet_screen.dart) (Razorpay handlers wired), [`wallet_provider.dart`](../../../flutter_app/lib/features/wallet/providers/wallet_provider.dart) | Mock-backed. **No slot grid, no checkout screen** |

## Gaps

1. **Web has no money path at all.** F2.5 checkout, F2.6 bookings/receipt, F2.7 wallet — three tasks, zero routes, against a finished backend.
2. **Flutter has no slot grid and no checkout.** The wallet screen exists but reads mock data.
3. **Withdrawals are unimplemented** (`POST /wallet/withdraw`, `GET /wallet/withdrawals`) — note the admin approval queue *is* built, so the queue currently has nothing to receive.
4. **Check-in has no player-side route.** Contract puts it on `/bookings/:publicId/check-in`; code only has the owner route. Decide which is canonical.
5. `[verify]` the M3 done-when: 50 parallel bookings on one slot → 1 success, 49 clean 409s, no charges on losers.
6. `[verify]` the M4 done-when: 1,000 randomised ops leave `sum(ledger) == balance` per bucket; a webhook replayed 3× credits once.

## Free-launch note

With `ENABLE_PAID_CHALLENGES=false`, **bookings still need to work** — only the escrow/prize
half goes dormant. Top-up and withdrawal are lower priority for day one; the slot grid,
hold countdown, and checkout are not.

## Launch-gate ties

- Ledger reconciliation clean **7 consecutive days** on staging.
- Load test: **100 concurrent bookings, zero double-books**.
- Razorpay webhook verified end-to-end via ngrok, replay-safe.
