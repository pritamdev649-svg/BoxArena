# End-to-End Flow — Verified

The complete loop, from a venue signing up to money landing in three wallets.

**Verified against the live stack on 2026-08-03.** Every figure below was
observed, not calculated on paper — see *The money, reconciled*.

---

## The loop

```
venue onboards ─→ courts & pricing ─→ slots exist
                                          │
official onboards ─→ ops verifies ────┐   │
                                      │   ▼
                          player books a slot
                                      │
                          posts a challenge (entry fee)
                                      │
                          opponent sees full cost, accepts
                                      │
                          both captains agree the official ◄┘
                                      │
                          official fee charged to both
                                      │
                          official scores the match
                                      │
                          result confirmed → escrow releases
                                      │
              ┌───────────────────────┼───────────────────────┐
         winner paid            official paid          venue settled
        (net prize pool)     (fee − commission)      (weekly, T+3)
```

---

## 1. Partner onboarding

| Step | Where | State |
|---|---|---|
| Apply | `/partner/apply` → `POST /owner/apply` | ✅ |
| Verify phone, account created | `POST /owner/apply/:id/verify-phone` | ✅ |
| **7-step onboarding wizard** | `/partner/onboarding` | ✅ (F4.2) |
| Ops approves the application | `/admin/applications` | ✅ |
| Courts, hours, price bands, blocking | `/partner/courts`, `/partner/settings` | ✅ |
| Venue photos | `/partner/settings` | ✅ |
| Settlements | `/partner/settlements` | ✅ |

Verifying the phone now lands the applicant **in the wizard**, not on an empty
dashboard. Each step PATCHes on its own and the server tracks `currentStep`, so
closing the tab loses at most the step in progress. Every step is validated
server-side — it used to accept `any`, which let an application reach the ops
queue with a court priced `"free"` or a pin in the Bay of Bengal.

Step 5 (pricing bands) is skippable by design: the base per-hour price from
step 3 already prices every slot, and forcing a weekday/weekend/holiday matrix
before go-live is where onboarding dies.

A venue lists **whatever sports it has** — badminton, cricket and football are
all bookable. That is deliberately wider than the competitive scope below.

## 2. Official onboarding

| Step | Where | State |
|---|---|---|
| Why officiate | `/officials` (linked in the footer) | ✅ |
| Register, set own price | `/officials/register` → `POST /officials` | ✅ |
| Ops verification | `POST /officials/:id/verification` | ✅ |
| Fixture list | Flutter `/official/matches` | ✅ |

Registration is open to anyone. **Verification is what grants the power to
settle prize money** on a scorecard alone — an unverified or team-added
official can still officiate and be paid, but the result then needs both
captains.

Officials follow **challenge** scope, so badminton only for now.

## 3. Player: book → challenge → accept

| Step | Where | State |
|---|---|---|
| Find a venue | `/arenas`, `/arenas/[slug]` | ✅ |
| Top up the wallet | `/wallet` | ✅ (mock gateway) |
| Hold and pay for a slot | `/checkout` → `/bookings/[id]` | ✅ |
| **Post a challenge** | `/challenges/new` (web), Flutter create screen | ✅ |
| Opponent sees the full cost | `/challenges/[publicId]` | ✅ |
| Accept, behind a mandatory checkbox | `POST /challenges/:id/accept` | ✅ |

Both clients now start from **a booking you already hold**, and create a team
inline if you have none.

`POST /challenges` used to accept a missing `bookingId`/`teamId` and invent
what was absent: a ₹0 pay-at-venue booking against an arbitrary arena, a court
if that arena had none, a slot id referencing nothing, and — for a doubles
team — the first unrelated user in the database conscripted as a teammate.
Both ids are now **required**. A challenge is a claim on a court somebody paid
for; if there is no such court, there is no challenge.

## 4. Officiating and scoring

| Step | Where | State |
|---|---|---|
| Captain proposes an official | `/matches/[id]/official` | ✅ |
| Other captain confirms → locks | same | ✅ |
| Fee charged to both captains | `POST /matches/:id/official-fee/collect` | ✅ |
| Official starts and scores | `/score/[matchId]` (web + Flutter) | ✅ |
| Official no-show | `POST /matches/:id/official/no-show` | 🟡 API only |
| Player raises a dispute | `POST /matches/:id/dispute` | ✅ |
| Verified official confirms → settles | `POST /matches/:id/live/confirm` | ✅ |
| Non-verified → both captains confirm | `/matches/[id]/confirm` | ✅ |

## 5. Money out

| Payee | When | How |
|---|---|---|
| **Winner** | on settlement | net prize pool, credited to winnings |
| **Official** | same transaction | fee less commission |
| **Venue** | weekly, T+3 | `settlementSweep` job → `/partner/settlements` |
| **Player → bank** | on ops approval | `/wallet` → `POST /wallet/withdraw` → `/admin/withdrawals` |

### Withdrawals

Winnings only — deposits are refunded through the gateway they arrived on, and
bonus credit is playable but never withdrawable. KYC is required, 30% TDS
(s.194BA) is deducted and shown before you submit, and the balance is **debited
on request, not on approval**, so the same rupees cannot be requested twice
while ops works the queue. Rejecting refunds it, with a reason the player
reads.

Behind `ENABLE_WITHDRAWALS` (default off): the route exists and is testable
without being reachable in an environment that has no payout provider.

---

## The money, reconciled

A real run: ₹450 court, ₹300 entry each, ₹400 official, 10% commission.

| | Change | Made up of |
|---|---|---|
| **Creator (won)** | **−₹410** | court −450, entry −300, official −200, prize **+540** |
| **Opponent (lost)** | **−₹500** | entry −300, official −200 |
| **Official** | **+₹360** | fee 400 less 10% commission |

Observed exactly. Platform keeps ₹60 of the pool and ₹40 of the official's fee.

### Two bugs this walkthrough caught

**Commission was deducted twice from the official.** `payOfficial` credited the
*net* fee and then posted a commission row as well, paying ₹320 instead of
₹360. It now credits the gross and takes commission as its own row — which also
makes the official's ledger read "fee 400 / commission −40" rather than one
unexplained net line.

**The pre-accept breakdown split the court fee.** It told the accepting side
they owed half the court. They do not: **whoever books the slot pays for it in
full**, and the opponent is only ever charged the official share and the entry
fee. The breakdown now reports `perTeamCostPaise` for the opponent and
`creatorTotalCostPaise` separately. A number the player can disprove from their
own wallet is worse than no number.

### One API bug

`POST /challenges` required Mongo ObjectIds for `bookingId` and `teamId`, while
every client only ever holds `publicId`s — so challenge creation was
unreachable by anything that followed the stated convention. It now accepts
either.

---

## Scope

Three separate scopes, each narrowing the one above
([`sports.ts`](../backend/src/shared/config/sports.ts)):

| Scope | Sports |
|---|---|
| Bookable at a venue | badminton · cricket · football |
| Challenges may be posted in | **badminton** |
| Officials may score live | **badminton** |

Cricket's rally engine is on hold — [`games_rule/cricket.md`](./games_rule/cricket.md).
`GET /public/config` serves all three lists.

---

## What blocks a self-serve launch

**Nothing structural.** The five blockers this document listed are closed:

| Was | Now |
|---|---|
| `/challenges/new` was a stub | Real form on web and Flutter, booking-first |
| No teams UI | Created inline from the challenge form on both clients |
| No partner onboarding wizard | `/partner/onboarding`, 7 steps, resumable, validated |
| Withdrawals did not exist | Request → ops queue → payout, behind a flag |
| Flutter read fixtures | `seed_data.dart` is deleted |

What remains is smaller and none of it stops the loop:

1. **Withdrawals need a payout provider** before `ENABLE_WITHDRAWALS` can go
   true in production. The queue and ledger are done; the transfer is not.
2. **Step 2 of the wizard takes typed coordinates**, not a draggable map pin.
   Places Autocomplete and the map need the Maps JS API wired; ops re-checks
   the pin against satellite view either way.
3. **Official no-show has no UI** — `POST /matches/:id/official/no-show` works.
4. **Cricket live scoring is on hold** by decision, not by omission.

## Reproducing this

Credentials are dev-mode OTP `123456` throughout.

| Role | Phone |
|---|---|
| Captain A | `9820000001` |
| Captain B | `9820000002` |
| Verified official | `9830000001` |
| Team-added official | `9830000002` |
| Venue owner | `9810000001` |
| Ops | `9999999999` |
