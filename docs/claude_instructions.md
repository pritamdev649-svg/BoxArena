# Build Prompt Pack — BoxArena

Two ways to use this: the **one-shot backend prompt** (§A), or the **staged sequence** (§B) for more control. Both assume the docs in this repo are in context.

> **Build order:** `tasks.md` is the authoritative backlog and runs **frontend-first** against a mock API. The staged prompts below are grouped backend-then-frontend for readability, but execute them in `tasks.md` order — P0 → F1–F5 → B1–B9 → I1 → M1–M5.

> **Reality check on "one shot":** the backend can realistically be generated in one pass because it's fully specified here. The Flutter app cannot — it's ~40 screens and will exceed any single output. Generate the backend as one unit, then the app feature by feature. The staged prompts in §B are ordered so each stage compiles against the previous one.

> **Two rules that apply to every prompt below.** State them explicitly each time — generated code regresses on both:
> 1. **Feature-based architecture per `code_standards.md`** — feature modules, size budgets, no `any`, boundaries lint-enforced.
> 2. **The UI must not look AI-generated** — `design_system.md §8` has the banned list. No purple gradients, no emoji icons, no icon-in-rounded-square feature grids, no untouched shadcn defaults, no placeholder content.

---

## Context to attach (all of it, in this order)

1. `README.md`
2. `docs/prd.md`
3. `docs/technical_spec.md`
4. `docs/mongodb_schemas.ts`
5. `docs/api_contract.md`
6. **`docs/edge_cases.md`** ← the one that decides whether the output is production-grade
7. `env/backend.env.example`

For UI work also attach `docs/design_system.md`; for the partner flow also attach `docs/arena_onboarding.md`.

---

# §A. One-Shot Backend Prompt

> Build the complete BoxArena backend from the attached specification documents.
>
> **Stack**: Node.js 20, Express 4, TypeScript 5 (strict), Mongoose 8, MongoDB replica set, Redis + BullMQ, Zod, Firebase Admin, Razorpay.
>
> **Non-negotiable rules — apply these everywhere, not just where convenient:**
> 1. All money is **integer paise**. Every money field ends in `Paise`. No floats anywhere.
> 2. The `Transaction` collection is the financial source of truth; `User.wallet.*` is a cache. Every balance change writes a `Transaction` with `balanceAfterPaise` and `idempotencyKey` **inside the same Mongoose session**.
> 3. Every multi-document write touching money uses `withTransaction`. The callback must be idempotent — no notifications or external calls inside it.
> 4. State transitions use atomic conditional updates (`findOneAndUpdate` with the expected status in the filter) and check for `null`. Never read-then-write.
> 5. Layering is strict: `route → validate → auth → controller → service → repository → model`. No Mongoose calls in controllers. Services never touch `req`/`res`.
> 6. Zod `.strict()` at every request boundary; a single Zod-validated `config/env.ts` is the only place that reads `process.env`, and the server crashes on invalid config.
> 7. Every `:id` route verifies ownership. Arena owners see only their arenas; users see only their own bookings and transactions.
> 8. Errors use the `AppError` hierarchy with the machine-readable codes from `api_contract.md`, returned in the standard envelope.
> 9. Notifications are sent **after** the transaction commits.
> 10. URLs use `publicId` (nanoid), never ObjectIds.
>
> **Implement, in this order:**
> - `config/` (env, db, redis, firebase, razorpay, logger), `errors/`, `middlewares/` (auth, requireRole, validate, idempotency, rateLimit, rawBody, errorHandler), `utils/` (money, ids, datetime with IST helpers)
> - All models from `mongodb_schemas.ts`, with every index exactly as specified
> - Repositories, then services: `AuthService`, `GeoService`, `BookingService`, `WalletService`, `PaymentService`, `TeamService`, `ChallengeService`, `MatchService`, `ScoreValidator`, `EloService`, `DisputeService`, `NotificationService`
> - Controllers, validators, and routes for **every** endpoint in `api_contract.md`
> - All background jobs from `api_contract.md §Background Jobs`, as a separate worker entrypoint
> - Seed script: super admin, 8 Lucknow arenas with real coordinates, courts, pricing rules, 30 days of slots
>
> **These specific edge cases must be handled in code — I will check for them:**
> - #12 slot double-booking via atomic guard + unique index on `{courtId, startAt}`
> - #15 multi-hour bookings acquire all slots or none, in sorted order
> - #28 wallet debit order `bonus → deposit → winnings`, splitting into multiple ledger rows
> - #30/#31 Razorpay webhook: raw-body HMAC verification + event-id dedupe
> - #35 challenge accept debits both sides atomically or rolls back
> - #47 concurrent accepts — exactly one wins
> - #54 one-sided score submission auto-resolves after the confirmation deadline
> - #56 **perspective normalisation**: `21-18` from the creator and `18-21` from the opponent are the same result, not a dispute
> - #58 badminton validity: to 21, win-by-2 after 20-all, hard cap 30 (`30-29` legal, `30-28` not), best-of-3, exactly 2 or 3 games, no draws
> - #78 GeoJSON is `[lng, lat]`; validate coordinates fall within India
> - #87 prune FCM tokens that return `UNREGISTERED`
>
> Include `package.json`, `tsconfig.json` (strict), `.eslintrc`, `Dockerfile`, `docker-compose.yml` (Mongo replica set + Redis), and a `README` with setup steps.
>
> Write real implementations — no `// TODO`, no stubbed service methods. If a file would be very long, split it sensibly rather than abbreviating its contents.

**Follow-up prompt once it compiles:**

> Now write the test suite. Use Vitest with `mongodb-memory-server` in **replica-set mode** (transactions no-op otherwise and the wallet tests would pass against broken code). Implement every scenario in `edge_cases.md §11`, especially the concurrency ones — use `Promise.all` with 50 parallel requests and assert exactly one success.

---

# §A2. Frontend Foundation Prompt (run this FIRST — before §A)

Per `tasks.md`, the web app is built first, against a mock API. This prompt covers P0 + F1.

> Set up the BoxArena web app — a **single** Next.js 14 App Router project serving the public site, `/partner`, and `/admin` as route groups (`technical_spec.md §4.3`).
>
> **Architecture — non-negotiable, from `code_standards.md`:**
> - `src/app/` holds **routing only**. No business logic, no data transformation.
> - `src/features/<feature>/{api,components,hooks,types.ts,utils.ts,index.ts}` — features import each other **only** through `index.ts`.
> - `src/shared/{ui,lib,hooks}` — `shared/` never imports from `features/`.
> - Enforce these with `import/no-restricted-paths` and `import/no-cycle` in ESLint, plus `complexity: 10`, `max-lines: 300`, `max-lines-per-function: 50`.
> - `strict: true` + `noUncheckedIndexedAccess`. **`any` is banned.** Parse external data with Zod.
>
> **Build:**
> 1. Tooling: TypeScript strict, ESLint with the above rules, Prettier, husky + lint-staged, CI (typecheck → lint → test → build).
> 2. Design tokens from `design_system.md §2–4` as CSS custom properties in `globals.css`, mapped into `tailwind.config.ts`. Self-host Archivo Expanded + Inter via `next/font`. Global `tabular-nums`, focus-visible ring, `prefers-reduced-motion` block.
> 3. `shared/lib/money.ts` — paise integers → `₹1,23,456.50` with Indian digit grouping. Never floats. Unit-tested.
> 4. `shared/ui/` primitives: Button (4 variants), Input, Select, Chip, Card, Dialog, Sheet, Tabs, Toast, Skeleton, Avatar with monogram fallback, Tooltip, Badge. **Retheme shadcn — do not ship its defaults.** Every primitive needs hover, active, focus, and disabled states.
> 5. Signature components from `design_system.md §5`: ScoreStrip, MatchStatusChip, PrizeBadge, LeaderboardRow.
> 6. The four state components: skeletons matching final geometry, designed empty states with an action, error boundary with retry, offline banner.
> 7. App shell: route groups, `middleware.ts` role gate + `/admin` IP allowlist, path-scoped httpOnly cookie session helpers, strict nonce-based CSP.
> 8. **MSW mock server implementing every endpoint in `api_contract.md`** with exact success/error envelopes, including the failure paths (`SLOT_UNAVAILABLE`, `INSUFFICIENT_BALANCE`, `PRICE_CHANGED`, `CHALLENGE_ALREADY_MATCHED`), artificial latency, and a dev panel to force each error.
>
> **The UI must not look AI-generated.** Read `design_system.md §8` and follow it literally:
> - No purple/violet gradients, no gradient text, no glassmorphism, no `box-shadow` on dark surfaces.
> - No emoji as icons. Lucide at 1.5px stroke, or nothing.
> - No "icon in a rounded square above a bold title and two lines of grey text" feature grids.
> - Not everything is a card — **a card must earn its border**. League tables and score lists use type hierarchy and hairline rules, not containers.
> - Vary spacing rhythm deliberately (4/8/12/24/48/96), never one uniform gap.
> - Use real seed content — real Lucknow areas, plausible Indian names, real turf photos. **No lorem ipsum, no "Team A", no "John Doe".**
> - Tabular numerals on every score, price, and table column.
>
> Deliver Storybook pages for the primitives and signature components so the design can be reviewed in isolation.

---

# §B. Staged Sequence

Use these if you want to review each layer before moving on. Each stage assumes the previous ones exist.

### B1 — Foundation
> Set up the BoxArena backend skeleton per `technical_spec.md §4.1`: `package.json`, strict `tsconfig.json`, ESLint, `app.ts`/`server.ts`, `config/env.ts` (Zod-validated from `env/backend.env.example`, typed and frozen, crashes on invalid config), `config/db.ts` (Mongoose with replica-set-aware connection), `config/redis.ts`, `config/logger.ts` (pino with the redaction list), the `AppError` hierarchy, the global error handler returning the `api_contract.md` envelope, `validateRequest` Zod middleware, `/health` and `/health/ready`, helmet, CORS allowlist, and graceful SIGTERM shutdown. Include `docker-compose.yml` with a MongoDB replica set and Redis.

### B2 — Models
> Implement every Mongoose model from `mongodb_schemas.ts` under `src/models/`, one file each, preserving **every** index, validator, and comment. Include the `2dsphere` indexes, the TTL indexes, the partial unique index on `Team`, and the `Transaction` immutability guard. Then write `utils/money.ts` (paise arithmetic, Indian formatting), `utils/ids.ts` (nanoid `publicId` generation), and `utils/datetime.ts` (UTC ↔ IST, `localDate` derivation).

### B3 — Auth
> Build auth per `api_contract.md §1–2` and `edge_cases.md §1`: OTP request/verify with hashed codes, TTL expiry, attempt caps and dual rate limiting; JWT access + rotating refresh tokens with reuse detection that revokes all sessions; `authMiddleware` re-reading `role`/`status` from the DB; `requireRole`; profile endpoints with a strict whitelist; FCM token management; session listing and logout-all.

### B4 — Arenas & Geo
> Build arenas, courts, and pricing rules per `api_contract.md §3`. Include `/arenas/nearby` using `$near` on the `2dsphere` index returning `distanceMeters`, and a `GeoService` behind an interface that proxies Google Geocoding/Places using the **server** key with a 30-day Redis cache — never expose the key to clients (`edge_cases.md §7`). Validate that ingested coordinates are `[lng, lat]` within India's bounds. Add a seed script with 8 real Lucknow arenas.

### B5 — Booking (the hard one)
> Build the two-phase booking flow per `api_contract.md §4` and `edge_cases.md §2`. `POST /bookings/hold` must acquire all requested slots atomically in sorted `startAt` order using conditional updates, returning 409 `SLOT_UNAVAILABLE` on any loss. `POST /bookings` confirms, charges, and writes booking + transactions in one session. Add the `releaseExpiredHolds` sweeper, cancellation with policy-driven refund tiers, arena-initiated cancellation with full refunds, and Redis-backed idempotency middleware. Then write concurrency tests firing 50 parallel bookings at one slot.

### B6 — Wallet & Payments
> Build `WalletService` and `PaymentService` per `api_contract.md §8–9` and `edge_cases.md §3`. Three buckets with debit order `bonus → deposit → winnings` producing one ledger row per bucket touched; conditional `$inc` guards so balances can never go negative under concurrency; Razorpay order creation; the webhook on a raw-body route with HMAC verification against the unparsed body and dedupe on event id; convergent client-callback and webhook paths; the `reconcilePayments` and `ledgerReconciliation` crons; withdrawals with KYC gate, winnings-only rule and TDS computation.

### B7 — Teams & Challenges
> Build teams and challenges per `api_contract.md §5–6` and `edge_cases.md §6, §4`. Scoped-unique team names, roles, format-based size limits, token invites with `maxUses`/expiry and WhatsApp link generation, captain succession. Then challenges: creation with escrow, the filtered open feed with server-side skill/ELO enforcement, atomic accept creating the `Match` with a frozen lineup, self-accept and same-player-both-sides rejection, the expiry cron, and the cancellation/forfeit rules.

### B8 — Scoring, Disputes, ELO
> Build the scoring engine per `api_contract.md §7` and `edge_cases.md §5` — the heart of the platform. `ScoreValidator` with per-sport rules (badminton: to 21, win-by-2 after 20-all, cap 30, best-of-3, 2 or 3 games, no draws; cricket: wickets ≤ 10, over decimals 0–5; football: draws allowed). **Normalise both submissions to the creator's perspective before comparing** so `21-18` and `18-21` from opposite sides is agreement. Settlement in one transaction covering status, payout, commission, stats and ELO. `Dispute` with evidence, SLA and audited admin resolution. The `autoResolveMatches` (24h) and `voidStaleMatches` (72h) crons. `EloService` computing from start-of-match snapshots, skipping voided matches.

### B9 — Notifications & Admin
> Build `NotificationService` (inbox row first, then FCM multicast, prune `UNREGISTERED` tokens, respect prefs and quiet hours, always post-commit) and every admin and owner endpoint from `api_contract.md §12–13`, each writing an `AuditLog` and enforcing ownership scoping.

### B10 — Flutter base
> Initialize the BoxArena Flutter app per `technical_spec.md §3.2/§4.2`. `flutter create --org com.boxarena box_arena_app`. Build `core/`: a dark theme (dark slate + neon lime accent) in `app_theme.dart`, a `dio` `api_client.dart` with JWT injection and 401 refresh behind a **single-flight mutex** replaying queued requests, an error mapper for the API envelope, `go_router` with deep-link handling including cold start, and shared widgets (`ArenaButton`, `MoneyText` with Indian digit grouping from paise, `LoaderOverlay`, `EmptyState`). Then the auth feature in data/domain/presentation layers with Riverpod: login, OTP, onboarding.

### B11 — Flutter discovery & booking
> Build the arenas and booking features. Arena list with filters and search; map view using the Maps SDK that degrades gracefully when location permission is denied (manual area picker, never a blocking prompt); arena detail with courts, amenities and reviews; the per-court slot grid with booked/blocked states and a live hold countdown; booking confirmation with idempotency key and double-tap protection; the wallet screen showing all three buckets; Razorpay checkout with reconciliation on app relaunch; transaction history.

### B12 — Flutter teams, challenges, scoring
> Build teams (creation, WhatsApp invites, member management), the challenge feed and create/accept flows with the forfeit penalty shown before confirmation, sport-specific score entry with client-side pre-validation mirroring `ScoreValidator`, match history and detail, leaderboards, and the notification inbox.

### B13 — Web app shell + public site
> Create the **single** Next.js 14 web app per `technical_spec.md §4.3` — public site, `/partner`, and `/admin` as route groups in one project. Implement the design system from `design_system.md` first: CSS custom properties in `globals.css` mapped into `tailwind.config.ts`, Archivo Expanded + Inter, global `tabular-nums`, and the focus-ring/reduced-motion rules. Then `middleware.ts` with role gating and the `/admin` IP allowlist, httpOnly path-scoped session cookies, and a strict nonce-based CSP. Then the public surface: landing page with the dual CTA (Book a slot / List your venue), ISR arena pages with schema.org markup, leaderboards, shareable match pages with OG images, player profiles, legal pages, and sitemap.

### B14 — Partner panel + arena onboarding
> Build the arena onboarding flow and partner panel per `arena_onboarding.md` and `api_contract.md §12`. The public 6-field application form, OTP verification, and the 7-step resumable wizard — **step 2 uses Places autocomplete proxied through our backend and requires the owner to drag the map pin to the actual gate and confirm**. Then the partner panel: dashboard with GTV/occupancy/online-vs-offline split, court and operating-hours management, pricing rules with weekday/weekend/holiday bands and a live computed weekly preview, slot blocking with cascading refunds, today's bookings, offline/walk-in booking entry, check-in code verification, no-show marking, desk-staff accounts (owner only), and settlements (owner only). Every route scoped server-side to owned arenas; `arena_staff` restricted to the subset marked in the contract.

### B15 — Admin panel
> Build `/admin` per `api_contract.md §13`: the arena application queue with the ops verification checklist and approve/reject actions, the dispute queue showing both submissions side by side with evidence and an SLA countdown, the resolution form with a mandatory audit note, user search and suspension, the withdrawal approval queue, the settlement approval queue, the runtime config editor, the ledger reconciliation report, and the audit log viewer. Every mutation writes an `AuditLog`; wallet adjustments are `super_admin` only.

---

## Prompting notes

- **Always attach `edge_cases.md`.** Without it you get a working demo; with it you get something you can take money through.
- If output gets truncated, ask for "the remaining files, continuing from `<last file>`" rather than restarting.
- After each stage: `npx tsc --noEmit` and run the tests before moving on.
- When a generated file conflicts with the docs, **the docs win** — say so explicitly and ask for a correction.
- Ask for tests in the same prompt as the feature, not afterwards. Retrofitted tests tend to assert whatever the code already does.
