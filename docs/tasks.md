# Task Backlog — BoxArena

Execution order, **frontend first**. Every task has an ID, dependencies, and a verifiable "done when". If you can't check the done-when, the task isn't finished.

---

## How this order works — and its one risk

Frontend-first works here **because the API contract is already written**. You build the web app against a mock server that implements `api_contract.md` exactly, so the real backend is a drop-in swap: change one base URL, delete the mock.

What you gain: the UX is validated before any service exists, and you have a clickable demo to show Gomti Nagar turf owners in week 2 — which is how you get your first arenas.

**The risk, stated plainly:** the hard part of this product is money correctness and booking concurrency, and frontend-first defers it. Mitigate by building the *awkward* screens early — the slot-hold countdown (F2.4), the score confirmation states (F3.3), and the dispute view (F5.2). Those three encode almost every weird state the backend must produce. If they feel wrong in the UI, the model is wrong, and you want to know that in week 3, not week 10.

**Do not skip B0.1.** The mock server is the contract. If it drifts from `api_contract.md`, integration becomes a rewrite.

```
Phase 0  Foundation + mock API          ~4 days    P0
Phase 1  Design system + shell          ~6 days    F1
Phase 2  Player web flows               ~12 days   F2–F3
Phase 3  Partner + admin web            ~10 days   F4–F5
Phase 4  Backend (contract-first)       ~28 days   B1–B8
Phase 5  Integration + hardening        ~6 days    I1
Phase 6  Flutter app                    ~25 days   M1–M5
```

Phases 3 and 4 can run in parallel with two people. Phase 6 starts once Phase 4 is done.

---

# Phase 0 — Foundation

### P0.1 — Repo & tooling
**Dep:** none
Three folders: `backend/`, `web/`, `flutter_app/`. TypeScript strict per `code_standards.md §4`, ESLint with the import-boundary and complexity rules from §1.4 and §2, Prettier, husky + lint-staged, CI running typecheck → lint → test → build.
**Done when:** a PR that violates a feature-boundary import or exceeds 300 lines fails CI.

### P0.2 — Design tokens
**Dep:** P0.1
Implement `design_system.md §2–4` as CSS custom properties in `globals.css`, mapped into `tailwind.config.ts`. Archivo Expanded + Inter self-hosted via `next/font`. Global `tabular-nums` utility, focus-visible ring, reduced-motion block.
**Done when:** `bg-surface`, `text-volt`, `text-gold` work as utilities; no default shadcn grey remains anywhere.

### P0.3 — Seed content
**Dep:** none
Real content for every mock and fixture: 8 Lucknow arenas with true coordinates and area names, ~40 plausible player names, team names, and 5 licensed/owned turf photos shot at night.
**Done when:** no "Team A", "John Doe", or lorem ipsum exists in the repo (`design_system.md §8.4`).

### P0.4 — Mock API server ⚠️ critical
**Dep:** P0.1, P0.3
MSW (browser) + a standalone Node mock for E2E, implementing **every** endpoint in `api_contract.md` with the exact success and error envelopes. Include the failure paths: `SLOT_UNAVAILABLE`, `INSUFFICIENT_BALANCE`, `PRICE_CHANGED`, `CHALLENGE_ALREADY_MATCHED`, plus artificial latency and a toggle to force errors.
**Done when:** every endpoint responds with contract-shaped data, and you can trigger each error code from a dev panel.

---

# Phase 1 — Design System & Shell

### F1.1 — UI primitives
**Dep:** P0.2
`shared/ui/`: Button (4 variants), Input, Select, Chip, Card, Dialog, Sheet, Tabs, Toast, Skeleton, Avatar (monogram fallback on sport accent), Tooltip, Badge. Retheme shadcn — never ship defaults.
**Done when:** every primitive has hover, active, focus, and disabled states; a Storybook page renders all of them; §8.1 banned list has zero violations.

### F1.2 — Money & date utilities
**Dep:** P0.1
`shared/lib/money.ts` (paise → `₹1,23,456.50` Indian grouping, never floats) and `datetime.ts` (UTC ↔ IST, relative times, slot ranges).
**Done when:** unit tests cover ₹0, ₹0.50, ₹1,23,456.50, and negative amounts.

### F1.3 — Signature components
**Dep:** F1.1
The four from `design_system.md §5`: ScoreStrip, MatchStatusChip, PrizeBadge, LeaderboardRow.
**Done when:** ScoreStrip is legible at 200px wide and renders correctly in an OG image; every status has a distinct chip.

### F1.4 — App shell & routing
**Dep:** F1.1
Route groups `(public)` / `(auth)` / `partner` / `admin`. `middleware.ts` role gate. Header, footer, mobile nav. Path-scoped httpOnly cookie session helpers.
**Done when:** hitting `/admin` unauthenticated redirects to login; a `player` role hitting `/partner` gets 403.

### F1.5 — State primitives
**Dep:** F1.1
Loading skeletons matching final geometry, designed empty states with an action, error boundary with retry, offline banner.
**Done when:** every one of the four states exists as a reusable component. No bare spinners (`§8.1`).

---

# Phase 2 — Player Web: Discovery & Booking

### F2.1 — Landing page
**Dep:** F1.4, P0.3
Dual CTA hero (Book a slot / List your venue), the five-step loop as the differentiator (book → play → score → rank → win), live leaderboard preview, real turf photography.
**Done when:** it passes the §8.7 review test; Lighthouse ≥ 90 on mobile.

### F2.2 — Arena discovery
**Dep:** F1.5, P0.4
List with filters (sport, area, price, amenities), search, sort by distance. Map view via Maps JS API with a graceful manual-area fallback when location is denied.
**Done when:** works fully with location permission denied; distance labelled "km away", never "min away" (`edge_cases.md §85`).

### F2.3 — Arena detail
**Dep:** F2.2
Photo gallery, courts, amenities, per-court hourly pricing, reviews, directions, trust signals.
**Done when:** renders correctly for an arena with 1 photo and no reviews.

### F2.4 — Slot grid + hold ⚠️ awkward-state task
**Dep:** F2.3
Per-court grid by date. States: available, selected, booked, blocked (diagonal hatch), held-by-you with a live countdown. Multi-hour contiguous selection. Handles `SLOT_UNAVAILABLE` and `PRICE_CHANGED` mid-flow.
**Done when:** the countdown expires gracefully and re-fetches; selecting non-contiguous hours is prevented; targets ≥ 44px.

### F2.5 — Checkout
**Dep:** F2.4, F1.2
Price breakdown, coupon, wallet vs gateway, **pay-advance vs pay-at-venue** where the arena allows it, double-tap protection, idempotency key.
**Done when:** the button disables on first tap and a replayed submit shows the original booking.

### F2.6 — Bookings & receipt
**Dep:** F2.5
Upcoming/past lists, detail with check-in code, cancellation with the refund tier shown **before** confirming.
**Done when:** the refund amount displayed matches the policy exactly for each tier.

### F2.7 — Wallet
**Dep:** F1.2, P0.4
Three buckets (deposit/winnings/bonus) with locked shown separately, ledger with filters, top-up sheet, withdrawal with KYC gate.
**Done when:** bonus money is visibly non-withdrawable; the ledger paginates by cursor.

---

# Phase 3 — Player Web: Compete

### F3.1 — Teams
**Dep:** F1.4
Create, roster with roles, WhatsApp invite link generation, join-by-token, captain succession, format-based size limits.
**Done when:** a duplicate team name suggests alternatives instead of erroring.

### F3.2 — Challenges
**Dep:** F3.1, F2.7
Open-challenge feed with filters, create on an owned booking with entry fee and skill band, accept flow with escrow explained, cancel with the **forfeit penalty shown before confirming**.
**Done when:** `CHALLENGE_ALREADY_MATCHED` renders a clean message, not a crash.

### F3.3 — Score entry & confirmation ⚠️ awkward-state task
**Dep:** F3.2, F1.3
Sport-specific entry. Badminton validity mirrored client-side (to 21, win-by-2 after 20-all, cap 30, 2–3 games). All five match states rendered: awaiting yours, awaiting theirs, verified, disputed, voided.
**Done when:** `30-28` is rejected client-side with a clear reason; `30-29` accepted; the "needs your confirmation" state is unmissable.

### F3.4 — Match history & detail
**Dep:** F3.3
Timeline, both submissions when disputed, ELO delta, shareable public match page with OG image.
**Done when:** the OG image renders the score correctly at 1200×630.

### F3.5 — Leaderboards & profiles
**Dep:** F1.3
City and area boards per sport/format, form pills (`W W L W D`), player profile with per-format stats and partner records.
**Done when:** the table uses tabular numerals and needs no cards (`§8.3`).

### F3.6 — Notifications
**Dep:** F1.4
In-app inbox, unread badge, per-type preferences, deep links to the right screen.
**Done when:** every `NotificationType` has a designed row and a working deep link.

---

# Phase 4 — Partner & Admin Web

### F4.1 — Partner landing + application
**Dep:** F2.1
`/partner` pitch answering earnings → cost → effort → who else. The 6-field application form and OTP.
**Done when:** the form submits in under 60 seconds on a mid-range Android.

### F4.2 — Onboarding wizard ⚠️
**Dep:** F4.1
All 7 steps from `arena_onboarding.md §4`, resumable, saving per step. **Step 2 requires dragging the map pin to the gate and confirming.** Step 5 shows a live computed weekly price grid.
**Done when:** closing the browser mid-wizard and returning resumes at the same step; the pin cannot be skipped.

### F4.3 — Partner dashboard
**Dep:** F1.4
GTV, occupancy %, online vs offline split, cancellations, no-shows, next settlement.
**Done when:** it renders sensibly for a brand-new arena with zero bookings.

### F4.4 — Partner operations
**Dep:** F4.3
Court and hours management, pricing rules (weekday/weekend/holiday/specific-date), slot blocking with cascading-refund warning, today's bookings, **offline/walk-in entry in two taps**, check-in verification, no-show marking.
**Done when:** offline booking entry takes ≤ 2 taps from the dashboard (`edge_cases.md §115`).

### F4.5 — Staff & settlements
**Dep:** F4.4
Desk-person accounts (owner only), settlement history with per-booking breakdown.
**Done when:** an `arena_staff` session cannot see settlements or pricing — verified against the API, not just hidden menus.

### F5.1 — Admin: application queue
**Dep:** F1.4
Queue, full application detail, the 8-point ops verification checklist, satellite pin comparison, approve/reject with structured reason.
**Done when:** approving is blocked until every checklist item is ticked.

### F5.2 — Admin: disputes ⚠️ awkward-state task
**Dep:** F1.3
Queue with SLA countdown, both submissions side by side, evidence viewer, resolution form with mandatory audit note, void option.
**Done when:** an overdue dispute is visually unmistakable; resolving without a note is impossible.

### F5.3 — Admin: money & ops
**Dep:** F1.2
User search and suspension, withdrawal queue, settlement approval, ledger reconciliation report, runtime config editor, audit log viewer.
**Done when:** wallet adjustment is `super_admin`-only and requires a reason.

---

# Phase 5 — Backend (contract-first)

Full detail in `phased_roadmap.md` M0–M8 and the staged prompts in `claude_instructions.md §B`. Summarised here for ordering.

| ID | Task | Dep | Done when |
|---|---|---|---|
| **B1** | Foundation: modules layout, Zod env, Mongo replica set, Redis, errors, logging, health, graceful shutdown | P0.1 | Server refuses to boot with a missing secret |
| **B2** | All 23 models with every index, plus money/id/datetime utils | B1 | Indexes verified present; `Transaction` immutability guard fires |
| **B3** | Auth: OTP, rotating refresh with reuse detection, RBAC | B2 | `edge_cases.md §1` tests pass |
| **B4** | Arenas, courts, pricing resolver, geo `$near`, proxied Places | B3 | Coordinate-swap rejected; holiday band beats weekend |
| **B5** | Slots + booking concurrency ⚠️ | B4 | 50 parallel bookings → exactly 1 success, 0 charges on losers |
| **B6** | Wallet ledger + Razorpay + webhooks + reconciliation | B5 | 1000 random ops keep `sum(ledger) == balance`; webhook ×3 credits once |
| **B7** | Teams, challenges, escrow | B6 | Concurrent accepts → exactly one wins |
| **B8** | Scoring, disputes, ELO, auto-resolve crons ⚠️ | B7 | `21-18` vs `18-21` = agreement; `30-28` rejected |
| **B9** | Notifications, partner onboarding, admin, settlements | B8 | Every mutation writes an `AuditLog` |

---

# Phase 6 — Integration

### I1.1 — Swap mocks for the real API
**Dep:** F5.3, B9
Change the base URL, delete MSW handlers, fix contract drift.
**Done when:** every screen works against the real backend with zero component changes. *Any component that needs changing means the mock drifted — record why.*

### I1.2 — E2E
**Dep:** I1.1
Playwright over the five critical flows: book, challenge, score, dispute, payout.
**Done when:** all five pass in CI against a seeded database.

### I1.3 — Hardening
**Dep:** I1.2
Load test 100 concurrent bookings, IDOR sweep, rate-limit verification, Lighthouse, bundle budget, `edge_cases.md §11` checklist.
**Done when:** the launch gate in `phased_roadmap.md` is fully green.

---

# Phase 7 — Flutter

| ID | Task | Done when |
|---|---|---|
| **M1** | Base: theme mirroring `design_system.md`, dio client with single-flight refresh, go_router + deep links, shared widgets | Token refresh under 10 parallel 401s issues exactly one refresh |
| **M2** | Auth: login, OTP, onboarding | Resend fallback appears after 30s |
| **M3** | Discovery + booking: list, map with permission fallback, slot grid, checkout, wallet, Razorpay | Reconciles a payment after the app is killed mid-checkout |
| **M4** | Teams, challenges, score entry, match history, leaderboards | Badminton validation mirrors the server exactly |
| **M5** | Notifications, profile, polish | No secrets in the APK — verified by `unzip` + `grep` |

---

# Pending — Officials Marketplace & Match Money (unscheduled)

Specified 2026-08-02, **not in the phase plan above** and not counted in the 47-task total.
Full spec: [`mvp/featuredoc/11-officials-marketplace.md`](./mvp/featuredoc/11-officials-marketplace.md).

Officials are the third settlement path beside dual-captain agreement and admin dispute
resolution — a neutral scorecard that releases escrow on its own. The money engine ships with
it because an official is a **cost of playing**, and the prize-pool maths cannot be specified
without knowing who charges what.

| ID | Task | Done when |
|---|---|---|
| **OF1** | Official registration: profile, sport, price/match, availability, ID verification, rating | A verified independent official appears in search for their sport and slot |
| **OF2** | Venue lists its own officials during onboarding, bundled or priced separately | A venue with zero officials is flagged ineligible for paid tournaments |
| **OF3** | Official selection at challenge creation + **both-captain confirmation** before lock | A unilateral pick never locks; the second captain's confirm is required |
| **OF4** | Official fee escrowed upfront on confirmation, released on match completion | Default 50/50 split collected from both teams before the match is live |
| **OF5** | `Official` model + `Match.officialId` / per-team confirm flags / `officialType` | `canTriggerPayout` is true **only** for venue_staff and verified independents |
| **OF6** | Edge cases: no agreement → fallback, official no-show, no venue coverage | **Blocked on Q1** — no-show policy is undecided |
| **OF7** | Per-match official assignment across a bracket; `Match.phases[]` per-set entry | A 3-set match records 3 phase rows, each confirmed and timestamped |
| **MM1** | Live cost/prize engine, recalculating as venue/official/entry change | Every figure is computed server-side; a tampered client payload changes nothing |
| **MM2** | Soft warning + suggested minimum when winner profit ≤ ₹0 | **Blocked on Q4** — floor formula unspecified |
| **MM3** | Pre-accept challenge screen: cost table, prize breakdown, win/lose outcomes, confirm checkbox | Accept is disabled until the "I understand I will pay ₹X" box is ticked |
| **MM4** | Challenge fee + commission-rate fields; computed pool fields server-side | |
| **MM5** | Escrow: lock on both teams paying; release on agreement, verified scorecard, or window expiry | **Blocked on Q2** — commission-at-collection vs. the shipped settlement timing |

**Do not start OF6, MM2 or MM5 before their open questions are answered** — each encodes a
money or refund policy that is cheap to decide now and expensive to change once live.

## Badminton live scoring (games_rule/badminton.md)

The reference implementation for every sport: granular log → aggregated set/match record →
confirmation → escrow trigger. Box cricket swaps rallies for balls against the same shape.

| ID | Task | Done when |
|---|---|---|
| **LS1** | Pure rally state machine: 21 / win-by-2 / cap-30, serve, ends changes, best-of-N | A 21-20 set win is unrepresentable, not merely rejected |
| **LS2** | Append-only point log; score derived by replaying it | Undo appends a correction and the mistaken rally is still on the record |
| **LS3** | Scoring API: start, point, undo, event, confirm, read | A retried tap on bad signal does not create a phantom point |
| **LS4** | Live push over the existing authenticated WebSocket | Spectators see the score without touching the source of truth |
| **LS5** | Official's scoring screen — two tap zones, undo, timeout, clock | Usable one-handed, outdoors, at night; 44px floor |
| **LS6** | Both-captain confirmation when the official cannot trigger payout | Escrow moves only on both confirms or dispute-window expiry |

**The reconciliation rule, non-negotiable:** the result derived from the point log is handed
to the existing `validateBadminton` before settling. If the two ever disagree the settle is
refused — two paths to a result that can differ is the exact trust hole officials exist to close.

---

## Definition of Done (every task)

```
□ Meets its "done when"
□ Feature-folder boundaries respected (code_standards.md §1.4)
□ Under the size budgets (§2) — CI enforces
□ No `any`; external data parsed with Zod
□ Loading / empty / error states designed, not defaulted
□ Tests colocated; money and concurrency paths ≥ 95%
□ Real seed content — no placeholders
□ Keyboard navigable, focus rings visible, 44px targets
□ Design review passed (design_system.md §8.7)
□ PR under ~400 lines
```
