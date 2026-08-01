# Phase 1 MVP Roadmap — BoxArena

Milestones and sequencing for the Lucknow MVP. The ordering is deliberate: **money correctness is built and tested before any UI depends on it**, because retrofitting transactional integrity under a finished app is the single most expensive mistake available here.

---

## Roadmap Overview

```mermaid
gantt
    title BoxArena Phase 1 Implementation Schedule
    dateFormat  YYYY-MM-DD
    section Foundation
    Env, config, DB replica set, CI    :m0, 2026-08-01, 4d
    Auth, OTP, sessions, RBAC          :m1, after m0, 6d
    section Backend Core
    Arenas, courts, geo search         :m2, after m1, 6d
    Slots, holds, booking concurrency  :m3, after m2, 8d
    Wallet ledger + Razorpay           :m4, after m3, 8d
    Teams and invites                  :m5, after m2, 5d
    Challenges + escrow                :m6, after m4, 6d
    Score engine + disputes + ELO      :m7, after m6, 8d
    Notifications + cron jobs          :m8, after m7, 5d
    section Mobile
    Flutter base, theme, auth          :f1, after m1, 8d
    Arena discovery + map              :f2, after f1, 7d
    Booking + wallet screens           :f3, after f2, 9d
    Teams, challenges, scoring         :f4, after f3, 10d
    section Web
    Admin: disputes, users, config     :w1, after m7, 8d
    Partner panel: courts, slots       :w2, after w1, 6d
    Public SEO site + leaderboards     :w3, after w2, 6d
    section Launch
    Hardening, load + security test    :l1, after f4, 6d
    Beta with 5 Gomti Nagar arenas     :l2, after l1, 7d
```

---

## Milestone 0 — Foundation

Get the environment right before writing features; several later bugs are unfixable if this is wrong.

1. Three folders: `backend/`, `flutter_app/`, `web/` — the public site, `/partner`, and `/admin` are route groups inside the one Next.js app (`technical_spec.md` §4.3).
2. Copy env files from `env/` (see `env/README.md`). Create all four Maps keys **with restrictions**, plus a billing budget alert.
3. **MongoDB as a replica set** locally — transactions silently no-op on standalone `mongod` and every wallet guarantee disappears.
4. `config/env.ts` — Zod-validated, typed, frozen. Nothing else reads `process.env`. Crash on invalid config.
5. Express app: helmet, CORS allowlist, pino with redaction, `/health` + `/health/ready`, global error handler, graceful SIGTERM.
6. Redis + BullMQ wiring.
7. CI: typecheck → lint → test → build.

**Done when:** the server refuses to boot with a missing secret, and `/health/ready` reports Mongo and Redis.

---

## Milestone 1 — Auth, Sessions, RBAC

1. OTP request/verify: hashed codes, TTL index, attempt caps, dual rate limiting (phone + IP), `OTP_DEV_MODE` for local.
2. JWT access + rotating refresh with **reuse detection** → revoke all sessions on a replayed token.
3. `authMiddleware` (re-reads `role`/`status` from DB) and `requireRole`.
4. Profile CRUD with a strict field whitelist; FCM token register/unregister.
5. Seed the super-admin from `SEED_SUPER_ADMIN_PHONE`.

**Done when:** edge cases 1–11 have passing tests.

---

## Milestone 2 — Arenas, Courts, Geo

1. Arena + Court + PricingRule models; `2dsphere` index on `Arena.location`.
2. `GET /arenas`, `/arenas/nearby` (`$near` with `distanceMeters`), `/arenas/:publicId`.
3. `GeoService` behind an interface; `/geo/autocomplete` and `/geo/reverse` proxied with the **server** key + 30-day Redis cache.
4. Owner endpoints scoped to owned arenas only.
5. Seed 5–10 realistic Lucknow arenas with correct coordinates.

**Done when:** nearby search returns correctly ordered results, and a coordinate-swap test (`[lat,lng]` instead of `[lng,lat]`) is rejected at ingest.

---

## Milestone 3 — Slots & Booking Concurrency

**The hardest correctness work in the project. Do not rush it.**

1. Slot materialisation cron from `operatingHours` → rolling 30 days; never touch booked slots.
2. Pricing resolution: `PricingRule` by priority, falling back to `Court.basePricePerHourPaise`.
3. Two-phase booking: `POST /bookings/hold` (atomic conditional update, all slots or none, sorted order) → `POST /bookings` (confirm).
4. `releaseExpiredHolds` sweeper every 60s.
5. Cancellation with policy-driven refund tiers; arena-initiated cancellation refunds in full.
6. Idempotency middleware backed by Redis.

**Done when:** a test firing 50 parallel bookings at one slot produces exactly 1 success and 49 clean 409s, with no charges on the losers.

---

## Milestone 4 — Wallet & Payments

1. `WalletService`: three buckets, debit order `bonus → deposit → winnings`, conditional `$inc` guards, **never negative**.
2. Every mutation writes a `Transaction` with `balanceAfterPaise` + `idempotencyKey`, in the same session.
3. Razorpay orders; webhook on a **raw-body** route with HMAC verification and event dedupe.
4. Client-callback and webhook paths converge idempotently.
5. `reconcilePayments` cron for stuck orders; `ledgerReconciliation` cron asserting invariants I1/I2.
6. Withdrawals: KYC gate, winnings-only, TDS computation, admin approval queue.

**Done when:** 1,000 randomised operations leave `sum(ledger) == balance` for every bucket, and a webhook replayed 3× credits once.

---

## Milestone 5 — Teams & Invites

Scoped-unique names, roles, size limits by format, token invites with `maxUses`/expiry, captain succession, pseudo-teams for singles. WhatsApp deep link generation.

---

## Milestone 6 — Challenges & Escrow

1. Create challenge on an owned booking; escrow the creator's fee.
2. Open-challenge feed with filters; server-side skill/ELO enforcement.
3. Atomic accept (`status: 'open'` guard) → escrow opponent → create `Match` with a **frozen lineup**.
4. Self-accept and both-sides-same-player checks.
5. `expireUnmatchedChallenges` cron → refund creator.
6. Cancellation and forfeit rules, with the penalty shown before confirming.

---

## Milestone 7 — Scoring, Disputes, ELO

1. `ScoreValidator` per sport. Badminton: 21, win-by-2 after 20-all, cap 30, best-of-3, 2 or 3 games, no draws.
2. **Perspective normalisation before comparison** — `21-18` vs `18-21` from opposite sides is agreement (edge case 56).
3. Settlement in one transaction: status, payout, commission, stats, ELO.
4. `Dispute` with evidence, SLA, admin resolution, mandatory audit note.
5. `autoResolveMatches` (24h single-submission) and `voidStaleMatches` (72h silence) crons.
6. `EloService` from start-of-match snapshots; voided matches don't touch ratings.

**Done when:** the full §5 badminton table and §11 checklist in `edge_cases.md` pass.

---

## Milestone 8 — Notifications & Jobs

`NotificationService` writes the inbox row then multicasts via FCM; prunes dead tokens; respects prefs and quiet hours; **always fires post-commit**. All crons from `api_contract.md` running as a separate worker process.

---

## Milestones F1–F4 — Flutter

- **F1**: theme, `dio` client with single-flight token refresh, `go_router` + deep links, auth screens, onboarding.
- **F2**: arena list, filters, map view with graceful no-permission fallback, arena detail.
- **F3**: slot grid, hold countdown, booking confirmation, wallet with three buckets, Razorpay checkout, transaction history.
- **F4**: teams + WhatsApp invites, challenge feed, create/accept, score entry with client-side pre-validation, match history, leaderboards, notification inbox.

---

## Milestones W1–W3 — Web

- **W1 Admin**: cookie auth, dispute queue with side-by-side submissions and evidence, resolution form, user search/suspend, withdrawal approvals, config editor, reconciliation report, audit log.
- **W2 Partner**: court and hours management, pricing rules, slot blocking, today's bookings, check-in verification, earnings.
- **W3 Public**: arena pages (ISR + schema.org), leaderboards, recent results, player profiles, sitemap.

---

## Launch Gate

Ship only when all of these hold:

```
□ edge_cases.md §11 test checklist fully passing
□ Ledger reconciliation clean for 7 consecutive days on staging
□ Load test: 100 concurrent bookings, zero double-books
□ Security pass: IDOR, rate limits, no secrets in the APK (unzip and grep it)
□ All 4 Maps keys restricted; budget alert firing correctly on a test spike
□ Razorpay webhook verified end-to-end via ngrok, replay-safe
□ DLT template approved; real OTP delivery confirmed on Jio/Airtel/VI
□ ENABLE_PAID_CHALLENGES=false for launch build (see compliance.md §7)
□ Backup restore drill completed
□ 5+ Gomti Nagar arenas onboarded with verified coordinates
```

---

## Phase 2 (not now)

Tournaments and brackets · live scoring · in-app chat · automated payouts · referrals · Hindi · multi-city · arena revenue analytics.
