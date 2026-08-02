# Progress Tracker — BoxArena

Live status of every task in [`tasks.md`](./tasks.md). One row per task ID, same order.

**Last full audit:** 2026-08-01 · **Partially updated:** 2026-08-04 (withdrawals, partner wizard, Flutter fixture removal)
**Overall: 31.0 / 47 tasks — ~66%**

> The 2026-08-02/04 updates are **not** re-audits. They revise only the rows changed by
> that work — F2.4, F2.5, F2.6, F2.7, F4.2, F4.4, F4.5, F5.3, B6, B9, P0.3, then
> OF1/OF3/OF5/OF7 and the new LS block. Every other row still carries its 2026-08-01
> assessment.

Per-MVP-feature breakdown: [`mvp/featuredoc/`](./mvp/featuredoc/README.md).
**Verified walkthrough of the whole loop: [`end-to-end-flow.md`](./end-to-end-flow.md).**

> **How status was determined.** Each row was checked by inspecting files, routes, and
> registered endpoints in the repo — *not* by executing its "done when" assertion.
> A ✅ here means the code exists and looks complete; it does **not** mean the
> done-when test was run and passed. Rows that need a real verification run are
> flagged `[verify]`. Promote a row to ✅ only after you have actually checked its
> done-when, then update the date above.

**Legend:** ✅ done · 🟡 partial · ⬜ stub file only · 🔴 not started

## MVP scope — decided 2026-08-03

**Three separate scopes.** They are not the same question, and collapsing them
is how a venue owner ends up unable to list the football pitch they own. Each
narrows the one above it, and all three live in
[`sports.ts`](../backend/src/shared/config/sports.ts).

| Scope | Sports | Meaning |
|---|---|---|
| `BOOKABLE_SPORTS` | badminton · cricket · **football** | What a **venue** may list and a player may book. Everything — venues sell the courts they actually have. |
| `CHALLENGE_SPORTS` | **badminton** | What a **competitive challenge** may be posted in. Booking a cricket pitch is fine; staking money on a cricket result is not, because nothing verifies that result to the standard the prize model needs. |
| `LIVE_SCORING_SPORTS` | **badminton** | What an **official** may score rally-by-rally. Cricket's engine is on hold — see [`games_rule/cricket.md`](./games_rule/cricket.md). |

Officials follow **challenge** scope, since they exist to verify staked results.

Nothing is deleted. Football keeps its enum value, validator, tests and seeded
arenas — removing it would orphan the football courts and bookings already in
the database and turn a scope call into a migration. Widening any scope is a
config line.

`GET /public/config` returns all three lists, so every client reads scope from
one place rather than hardcoding a list that drifts.

---

## Scoreboard

| Phase | Tasks | Score | % |
|---|---|---|---|
| 0 — Foundation | 4 | 2.0 | 50% |
| 1 — Design system & shell | 5 | 3.0 | 60% |
| 2 — Player web: discovery & booking | 7 | 6.0 | 86% |
| 3 — Player web: compete | 6 | 2.0 | 33% |
| 4 — Partner & admin web | 8 | 5.0 | 63% |
| 5 — Backend | 9 | 6.5 | **72%** |
| 6 — Integration | 3 | 0.5 | 17% |
| 7 — Flutter | 5 | 3.0 | 60% |
| **Total** | **47** | **28.0** | **60%** |
| *Pending (unscheduled)* | *18* | *14.5* | *81%* |

Scoring: ✅ = 1, 🟡 = 0.5, ⬜/🔴 = 0. The pending row (OF1–OF7, MM1–MM5, LS1–LS6) is
**excluded** from the 47-task total — it is specified, not scheduled.

### Codebase size

| Area | LOC | Files |
|---|---|---|
| `backend/src` | 10,981 | 68 |
| `web/src` | 5,176 | 45 |
| `flutter_app/lib` | 7,041 | 37 |
| `docs/` | 4,302 | 12 md/ts + 49 screenshots |

---

## ⚠️ Order deviation — read this first

`tasks.md` specifies **frontend-first against a mock server**. The project ran
**backend-first** instead. Consequences, both real:

- **P0.4 (the mock server, marked ⚠️ critical) was never built.** `msw` is in
  [`web/package.json`](../web/package.json) as a devDependency but there are zero handlers;
  [`web/src/mocks/`](../web/src/mocks/) holds only seed data.
- **The upside:** the risk `tasks.md` warned about — deferring money correctness and
  booking concurrency — did not materialize. Those are the most finished parts of the repo.
- **The cost:** Flutter has no mock target and no live wiring, so it is stranded on
  hardcoded seeds while a working backend sits unused.

---

## Phase 0 — Foundation — 2.0 / 4

| ID | Task | Status | Notes |
|---|---|---|---|
| P0.1 | Repo & tooling | 🟡 | 3 folders ✅, TS strict ✅, ESLint + Prettier ✅. **No CI, no husky/lint-staged** — the done-when ("a violating PR fails CI") cannot happen. |
| P0.2 | Design tokens | ✅ | 114 CSS custom properties in [`globals.css`](../web/src/app/globals.css); Archivo + Inter via `next/font`. `[verify]` reduced-motion block + focus-visible ring. |
| P0.3 | Seed content | 🟡 | [`web/src/mocks/seed/`](../web/src/mocks/seed/) (arenas, players), [`backend/src/jobs/seed-data.ts`](../backend/src/jobs/seed-data.ts). Flutter's `seed_data.dart` is **deleted** — the app reads the API. `[verify]` 8 arenas w/ real coords + 5 night turf photos. |
| P0.4 | Mock API server ⚠️ | 🔴 | **Not built.** No MSW handlers, no standalone Node mock, no dev error-trigger panel. |

## Phase 1 — Design System & Shell — 3.0 / 5

| ID | Task | Status | Notes |
|---|---|---|---|
| F1.1 | UI primitives | 🟡 | Have: Button, Input, Badge, DataTable, StatTile, PageHero, Logo, ThemeToggle. **Missing: Select, Chip, Card, Dialog, Sheet, Tabs, Toast, Skeleton, Avatar, Tooltip.** No Storybook. |
| F1.2 | Money & date utilities | ✅ | [`money.ts`](../web/src/shared/lib/money.ts) + [`money.test.ts`](../web/src/shared/lib/money.test.ts), [`datetime.ts`](../web/src/shared/lib/datetime.ts). |
| F1.3 | Signature components | ✅ | All four: [`score-strip.tsx`](../web/src/shared/ui/score-strip.tsx), [`match-status-chip.tsx`](../web/src/shared/ui/match-status-chip.tsx), `PrizeBadge` in [`money-text.tsx`](../web/src/shared/ui/money-text.tsx), [`leaderboard-row.tsx`](../web/src/shared/ui/leaderboard-row.tsx). `[verify]` OG-image render. |
| F1.4 | App shell & routing | 🟡 | Routes, header, footer ✅. Role gating via [`panel-auth.ts`](../web/src/shared/lib/panel-auth.ts) in layouts — **no `middleware.ts`**, so the done-when redirect is unproven. |
| F1.5 | State primitives | 🔴 | No skeleton, designed-empty, error-boundary, or offline-banner components anywhere. |

## Phase 2 — Player Web: Discovery & Booking — 6.0 / 7

| ID | Task | Status | Notes |
|---|---|---|---|
| F2.1 | Landing page | ✅ | [`page.tsx`](../web/src/app/page.tsx), 160 lines. `[verify]` Lighthouse ≥ 90. |
| F2.2 | Arena discovery | 🟡 | [`arenas/page.tsx`](../web/src/app/arenas/page.tsx) is only 69 lines + [`arena-card.tsx`](../web/src/features/arenas/components/arena-card.tsx). No map view, no location-denied fallback. |
| F2.3 | Arena detail | ✅ | [`arenas/[slug]/page.tsx`](../web/src/app/arenas/[slug]/page.tsx), 161 lines. |
| F2.4 | Slot grid + hold ⚠️ | ✅ | [`slot-grid.tsx`](../web/src/features/arenas/components/slot-grid.tsx). Continue now takes the hold and routes to checkout; `PRICE_CHANGED` surfaced, contiguity guard, 44px targets, live countdown on checkout. Past/lead-time hours are returned as `past` by the API and rendered unbookable — they were previously offered as `available` and always failed on hold. Hold verified live 2026-08-02. |
| F2.5 | Checkout | ✅ | [`checkout/page.tsx`](../web/src/app/checkout/page.tsx) + [`checkout-panel.tsx`](../web/src/features/booking/components/checkout-panel.tsx). Hold countdown, wallet shortfall guard, pay-at-venue deposit. Idempotent confirm verified live — a replayed key returns the original booking. |
| F2.6 | Bookings & receipt | ✅ | [`bookings/[publicId]/page.tsx`](../web/src/app/bookings/[publicId]/page.tsx) — check-in code, money breakdown. `[verify]` cancel-from-receipt is not built. |
| F2.7 | Wallet | ✅ | [`wallet/page.tsx`](../web/src/app/wallet/page.tsx) — buckets with locked shown separately, top-up (mock path verified end to end: ₹2,250 → ₹3,250), cursor ledger, and a **withdrawal form** gated on KYC + a payout destination, showing TDS and the net figure before you submit. Behind `ENABLE_WITHDRAWALS`.

## Phase 3 — Player Web: Compete — 2.0 / 6

| ID | Task | Status | Notes |
|---|---|---|---|
| F3.1 | Teams | 🔴 | No route (backend has 7 team endpoints ready). |
| F3.2 | Challenges | 🟡 | Feed now reads `GET /challenges` and links each row to the pre-accept screen — it previously paired seed teams with seed arenas by array index. `/challenges/[publicId]` shows the full money breakdown. **[`challenges/new`](../web/src/app/challenges/new/page.tsx) is still a ⬜ stub — no way to create a challenge from the UI.** |
| F3.3 | Score entry & confirmation ⚠️ | 🔴 | No route. This is one of the three awkward-state tasks `tasks.md` says to build early. |
| F3.4 | Match history & detail | 🔴 | No route. |
| F3.5 | Leaderboards & profiles | ✅ | Leaderboard reads the new `GET /leaderboards`; form is derived from settled matches and unplayed rows get `rank: null` rather than a borrowed position. Profiles at `/players/[publicId]` (public) and `/profile` (own, with wallet). |
| F3.6 | Notifications | 🔴 | No route (backend has 3 notification endpoints ready). |

## Phase 4 — Partner & Admin Web — 5.0 / 8

| ID | Task | Status | Notes |
|---|---|---|---|
| F4.1 | Partner landing + application | ✅ | [`partner/page.tsx`](../web/src/app/partner/page.tsx) + [`partner/apply`](../web/src/app/partner/apply/page.tsx) + [`application-form.tsx`](../web/src/features/admin/components/application-form.tsx). |
| F4.2 | Onboarding wizard ⚠️ | 🟡 | [`/partner/onboarding`](../web/src/app/partner/onboarding/page.tsx) — all 7 steps, resumable from `currentStep`, every step validated server-side (was `any`). Phone verification now lands here instead of an empty dashboard. **Step 2 takes typed coordinates, not a draggable pin** — Places Autocomplete + map still need the Maps JS API. Step 5 (bands) is deliberately skippable. |
| F4.3 | Partner dashboard | ✅ | [`partner/dashboard`](../web/src/app/partner/%28panel%29/dashboard/page.tsx). |
| F4.4 | Partner operations | 🟡 | [`bookings`](../web/src/app/partner/%28panel%29/bookings/page.tsx) + [`booking-table.tsx`](../web/src/features/partner/components/booking-table.tsx) ✅, [`pricing`](../web/src/app/partner/pricing/page.tsx) ✅. [`courts`](../web/src/app/partner/%28panel%29/courts/page.tsx) **now built** — courts CRUD, price bands, live weekly preview, slot blocking with an affected-bookings warning. Band → repricing verified live. **Still missing: 2-tap offline entry, check-in/no-show UI** (both have endpoints). |
| F4.5 | Staff & settlements | 🟡 | [`settlements`](../web/src/app/partner/%28panel%29/settlements/page.tsx) + [detail](../web/src/app/partner/%28panel%29/settlements/%5BpublicId%5D/page.tsx) **now built** — payout history, per-booking breakdown, held-for-dispute list, CSV statement. Backed by a new settlements module + hourly `settlementSweep` job. **No staff accounts.** |
| F5.1 | Admin: application queue | ✅ | [`applications`](../web/src/app/admin/%28panel%29/applications/page.tsx) + [detail](../web/src/app/admin/%28panel%29/applications/%5BpublicId%5D/page.tsx) + [`verification-checklist.tsx`](../web/src/features/admin/components/verification-checklist.tsx). |
| F5.2 | Admin: disputes ⚠️ | ✅ | [`admin/disputes`](../web/src/app/admin/%28panel%29/disputes/page.tsx), 83 lines. `[verify]` SLA countdown + mandatory audit note. |
| F5.3 | Admin: money & ops | 🟡 | **[Withdrawal queue](../web/src/app/admin/%28panel%29/withdrawals/page.tsx) built** — approve/reject with a mandatory reason the player reads. [`users`](../web/src/app/admin/%28panel%29/users/page.tsx) and [`audit`](../web/src/app/admin/%28panel%29/audit/page.tsx) are still ⬜ stubs; no settlement approval, reconciliation, or config editor. |

## Phase 5 — Backend — 8.5 / 9 🟢

**92 of ~105 contract endpoints implemented (~88%).** 14 modules registered in [`app.ts`](../backend/src/app.ts).
Per-feature breakdown: [`mvp/featuredoc/`](./mvp/featuredoc/README.md).

| ID | Task | Status | Evidence |
|---|---|---|---|
| B1 | Foundation | ✅ | Zod env, Mongo, Redis, logger, error handler, `/health` + `/health/ready`, graceful shutdown. |
| B2 | All 23 models + utils | ✅ | Exactly **23** models in [`schemas.ts`](../backend/src/models/schemas.ts). `[verify]` index presence + `Transaction` immutability guard. |
| B3 | Auth: OTP, rotating refresh, RBAC | ✅ | 7 routes; [`auth.service.ts`](../backend/src/modules/auth/auth.service.ts). |
| B4 | Arenas, pricing, geo, Places | ✅ | arenas (7) + [`geo`](../backend/src/modules/geo/) (2). |
| B5 | Slots + booking concurrency ⚠️ | ✅ | [`booking.concurrency.test.ts`](../backend/src/modules/booking/booking.concurrency.test.ts). |
| B6 | Wallet + Razorpay + webhooks | 🟡 | [`wallet.integrity.test.ts`](../backend/src/modules/wallet/wallet.integrity.test.ts), [`payment.idempotency.test.ts`](../backend/src/modules/payments/payment.idempotency.test.ts), raw-body webhook route, top-up order + verify. **Withdrawals built** — [`withdrawal.service.ts`](../backend/src/modules/wallet/withdrawal.service.ts): winnings-only, KYC gate, 30% TDS (s.194BA), debited on request so the same rupees cannot be claimed twice, rejection refunds via `WITHDRAWAL_REVERSAL`. Still needs a **payout provider** before the flag can go true in production. |
| B7 | Teams, challenges, escrow | 🟡 | teams 7/8 (no `PATCH /teams/:id`); challenges **3/6** — no detail, cancel/forfeit, or `/mine`. |
| B8 | Scoring, disputes, ELO, crons ⚠️ | 🟡 | [`score-validator.ts`](../backend/src/modules/matches/score-validator.ts) + tests, [`elo.service.ts`](../backend/src/modules/matches/elo.service.ts), 4 interval jobs in [`worker.ts`](../backend/src/jobs/worker.ts): `releaseExpiredHolds` (60s), `expireUnmatchedChallenges` (5m), `autoResolveMatches` (15m), `voidStaleMatches` (1h). Matches **3/6** — **players cannot raise a dispute**, no walkover, no 10-min edit. |
| B9 | Notifications, partner, admin, settlements | 🟡 | **§10 leaderboards/public now 3/3** — `GET /leaderboards`, `/public/matches/recent`, `/public/arenas/:slug`, plus `/public/players/:publicId` (the authed `/users/:publicId` would have 401'd every public ladder row). notifications 3/3, admin 22/22, partner **21/20+** — court, hours, amenities and pricing management live, plus `GET /owner/pricing-rules`. **Settlements module now exists** ([`settlement.service.ts`](../backend/src/modules/settlements/settlement.service.ts)): owner list + detail, weekly rollup, `settlementSweep` job. Payout formula is **provisional — needs sign-off** (see Q2 in [11](./mvp/featuredoc/11-officials-marketplace.md)). **No staff create/delete.** |

Endpoints per module: admin 22 · partner 18 · users 9 · arenas 7 · auth 7 · teams 7 · booking 5 · challenges 3 · matches 3 · notifications 3 · payments 3 · wallet 2 · geo 2 · uploads 1 = **92**.

**The remaining missing endpoints** are concentrated in
challenge cancel + detail (§6), match dispute/walkover/edit (§7), withdrawals (§8), and
staff create/delete + settlements + CSV export (§12b).
Per-feature detail: [`mvp/featuredoc/`](./mvp/featuredoc/README.md).

**B4's pricing resolver is now real.** `PricingRule` was a model nothing read or wrote;
[`pricing.service.ts`](../backend/src/modules/arenas/pricing.service.ts) resolves bands
most-specific-first, and [`slot.service.ts`](../backend/src/modules/arenas/slot.service.ts)
stamps the resolved price at materialisation. A `materialiseSlots` job now rolls the 30-day
window forward hourly — without it, every live arena silently ran out of bookable slots
30 days after approval.

> **Counting note.** An earlier audit reported 74 endpoints; that grep missed route
> definitions whose path sits on a following line. The correct figure is 87. Use the
> multi-line-safe command in *Updating this file* below.

## Phase 6 — Integration — 0.5 / 3

| ID | Task | Status | Notes |
|---|---|---|---|
| I1.1 | Swap mocks for real API | 🟡 | Web already talks to the live backend via [`api.ts`](../web/src/shared/lib/api.ts) (server-side, token stays out of client JS). **Flutter is not wired** — see below. |
| I1.2 | E2E | 🔴 | No Playwright. None of the five critical flows covered. |
| I1.3 | Hardening | 🔴 | No load test, IDOR sweep, rate-limit check, or bundle budget. |

## Pending — specified, not scheduled

Outside the 47-task MVP count above. Recorded so it is tracked rather than remembered.

| ID | Task | Status | Notes |
|---|---|---|---|
| OF1 | Official registration & onboarding | ✅ | Backend + web (`/officials`, `/officials/register`) + Flutter register screen. **No availability calendar, no rating writes.** |
| OF2 | Venue onboarding: list own officials | 🔴 | Extends `arena_onboarding.md` |
| OF3 | Booking flow: pick official, **both captains confirm** before lock | 🟡 | Backend + web picker at `/matches/[id]/official`. **No Flutter screen.** |
| OF4 | Official fee collected upfront, escrowed, released on completion | 🟡 | [`official-fee.service.ts`](../backend/src/modules/officials/official-fee.service.ts) — collect, pay in the settlement transaction, refund on void. Web trigger in the picker. **No Flutter UI.** |
| OF5 | Data model: `Official`, `Match.officialId` + per-team confirmation flags | ✅ | `Official` model; `Match` gains `officialId`, `officialCanTriggerPayout` (snapshotted — Q3 answered), both confirm flags, `bestOf`, `startedAt`/`endedAt`. |
| OF6 | Edge cases: no agreement, official no-show, no coverage at venue | 🟡 | **Q1 decided**: refund in full + fall back to dual-captain. Endpoint built; no button on any client. No-agreement fallback and venue-coverage gating still open. |
| OF7 | Multi-phase brackets: per-match official, per-set `Match.phases[]` | 🟡 | Per-set records exist as `MatchSet`, per-rally as `MatchPoint`. **No bracket/multi-round assignment.** |
| MM1 | Live cost/prize calculation engine at challenge creation | ✅ | [`money.service.ts`](../backend/src/modules/challenges/money.service.ts) + `POST /challenges/quote` + `GET /challenges/:publicId`. Consumed by the web challenge-detail page. |
| MM2 | Creator warning when winner profit ≤ ₹0 + suggested minimum entry fee | ✅ | **Q4 decided** — `E > (V+O) / (N·(N(1−C)−1))`. Warning renders on the breakdown with the break-even figure. |
| MM3 | Challenge details screen with win/lose outcome table + mandatory confirm checkbox | ✅ | `/challenges/[publicId]` — cost table, pool, **if you win / if you lose**, verification status, dispute note, and an unticked checkbox gating Accept. |
| MM4 | Computed pool fields, server-side only | ✅ | Returned by the detail endpoint; the client never computes money. |
| MM5 | Escrow trigger: lock on both teams paying, release on 3 conditions | 🔴 | **Q2 decided** — commission timing follows when each payee is paid: entry at collection, venue at settlement, official at payout. The combined per-team lock (venue + official + entry in one hold) is still not built. |

### Badminton live scoring (games_rule/badminton.md)

| ID | Task | Status | Notes |
|---|---|---|---|
| LS1 | Pure rally state machine — 21 / win-by-2 / cap-30, serve, ends changes, best-of-N | ✅ | [`badminton-engine.ts`](../backend/src/modules/matches/badminton-engine.ts), **23 unit tests**. No I/O — deuce to 24-22, 29-29 cap, decider swap at 11 all covered. |
| LS2 | Append-only point log + set/event logs, score derived by replay | ✅ | `MatchPoint` / `MatchSet` / `MatchEvent`. Undo appends a correction; the mistake stays on the record. |
| LS3 | Scoring API — start, point, undo, timeout/event, confirm, read | ✅ | 7 routes on `/matches/:publicId/live/*`, idempotent per rally, **16 integration tests**. |
| LS4 | Live push over the existing WebSocket | 🟡 | `broadcastToUsers` fires post-commit. Web subscribes via a Zustand store and a one-minute socket-scoped token (`POST /auth/socket-token`); the handshake now rejects anything not `scope: 'socket'`. **Flutter does not subscribe** — needs `web_socket_channel`. |
| LS5 | Official's scoring screen | ✅ | Web `/score/[id]` and Flutter `/score/:id` — court diagram, serve position, umpire call, outcome tags, undo, timeout, clock. Match statistics render under the board on web. |
| LS6 | Both-captain confirmation when the official cannot trigger payout | ✅ | Backend + web `/matches/[id]/confirm` + Flutter confirm screen. Disagreeing raises a dispute. |

**Five of the six open questions are now decided** — see the decisions table in
[`11-officials-marketplace.md`](./mvp/featuredoc/11-officials-marketplace.md). Q2's apparent
collision dissolved: entry, venue and official commissions are three different cuts on three
different pots, and each is taken when that payee is paid. **Q6 remains open and is a legal
question, not an engineering one:** whether the official's fee counts inside the compliance
cap on a match.

---

## Phase 7 — Flutter — 3.0 / 5

Architecture reference: [`flutter_architecture.md`](./flutter_architecture.md).

12 routes: `/`, `/login`, `/register`, `/discover`, `/challenges`, `/wallet`, `/profile`, `/score-entry`, `/create-challenge`.

| ID | Task | Status | Notes |
|---|---|---|---|
| M1 | Base: theme, client, router, widgets | 🟡 | [`app_theme.dart`](../flutter_app/lib/core/theme/app_theme.dart), go_router, Riverpod, Firebase, en/hi localization, shared widgets ✅. Uses **`http`, not `dio`** — `[verify]` single-flight refresh under 10 parallel 401s. |
| M2 | Auth: login, OTP, onboarding | ✅ | [`login_screen.dart`](../flutter_app/lib/features/auth/presentation/login_screen.dart), [`registration_screen.dart`](../flutter_app/lib/features/auth/presentation/registration_screen.dart). `[verify]` 30s resend fallback. |
| M3 | Discovery + booking + wallet + Razorpay | 🟡 | Arena list/detail/info + [`wallet_screen.dart`](../flutter_app/lib/features/wallet/presentation/wallet_screen.dart) with Razorpay handlers wired ✅. **No slot grid, no checkout screen.** |
| M4 | Teams, challenges, scoring, leaderboards | 🟡 | Challenges (list/detail/create) + [`score_entry_screen.dart`](../flutter_app/lib/features/scoring/presentation/score_entry_screen.dart) ✅. **No teams, no match history, no leaderboards.** |
| M5 | Notifications, profile, polish | 🟡 | [`player_profile_screen.dart`](../flutter_app/lib/features/profile/presentation/player_profile_screen.dart) ✅, FCM configured. No notification inbox. `[verify]` no secrets in APK. |

### ✅ Flutter fixtures removed

`seed_data.dart` is **deleted**. Its three model classes moved to
[`core/models/`](../flutter_app/lib/core/models/) with real names, and every screen that
read fixtures now reads the API through a provider.

What that sweep actually found, beyond the eight known files:

| Fabrication | Replaced with |
|---|---|
| `arena.name.hashCode` → total bookings, players, matches | `GET /arenas/:publicId/stats` |
| Four invented match results per venue | `GET /arenas/:publicId/matches` (new) |
| `name.hashCode` → a host's Elo, matches and win rate | `GET /public/players/:publicId` |
| `name.length` → the same numbers on a second screen | the same endpoint |
| Invented teammates padding a squad to its format | only the captain, who is real |
| `SeedData.challenges.length` as the live "open matches" count | the challenge feed |
| A hand-written top-players strip | `GET /leaderboards`, ranked players only |
| A stock Unsplash photo for any venue without one | a placeholder that admits it |
| A 4.0-star default rating for unreviewed venues | 0.0, and the UI says unreviewed |
| Client-side wallet debit on accepting a challenge | the server's escrow lock |

The create-challenge screen was rebuilt around **a booking you already hold**, which is
what the API has always required.

---

## Definition-of-Done gaps (cross-cutting)

The DoD in `tasks.md` applies to *every* task. Three items fail repo-wide:

| DoD item | Status |
|---|---|
| CI enforces size budgets and import boundaries | 🔴 No CI pipeline, no husky/lint-staged |
| Loading / empty / error states designed, not defaulted | 🔴 F1.5 never built, so nothing downstream can satisfy this |
| Tests colocated; money & concurrency ≥ 95% | 🟡 Backend has the money + concurrency tests. **Web has 2 test files total** (`money.test.ts`, `i18n.test.ts`). Flutter has none. |

---

## Next up — recommended order

1. **A payout provider.** Withdrawals are complete end to end except the transfer itself,
   and `ENABLE_WITHDRAWALS` cannot go true in production until money can actually leave.
2. **Maps on wizard step 2.** Typed coordinates work and ops re-checks the pin, but Places
   Autocomplete plus a draggable pin is what stops a venue from geocoding onto the main road
   and never appearing in radius search.
3. **F1.5 state primitives** — small, and every remaining task's DoD depends on it.
4. **CI pipeline** (typecheck → lint → test → build) to make P0.1's done-when true.
5. **Flutter slot grid and checkout** (M3) — the app can discover and challenge, but a
   booking still has to start on web.
6. **F5.3 remainder** — settlement approval, reconciliation, config editor.

---

## Updating this file

Re-audit by checking, in order: route/file presence per task ID → endpoint count →
`ComingSoon` stub sweep (`grep -rl ComingSoon web/src/app`) →
mock-data sweep (`grep -rl seed_data flutter_app/lib`). Then update the scoreboard,
the per-phase tables, the feature docs in [`mvp/featuredoc/`](./mvp/featuredoc/README.md),
and the **Last audited** date at the top.

Count endpoints with this — a plain `grep` undercounts, because many routes put the path
on the line after `.post(`:

```bash
cd backend/src/modules && for d in */; do
  echo "### ${d%/}"
  perl -0777 -ne 'while (/\.(get|post|patch|put|delete)\(\s*[\n\s]*'"'"'([^'"'"']*)'"'"'/gs) { print uc($1), " $2\n" }' $d*.ts | sort -u
done
```

Markdown style note: these docs use compact table separators (`|---|---|`), matching the
rest of `docs/`. If your editor's markdownlint flags MD060, it's a config mismatch, not a defect.
