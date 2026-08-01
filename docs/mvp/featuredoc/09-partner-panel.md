# 09 — Arena Partner Panel

**PRD:** [§4.9](../../prd.md) · **Roadmap:** W2 · **Task IDs:** B9, F4.1–F4.5
**Reference:** [`arena_onboarding.md`](../../arena_onboarding.md)
**Status:** Backend 🟡 18/20 · Web 🟡

---

## What it is

Two things under one roof: **onboarding** (a public application → a 7-step resumable wizard →
ops approval) and the **running panel** (courts, hours, pricing, slot blocking, today's
bookings, check-in verification, earnings).

## Acceptance criteria (PRD)

- An owner can **never** see another arena's data.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| Arena scoping is enforced in the **service layer**, not the controller | A new controller that forgets the check must still be safe. This is the AC |
| `arena_staff` is restricted to a subset of routes — verified **against the API**, not by hiding menus | F4.5's done-when |
| Wizard saves **per step** and is resumable | Owners abandon and return; losing 6 steps loses the arena (F4.2) |
| **Step 2 requires dragging the map pin to the gate** and confirming — it cannot be skipped | A wrong pin sends every player to the wrong place |
| Approval runs a **100m duplicate check** | Stops the same turf being listed twice |
| Slot blocking **cascades full refunds** with a warning shown first | The owner is taking money back from players; they must see that |
| Offline/walk-in entry in **≤ 2 taps** | If it's slower than the paper register, they'll keep using paper and we'll double-book (edge case 115) |
| Pricing supports weekday / weekend / **holiday** / specific-date bands, by priority | Holiday must beat weekend (B4's done-when) |

## API surface — 13/20

### 12a. Application — 5/5 ✅

| Method | Path | Status |
|---|---|---|
| `POST` | `/partner/apply` — 6-field lead, no account yet | ✅ |
| `POST` | `/partner/apply/:publicId/verify-phone` — OTP → `User{role:arena_owner,status:pending}` | ✅ |
| `GET` | `/partner/application` — resume the wizard | ✅ |
| `PATCH` | `/partner/application/step/:n` — save steps 1–7 independently | ✅ |
| `POST` | `/partner/application/submit` → `pending_verification` + 100m duplicate check | ✅ |

### 12b. Panel — 13/15

| Method | Path | Staff? | Status |
|---|---|---|---|
| `GET` | `/owner/dashboard` — GTV, occupancy %, online vs offline, cancellations | | ✅ |
| `GET` | `/owner/arenas` | ⚬ | ✅ |
| `PATCH` | `/owner/arenas/:publicId` — hours, amenities, policy; blocked if it conflicts with live bookings | | ✅ |
| `POST` | `/owner/arenas/:publicId/courts` | | ✅ |
| `PATCH` | `/owner/courts/:id` — deactivation blocked while committed slots exist | | ✅ |
| `POST` | `/owner/slots/block` — cascades full refunds | ⚬ | ✅ |
| `POST` | `/owner/pricing-rules` — weekday/weekend/holiday/specific-date | | ✅ |
| `GET` | `/owner/pricing-preview` — computed weekly grid before saving | | ✅ |
| `GET` | `/owner/bookings` — `?date=&status=&source=` | ⚬ | ✅ |
| `POST` | `/owner/bookings/offline` — walk-in / phone booking | ⚬ | ✅ |
| `POST` | `/owner/bookings/:id/check-in` — verify the 6-digit code | ⚬ | ✅ |
| `POST` | `/owner/bookings/:id/no-show` — increments `User.noShowCount` | ⚬ | ✅ |
| `GET` `POST` `DELETE` | `/owner/staff` — owner only, desk accounts | | 🟡 `GET` only |
| `GET` | `/owner/settlements` — owner only, payout history + breakdown | | 🔴 |
| `GET` | `/owner/reports/bookings` — CSV export by date range | | 🔴 |

⚬ = accessible to `arena_staff`.

## Models

`Arena` · `Court` · `PricingRule` · `Slot` · `Booking` · `ArenaApplication` · `Settlement` · `User{role:arena_owner|arena_staff}`

## Background jobs

`generateSettlements` — weekly Mon 04:00 IST, T+3, **holds disputed bookings back**.
`nudgeStaleApplications` — daily, follows up abandoned onboarding at day 2 and day 7.

## Where it's built

| Surface | Files | Status |
|---|---|---|
| Backend | [`modules/partner/`](../../../backend/src/modules/partner/) | 13 routes |
| F4.1 landing + apply | [`partner/page.tsx`](../../../web/src/app/partner/page.tsx), [`partner/apply/page.tsx`](../../../web/src/app/partner/apply/page.tsx) | ✅ |
| F4.2 onboarding wizard ⚠️ | — | 🔴 **none of the 7 steps** |
| F4.3 dashboard | [`partner/dashboard/page.tsx`](../../../web/src/app/partner/dashboard/page.tsx) | ✅ |
| F4.4 operations | [`partner/bookings/page.tsx`](../../../web/src/app/partner/bookings/page.tsx), [`booking-table.tsx`](../../../web/src/features/partner/components/booking-table.tsx), [`partner/pricing/page.tsx`](../../../web/src/app/partner/pricing/page.tsx) | 🟡 [`courts`](../../../web/src/app/partner/courts/page.tsx) is a ⬜ stub |
| F4.5 staff & settlements | [`partner/settlements/page.tsx`](../../../web/src/app/partner/settlements/page.tsx) | ⬜ stub |

## The slot pipeline

How a partner's input becomes something a player can book:

```text
Wizard steps 3–6  →  ArenaApplication (draft, not live)
        ↓  ops approves
Arena + Court + PricingRule rows
        ↓  materialiseArenaSlots()  — resolver prices each hour
Slot documents, one per court per hour, 30 days out
        ↓  hourly cron rolls the window forward
GET /arenas/:id/slots  →  player slot grid
```

Implemented in [`slot.service.ts`](../../../backend/src/modules/arenas/slot.service.ts) and
[`pricing.service.ts`](../../../backend/src/modules/arenas/pricing.service.ts). Operating hours
are a **weekly template**, not slots — the cron expands them. Amenities take the short path:
a field on `Arena`, read straight back by the detail endpoint.

**The rule governing every ongoing edit** (§10.4, edge_cases §23): a change must never silently
alter an already-booked slot. Shrinking hours or retiring a court is allowed, but where it
collides with a booked or held slot the API rejects and lists the conflicts, and the owner
cancels those explicitly. Repricing only ever touches **future AVAILABLE** slots.

## Gaps

1. **The onboarding wizard doesn't exist** (F4.2). Without it, every arena must be onboarded by hand — and the launch gate needs **5+ Gomti Nagar arenas**. Manual onboarding of 5 is survivable; it is not a scaling path.
2. **No settlements endpoint or UI** — owners can't see what they're owed, and `generateSettlements` output has no consumer.
3. **Staff accounts are read-only** — `GET /owner/staff` exists, create and delete don't.
4. **No CSV export.**
5. **No UI for the five new management endpoints** — [`partner/courts`](../../../web/src/app/partner/courts/page.tsx) is still a stub and the pricing page has no write path. The API is ready for both.
6. `[verify]` the AC itself: an `arena_staff` session cannot reach settlements or pricing **at the API level**.
7. `[verify]` F4.4's done-when: offline booking entry in ≤ 2 taps from the dashboard.

## Launch-gate ties

- **5+ Gomti Nagar arenas onboarded with verified coordinates** — the single hardest non-code gate.
