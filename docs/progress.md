# Progress Tracker — BoxArena

Live status of every task in [`tasks.md`](./tasks.md). One row per task ID, same order.

**Last audited:** 2026-08-01
**Overall: 23.5 / 47 tasks — ~50%**

Per-MVP-feature breakdown: [`mvp/featuredoc/`](./mvp/featuredoc/README.md).

> **How status was determined.** Each row was checked by inspecting files, routes, and
> registered endpoints in the repo — *not* by executing its "done when" assertion.
> A ✅ here means the code exists and looks complete; it does **not** mean the
> done-when test was run and passed. Rows that need a real verification run are
> flagged `[verify]`. Promote a row to ✅ only after you have actually checked its
> done-when, then update the date above.

**Legend:** ✅ done · 🟡 partial · ⬜ stub file only · 🔴 not started

---

## Scoreboard

| Phase | Tasks | Score | % |
|---|---|---|---|
| 0 — Foundation | 4 | 2.0 | 50% |
| 1 — Design system & shell | 5 | 3.0 | 60% |
| 2 — Player web: discovery & booking | 7 | 3.0 | 43% |
| 3 — Player web: compete | 6 | 1.0 | 17% |
| 4 — Partner & admin web | 8 | 4.5 | 56% |
| 5 — Backend | 9 | 6.5 | **72%** |
| 6 — Integration | 3 | 0.5 | 17% |
| 7 — Flutter | 5 | 3.0 | 60% |
| **Total** | **47** | **23.5** | **50%** |

Scoring: ✅ = 1, 🟡 = 0.5, ⬜/🔴 = 0.

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
| P0.3 | Seed content | 🟡 | [`web/src/mocks/seed/`](../web/src/mocks/seed/) (arenas, players), [`backend/src/jobs/seed-data.ts`](../backend/src/jobs/seed-data.ts), [`flutter_app/lib/core/mock/seed_data.dart`](../flutter_app/lib/core/mock/seed_data.dart). `[verify]` 8 arenas w/ real coords + 5 night turf photos. |
| P0.4 | Mock API server ⚠️ | 🔴 | **Not built.** No MSW handlers, no standalone Node mock, no dev error-trigger panel. |

## Phase 1 — Design System & Shell — 3.0 / 5

| ID | Task | Status | Notes |
|---|---|---|---|
| F1.1 | UI primitives | 🟡 | Have: Button, Input, Badge, DataTable, StatTile, PageHero, Logo, ThemeToggle. **Missing: Select, Chip, Card, Dialog, Sheet, Tabs, Toast, Skeleton, Avatar, Tooltip.** No Storybook. |
| F1.2 | Money & date utilities | ✅ | [`money.ts`](../web/src/shared/lib/money.ts) + [`money.test.ts`](../web/src/shared/lib/money.test.ts), [`datetime.ts`](../web/src/shared/lib/datetime.ts). |
| F1.3 | Signature components | ✅ | All four: [`score-strip.tsx`](../web/src/shared/ui/score-strip.tsx), [`match-status-chip.tsx`](../web/src/shared/ui/match-status-chip.tsx), `PrizeBadge` in [`money-text.tsx`](../web/src/shared/ui/money-text.tsx), [`leaderboard-row.tsx`](../web/src/shared/ui/leaderboard-row.tsx). `[verify]` OG-image render. |
| F1.4 | App shell & routing | 🟡 | Routes, header, footer ✅. Role gating via [`panel-auth.ts`](../web/src/shared/lib/panel-auth.ts) in layouts — **no `middleware.ts`**, so the done-when redirect is unproven. |
| F1.5 | State primitives | 🔴 | No skeleton, designed-empty, error-boundary, or offline-banner components anywhere. |

## Phase 2 — Player Web: Discovery & Booking — 3.0 / 7

| ID | Task | Status | Notes |
|---|---|---|---|
| F2.1 | Landing page | ✅ | [`page.tsx`](../web/src/app/page.tsx), 160 lines. `[verify]` Lighthouse ≥ 90. |
| F2.2 | Arena discovery | 🟡 | [`arenas/page.tsx`](../web/src/app/arenas/page.tsx) is only 69 lines + [`arena-card.tsx`](../web/src/features/arenas/components/arena-card.tsx). No map view, no location-denied fallback. |
| F2.3 | Arena detail | ✅ | [`arenas/[slug]/page.tsx`](../web/src/app/arenas/[slug]/page.tsx), 161 lines. |
| F2.4 | Slot grid + hold ⚠️ | 🟡 | [`slot-grid.tsx`](../web/src/features/arenas/components/slot-grid.tsx) exists. `[verify]` live countdown, `PRICE_CHANGED` handling, contiguity guard, 44px targets. |
| F2.5 | Checkout | 🔴 | No route. **Blocks all revenue.** |
| F2.6 | Bookings & receipt | 🔴 | No route. |
| F2.7 | Wallet | 🔴 | No route (backend wallet API is ready). |

## Phase 3 — Player Web: Compete — 1.0 / 6

| ID | Task | Status | Notes |
|---|---|---|---|
| F3.1 | Teams | 🔴 | No route (backend has 7 team endpoints ready). |
| F3.2 | Challenges | 🟡 | Feed at [`challenges/page.tsx`](../web/src/app/challenges/page.tsx) ✅; [`challenges/new`](../web/src/app/challenges/new/page.tsx) is a ⬜ 22-line `ComingSoon` stub. |
| F3.3 | Score entry & confirmation ⚠️ | 🔴 | No route. This is one of the three awkward-state tasks `tasks.md` says to build early. |
| F3.4 | Match history & detail | 🔴 | No route. |
| F3.5 | Leaderboards & profiles | 🟡 | [`leaderboard/page.tsx`](../web/src/app/leaderboard/page.tsx) ✅; no player profile page. |
| F3.6 | Notifications | 🔴 | No route (backend has 3 notification endpoints ready). |

## Phase 4 — Partner & Admin Web — 4.5 / 8

| ID | Task | Status | Notes |
|---|---|---|---|
| F4.1 | Partner landing + application | ✅ | [`partner/page.tsx`](../web/src/app/partner/page.tsx) + [`partner/apply`](../web/src/app/partner/apply/page.tsx) + [`application-form.tsx`](../web/src/features/admin/components/application-form.tsx). |
| F4.2 | Onboarding wizard ⚠️ | 🔴 | **None of the 7 steps exist.** No resumability, no map-pin drag, no live price grid. |
| F4.3 | Partner dashboard | ✅ | [`partner/dashboard`](../web/src/app/partner/dashboard/page.tsx). |
| F4.4 | Partner operations | 🟡 | [`bookings`](../web/src/app/partner/bookings/page.tsx) + [`booking-table.tsx`](../web/src/features/partner/components/booking-table.tsx) ✅, [`pricing`](../web/src/app/partner/pricing/page.tsx) ✅. [`courts`](../web/src/app/partner/courts/page.tsx) is a ⬜ stub. No slot blocking, no 2-tap offline entry, no check-in/no-show. |
| F4.5 | Staff & settlements | 🔴 | [`settlements`](../web/src/app/partner/settlements/page.tsx) is a ⬜ stub; no staff accounts. |
| F5.1 | Admin: application queue | ✅ | [`applications`](../web/src/app/admin/applications/page.tsx) + [detail](../web/src/app/admin/applications/[publicId]/page.tsx) + [`verification-checklist.tsx`](../web/src/features/admin/components/verification-checklist.tsx). |
| F5.2 | Admin: disputes ⚠️ | ✅ | [`admin/disputes`](../web/src/app/admin/disputes/page.tsx), 83 lines. `[verify]` SLA countdown + mandatory audit note. |
| F5.3 | Admin: money & ops | 🔴 | [`users`](../web/src/app/admin/users/page.tsx) and [`audit`](../web/src/app/admin/audit/page.tsx) are ⬜ stubs; no withdrawal queue, settlement approval, reconciliation, or config editor. |

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
| B6 | Wallet + Razorpay + webhooks | 🟡 | [`wallet.integrity.test.ts`](../backend/src/modules/wallet/wallet.integrity.test.ts), [`payment.idempotency.test.ts`](../backend/src/modules/payments/payment.idempotency.test.ts), raw-body webhook route, top-up order + verify. **Withdrawals missing** (`POST /wallet/withdraw`, `GET /wallet/withdrawals`). |
| B7 | Teams, challenges, escrow | 🟡 | teams 7/8 (no `PATCH /teams/:id`); challenges **3/6** — no detail, cancel/forfeit, or `/mine`. |
| B8 | Scoring, disputes, ELO, crons ⚠️ | 🟡 | [`score-validator.ts`](../backend/src/modules/matches/score-validator.ts) + tests, [`elo.service.ts`](../backend/src/modules/matches/elo.service.ts), 4 interval jobs in [`worker.ts`](../backend/src/jobs/worker.ts): `releaseExpiredHolds` (60s), `expireUnmatchedChallenges` (5m), `autoResolveMatches` (15m), `voidStaleMatches` (1h). Matches **3/6** — **players cannot raise a dispute**, no walkover, no 10-min edit. |
| B9 | Notifications, partner, admin, settlements | 🟡 | notifications 3/3, admin 22/22, partner **18/20** — court, hours, amenities, and pricing management now live. **No dedicated settlements module.** |

Endpoints per module: admin 22 · partner 18 · users 9 · arenas 7 · auth 7 · teams 7 · booking 5 · challenges 3 · matches 3 · notifications 3 · payments 3 · wallet 2 · geo 2 · uploads 1 = **92**.

**The ~13 missing endpoints** are concentrated in leaderboards/public (§10 — **0 of 3**),
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

## Phase 7 — Flutter — 3.0 / 5

9 routes: `/`, `/login`, `/register`, `/discover`, `/challenges`, `/wallet`, `/profile`, `/score-entry`, `/create-challenge`.

| ID | Task | Status | Notes |
|---|---|---|---|
| M1 | Base: theme, client, router, widgets | 🟡 | [`app_theme.dart`](../flutter_app/lib/core/theme/app_theme.dart), go_router, Riverpod, Firebase, en/hi localization, shared widgets ✅. Uses **`http`, not `dio`** — `[verify]` single-flight refresh under 10 parallel 401s. |
| M2 | Auth: login, OTP, onboarding | ✅ | [`login_screen.dart`](../flutter_app/lib/features/auth/presentation/login_screen.dart), [`registration_screen.dart`](../flutter_app/lib/features/auth/presentation/registration_screen.dart). `[verify]` 30s resend fallback. |
| M3 | Discovery + booking + wallet + Razorpay | 🟡 | Arena list/detail/info + [`wallet_screen.dart`](../flutter_app/lib/features/wallet/presentation/wallet_screen.dart) with Razorpay handlers wired ✅. **No slot grid, no checkout screen.** |
| M4 | Teams, challenges, scoring, leaderboards | 🟡 | Challenges (list/detail/create) + [`score_entry_screen.dart`](../flutter_app/lib/features/scoring/presentation/score_entry_screen.dart) ✅. **No teams, no match history, no leaderboards.** |
| M5 | Notifications, profile, polish | 🟡 | [`player_profile_screen.dart`](../flutter_app/lib/features/profile/presentation/player_profile_screen.dart) ✅, FCM configured. No notification inbox. `[verify]` no secrets in APK. |

### 🔴 Flutter blocker

**9 screens still read from [`seed_data.dart`](../flutter_app/lib/core/mock/seed_data.dart)**, and
[`api_routes.dart`](../flutter_app/lib/core/constants/api_routes.dart) declares only **6 routes**
against a backend exposing 74. The app is a mock-driven prototype with a live backend it never calls.

Files on mock data: `auth_service.dart`, `arena_detail_screen.dart`, `arena_info_screen.dart`,
`arena_list_screen.dart`, `challenge_detail_screen.dart`, `challenges_screen.dart`,
`create_challenge_screen.dart`, `challenges_provider.dart`, `wallet_screen.dart`.

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

1. **Wire Flutter to the live backend.** Expand `api_routes.dart` to the real surface, replace
   `seed_data` reads with API calls. Highest leverage: unblocks M3–M5 at once and validates 74
   already-built endpoints.
2. **Close the web money loop: F2.5 → F2.6 → F2.7** (checkout → bookings/receipt → wallet).
   The backend for all three is done. Until these ship there is no revenue path on web.
3. **F1.5 state primitives** — small, and every remaining task's DoD depends on it.
4. **F3.3 score entry** — the awkward-state task `tasks.md` explicitly says to build early;
   the server-side validator already exists to mirror.
5. **CI pipeline** (typecheck → lint → test → build) to make P0.1's done-when true.
6. **F4.2 partner onboarding wizard** — required before real turf owners can self-serve.

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
