# API Contract — BoxArena Backend

Base URL: `{API_BASE_URL}/api/v1`

This is the single source of truth shared by the Flutter app, the public Next.js site, and the admin panel. Generate the backend from this, then generate typed clients from it. Do not invent endpoints.

---

## Conventions

**Success**
```json
{ "success": true, "data": { ... }, "meta": { "nextCursor": "..." } }
```

**Error**
```json
{ "success": false, "error": { "code": "SLOT_UNAVAILABLE", "message": "Human readable", "details": [] } }
```

- Money in requests and responses is always **integer paise**, on fields suffixed `Paise`.
- Timestamps are ISO-8601 UTC (`2026-08-14T12:30:00.000Z`).
- IDs in URLs are `publicId` (nanoid), never Mongo ObjectIds.
- Auth: `Authorization: Bearer <accessToken>` (15 min TTL). Refresh via `/auth/refresh` (30 day TTL, rotating).
- Mutating financial endpoints require an `Idempotency-Key: <uuid>` header.
- Lists are cursor-paginated: `?limit=20&after=<cursor>`.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod failure; `details` has field paths |
| `UNAUTHENTICATED` | 401 | Missing/expired access token |
| `TOKEN_REUSE_DETECTED` | 401 | Refresh chain compromised; all sessions revoked |
| `FORBIDDEN` | 403 | Role or ownership check failed |
| `ACCOUNT_SUSPENDED` | 403 | `User.status != active` |
| `APPLICATION_REJECTED` | 403 | User's partner/arena application was rejected |
| `KYC_REQUIRED` | 403 | Withdrawal without verified KYC |
| `GEO_RESTRICTED` | 403 | Paid play blocked in user's state |
| `NOT_FOUND` | 404 | |
| `SLOT_UNAVAILABLE` | 409 | Lost the booking race |
| `CHALLENGE_ALREADY_MATCHED` | 409 | Lost the accept race |
| `PRICE_CHANGED` | 409 | Displayed price is stale; `details.newPricePaise` |
| `INSUFFICIENT_BALANCE` | 409 | `details.shortfallPaise` |
| `CONFIRMATION_WINDOW_CLOSED` | 409 | Score submitted too late |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key, different payload |
| `RATE_LIMITED` | 429 | `Retry-After` header set |
| `INTERNAL_ERROR` | 500 | |

---

## 1. Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/auth/otp/request` | — | `{ phoneNumber }`. Rate-limited 3/15min. Always returns 200 (never reveal whether the number is registered). |
| `POST` | `/auth/otp/verify` | — | `{ phoneNumber, code, deviceId }` → `{ accessToken, refreshToken, user, isNewUser }` |
| `POST` | `/auth/refresh` | — | `{ refreshToken }` → new pair. Rotates + detects reuse. |
| `POST` | `/auth/logout` | ✓ | Revokes the presented refresh token |
| `POST` | `/auth/logout-all` | ✓ | Revokes every session |
| `GET` | `/auth/sessions` | ✓ | Active device list |

## 2. Users

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/users/me` | ✓ | Profile + wallet + KYC status |
| `PATCH` | `/users/me` | ✓ | Whitelist: `fullName, avatarUrl, primarySport, skillLevel, homeAreaName, dateOfBirth, gender, notificationPrefs, monthlyDepositLimitPaise` |
| `POST` | `/users/me/fcm-token` | ✓ | `{ token, platform }`; upsert |
| `DELETE` | `/users/me/fcm-token` | ✓ | On logout |
| `GET` | `/users/me/stats` | ✓ | All `PlayerSportStats` rows |
| `GET` | `/users/:publicId` | ✓ | Public profile: name, avatar, ELO, W/L. **No phone, no wallet.** |
| `POST` | `/users/me/kyc` | ✓ | Submit PAN + document |
| `POST` | `/users/me/bank-account` | ✓ | Requires OTP re-verification |
| `DELETE` | `/users/me` | ✓ | Anonymise; retains ledger (edge case 8) |

## 3. Arenas & Discovery

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/arenas` | — | `?sport=&areaName=&q=&limit=&after=` |
| `GET` | `/arenas/nearby` | — | `?lat=&lng=&radiusKm=5&sport=` → `$near` on the 2dsphere index; includes `distanceMeters` |
| `GET` | `/arenas/:publicId` | — | Detail + courts + amenities + rating |
| `GET` | `/arenas/:publicId/slots` | — | `?date=YYYY-MM-DD&sport=&courtId=` → grouped by court |
| `GET` | `/arenas/:publicId/challenges` | — | `?sport=&limit=` → returns all open challenges hosted at this arena |
| `GET` | `/arenas/:publicId/reviews` | — | Paginated |
| `POST` | `/arenas/:publicId/reviews` | ✓ | Requires a completed booking |
| `GET` | `/geo/autocomplete` | ✓ | **Proxied** Google Places autocomplete (edge case 82) |
| `GET` | `/geo/reverse` | ✓ | Proxied reverse geocode → area name |

## 4. Bookings

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/bookings/hold` | ✓ | `{ slotIds[], expectedTotalPaise }` → holds atomically, returns `holdExpiresAt`. 409 on race or price change. |
| `POST` | `/bookings` | ✓ + Idem | `{ holdId, couponCode?, paymentMode: 'wallet'\|'gateway' }` → confirms |
| `GET` | `/bookings` | ✓ | `?status=&upcoming=true` |
| `GET` | `/bookings/:publicId` | ✓ | Owner or arena owner only |
| `POST` | `/bookings/:publicId/cancel` | ✓ | Applies refund tier; cascades to challenge |
| `POST` | `/bookings/:publicId/check-in` | ✓ | Arena owner verifies `checkInCode` |

## 5. Teams

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/teams` | ✓ | `{ name, sport, format, logoUrl? }` |
| `GET` | `/teams/mine` | ✓ | |
| `GET` | `/teams/:publicId` | — | Public team page |
| `PATCH` | `/teams/:publicId` | ✓ captain | |
| `POST` | `/teams/:publicId/invites` | ✓ captain | `{ maxUses?, expiresInHours? }` → `{ token, whatsappUrl, deepLink }` |
| `POST` | `/teams/invites/:token/accept` | ✓ | Validates uses/expiry/size |
| `DELETE` | `/teams/:publicId/members/:userPublicId` | ✓ captain | Blocked during live challenge |
| `POST` | `/teams/:publicId/leave` | ✓ | Handles captain succession |

## 6. Challenges

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/challenges` | ✓ + Idem | `{ bookingId, teamId, entryFeePaise, skillFilter?, notes? }`. Escrows creator's fee. |
| `GET` | `/challenges` | ✓ | Open feed: `?sport=&areaName=&maxEntryFeePaise=&date=&arenaPublicId=` |
| `GET` | `/challenges/:publicId` | ✓ | |
| `POST` | `/challenges/:publicId/accept` | ✓ + Idem | `{ teamId }`. Atomic; escrows opponent; creates the `Match`. |
| `POST` | `/challenges/:publicId/cancel` | ✓ | Pre-match: full refund. Post-match: forfeit rules (edge case 48). |
| `GET` | `/challenges/mine` | ✓ | |

## 7. Matches & Scoring

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/matches/mine` | ✓ | `?status=` |
| `GET` | `/matches/:publicId` | ✓ | Participants see submissions; public sees final only |
| `POST` | `/matches/:publicId/score` | ✓ + Idem | `{ score, claimedWinnerTeamId }`. Validates sport rules, normalises perspective, compares, and settles — all in one transaction. |
| `PATCH` | `/matches/:publicId/score` | ✓ | Edit within 10 min, only if opponent hasn't submitted |
| `POST` | `/matches/:publicId/dispute` | ✓ | `{ reason, description, evidenceUrls[] }` |
| `POST` | `/matches/:publicId/walkover` | ✓ | Claim opponent no-show |

## 8. Wallet

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/wallet` | ✓ | Three buckets + locked |
| `GET` | `/wallet/transactions` | ✓ | `?type=&from=&to=`, cursor paginated |
| `POST` | `/wallet/topup/order` | ✓ + Idem | `{ amountPaise }` → Razorpay order |
| `POST` | `/wallet/topup/verify` | ✓ | Client callback; idempotent with the webhook |
| `POST` | `/wallet/withdraw` | ✓ + Idem | KYC-gated; winnings only; computes TDS |
| `GET` | `/wallet/withdrawals` | ✓ | |

## 9. Webhooks (no auth — signature verified)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/webhooks/razorpay` | **Raw body parser.** HMAC-SHA256 verify, dedupe on event id, then process. Return 200 fast; do heavy work async. |

## 10. Leaderboards & Public

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/leaderboards` | — | `?sport=&format=&areaName=&period=all\|month` |
| `GET` | `/public/matches/recent` | — | For the Next.js SEO site |
| `GET` | `/public/arenas/:slug` | — | SEO arena page |

## 11. Notifications

| Method | Path | Auth |
|---|---|---|
| `GET` | `/notifications` | ✓ |
| `POST` | `/notifications/:id/read` | ✓ |
| `POST` | `/notifications/read-all` | ✓ |

## 12. Arena Onboarding & Partner Panel

Full flow and rationale: `arena_onboarding.md`.

### 12a. Application (public → owner)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/partner/apply` | — | 6-field lead. Creates `ArenaApplication`, no account yet |
| `POST` | `/partner/apply/:publicId/verify-phone` | — | OTP → creates `User{role:arena_owner,status:pending}` |
| `GET` | `/partner/application` | ✓ | Resume in-progress wizard |
| `PATCH` | `/partner/application/step/:n` | ✓ | Save step 1–7; each saves independently |
| `POST` | `/partner/application/submit` | ✓ | → `pending_verification`; runs the 100m duplicate check |

### 12b. Partner panel (`role: arena_owner` \| `arena_staff`)

Every route scoped to arenas the caller owns or is employed at — enforced in the **service layer**, not the controller. Staff are restricted to the rows marked ⚬.

| Method | Path | Staff? | Notes |
|---|---|---|---|
| `GET` | `/owner/dashboard` | | GTV, occupancy %, online vs offline split, cancellations |
| `GET` | `/owner/arenas` | ⚬ | |
| `PATCH` | `/owner/arenas/:publicId` | | Blocked if the change conflicts with live bookings |
| `POST` | `/owner/arenas/:publicId/courts` | | |
| `PATCH` | `/owner/courts/:id` | | |
| `POST` | `/owner/slots/block` | ⚬ | `{courtId, from, to, reason}`; cascades full refunds |
| `POST` | `/owner/pricing-rules` | | Supports weekday/weekend/**holiday**/specific-date bands |
| `GET` | `/owner/pricing-preview` | | Computed weekly grid before saving |
| `GET` | `/owner/bookings` | ⚬ | `?date=&status=&source=` |
| `POST` | `/owner/bookings/offline` | ⚬ | Record a walk-in/phone booking so we don't double-book |
| `POST` | `/owner/bookings/:id/check-in` | ⚬ | Verify the 6-digit code |
| `POST` | `/owner/bookings/:id/no-show` | ⚬ | Increments `User.noShowCount` |
| `GET` | `/owner/staff` \| `POST` \| `DELETE /:id` | | Owner only — desk person accounts |
| `GET` | `/owner/settlements` | | Owner only — payout history + booking breakdown |
| `GET` | `/owner/reports/bookings` | | CSV export by date range |

## 13. Admin Panel (`role: admin` / `super_admin`)

Every mutation writes an `AuditLog`.

| Method | Path |
|---|---|
| `GET` | `/admin/disputes` — `?status=&overdue=true` |
| `GET` | `/admin/disputes/:id` — both submissions side by side + evidence |
| `POST` | `/admin/disputes/:id/assign` |
| `POST` | `/admin/disputes/:id/resolve` — `{ winnerTeamId? , isVoided, finalScore?, adminNote }` |
| `GET` | `/admin/users` — search |
| `POST` | `/admin/users/:id/suspend` — `{ reason }` |
| `POST` | `/admin/users/:id/wallet-adjust` — `super_admin` only, reason mandatory |
| `GET` | `/admin/withdrawals` — approval queue |
| `POST` | `/admin/withdrawals/:id/approve` \| `/reject` |
| `GET` | `/admin/applications` — `?status=` arena onboarding queue |
| `GET` | `/admin/applications/:id` — full detail + verification checklist |
| `PATCH` | `/admin/applications/:id/verification` — tick checklist items |
| `POST` | `/admin/applications/:id/approve` — creates Arena + Courts + PricingRules, materialises slots |
| `POST` | `/admin/applications/:id/reject` — structured reason |
| `GET` | `/admin/settlements` \| `POST /admin/settlements/:id/approve` |
| `GET` | `/admin/reconciliation` — ledger-vs-balance drift report |
| `GET` | `/admin/config` \| `PATCH /admin/config/:key` — `super_admin` only |
| `GET` | `/admin/audit-logs` |

---

## Background Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `releaseExpiredHolds` | every 60s | Frees abandoned checkout slots |
| `expireUnmatchedChallenges` | every 5 min | Refunds creator escrow |
| `autoResolveMatches` | every 15 min | Applies the confirmation deadline (edge case 54) |
| `voidStaleMatches` | hourly | 72h no-submission → refund both |
| `reconcilePayments` | every 15 min | Razorpay orders stuck in `created`/`attempted` |
| `materialiseSlots` | daily 02:00 IST | Rolling 30-day slot window |
| `ledgerReconciliation` | daily 03:00 IST | Invariants I1/I2; freeze + page on drift |
| `slotReminders` | every 10 min | "Your match is in 2 hours" |
| `pruneFcmTokens` | weekly | Drop tokens that returned `UNREGISTERED` |
| `generateSettlements` | weekly Mon 04:00 IST | Arena payouts, T+3, holding disputed bookings |
| `nudgeStaleApplications` | daily | Follow up abandoned onboarding at day 2 and 7 |
