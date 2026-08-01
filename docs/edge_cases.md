# Edge Cases & Failure Modes — BoxArena

> **This is the most important document in the repo.** The PRD says what to build; this says what breaks. Every rule below maps to a field in `mongodb_schemas.ts` or an endpoint in `api_contract.md`.
>
> Treat each numbered rule as an acceptance criterion. If the generated code does not handle it, the feature is not done.

---

## 0. Global Invariants

These must hold at all times. Assert them in tests.

| # | Invariant |
|---|---|
| I1 | `sum(Transaction.amountPaise where userId=U, bucket=B)` == `User.wallet.<B>Paise` |
| I2 | `User.wallet.lockedPaise` == sum of `entryFeePaise` across all challenges where U is a participant and status ∈ {matched, locked} |
| I3 | No two `Booking`s (status ∈ {confirmed, pending_payment}) share a `slotId` |
| I4 | Every `Match` in `verified` state has exactly one `winnerTeamId` OR `isDraw = true` |
| I5 | Escrowed money is never in two places: for any challenge, `held == refunded + paid_out + commission` once terminal |
| I6 | No money field anywhere is a non-integer |

**Reconciliation job** (nightly, `03:00 IST`): recompute I1 and I2 from the ledger. On any drift → freeze the affected account (`status=suspended`), page ops, write `AuditLog`. Never auto-correct silently.

---

## 1. Authentication & Identity

1. **OTP brute force.** Max 5 verify attempts per OTP, then invalidate. Max 3 OTP *sends* per phone per 15 min, 10 per day. Rate-limit by phone **and** by IP — one attacker with a SIM farm defeats phone-only limits.
2. **OTP never stored plaintext.** Store `sha256(code + OTP_PEPPER)`. Compare in constant time.
3. **OTP is single-use.** Set `consumedAt` inside the same transaction as token issuance. A replayed OTP must fail even if it hasn't expired.
4. **SMS delivery failure.** If the provider returns an error, do not create a "sent" state the user can't escape. Show a "Resend via call" fallback after 30s.
5. **Same phone, new device.** Logging in on device B must not silently kill device A's session. Track sessions in `RefreshToken` and show a device list.
6. **Refresh token rotation + reuse detection.** Each refresh issues a new token and sets `replacedByTokenHash` on the old one. If a *already-replaced* token is presented, the chain is compromised → revoke **all** sessions for that user.
7. **Phone number recycling.** Indian telcos reassign numbers after ~90 days of inactivity. If an account has `winningsPaise > 0` and hasn't logged in for 180 days, require KYC re-verification before payout — you may be talking to a different human.
8. **Account deletion vs. financial records.** A "delete my account" request must anonymise PII (`fullName` → "Deleted User", null the phone, keep a salted hash for dedupe) but **retain** `Transaction` rows. Tax law requires it.
9. **JWT contains role — but never trust it alone for money.** Re-read `User.status` and `User.role` from the DB on any privileged or financial route. A JWT issued before a suspension is still cryptographically valid.
10. **Clock skew on token expiry.** Allow 60s leeway on `exp` validation.
11. **Under-18 users.** If `dateOfBirth` puts them under 18, block all paid challenges and withdrawals. Free bookings are fine.

---

## 2. Slots, Booking & Concurrency

This is where the money bugs live.

12. **The double-booking race.** Two users tapping "Book" on the same slot within 50ms. The unique index `{courtId, startAt}` on `Slot` is the last line of defence, but the *first* is an atomic conditional update:
    ```js
    Slot.findOneAndUpdate(
      { _id: slotId, status: 'available' },   // <-- the guard
      { $set: { status: 'held', heldByUserId, holdExpiresAt }, $inc: { version: 1 } },
      { new: true, session }
    )
    ```
    If this returns `null`, someone else won. Return `409 SLOT_UNAVAILABLE`. **Never** do read-then-write.
13. **Abandoned checkout.** User holds a slot then force-quits the app. `holdExpiresAt` (default 5 min) + a sweeper job every 60s releases it. Do not rely on the client to release.
14. **Hold expiry mid-payment.** User's Razorpay payment succeeds at T+6min, after the hold lapsed and someone else booked. → Auto-refund to wallet, notify, apologise. Never overbook. Mitigate by extending the hold to 15 min once a `PaymentOrder` is `attempted`.
15. **Multi-hour bookings must be atomic.** Booking 18:00–21:00 = 3 slot documents. Acquire **all** or none, inside one MongoDB session. Acquire in sorted `startAt` order to prevent deadlock between two users grabbing overlapping ranges from opposite ends.
16. **Booking a past slot.** Reject anything with `startAt <= now`. Also reject bookings less than `MIN_BOOKING_LEAD_MINUTES` (default 30) ahead — the arena needs prep time.
17. **DST / timezone.** India has no DST, so this is latent — but store `startAt` in UTC and derive `localDate` with an explicit `Asia/Kolkata` conversion. Never build times by string concatenation. A user in Dubai browsing Lucknow arenas must see IST slot times.
18. **Midnight-crossing slots.** A 23:00–00:00 slot has `endAt` on the *next* calendar day. `localDate` follows `startAt`. Query by range on `startAt`, not by string equality on a date field.
19. **Arena cancels after booking.** Rain, maintenance, power cut. Owner marks the slot `blocked` → all affected bookings auto-refunded **in full** regardless of the cancellation policy (arena fault ≠ user fault), plus the arena eats the convenience fee. Notify every affected user.
20. **Cancellation refund tiers.** Compute from `Arena.cancellationPolicy` against `startAt`, not against booking creation time. Free cancellation ≥ N hours out; `partialRefundPercent` inside the window; **zero** refund after `startAt`.
21. **Cancelling a booking that backs a challenge.** Must cascade: cancel the challenge, refund both escrows, notify the opponent. Block cancellation entirely once the challenge is `locked`.
22. **Slot materialisation.** Generating slots forever is unbounded storage. Materialise a rolling 30-day window via a daily cron. Handle the case where an owner changes `operatingHours` — regenerate only *future, unbooked* slots. Never delete a slot that has a booking.
23. **Owner shrinks operating hours over an existing booking.** Reject the change with a list of conflicting bookings; make the owner cancel them explicitly (which triggers rule 19).
24. **Price changed between "view" and "book".** Client sends the `pricePaise` it displayed. If it no longer matches the server's, return `409 PRICE_CHANGED` with the new price and make the user re-confirm. Never silently charge more.
25. **Idempotency.** Every booking POST carries a client-generated `Idempotency-Key`. Replaying it returns the *original* booking, not a second one. Covers flaky-network double-taps.
26. **Overlapping slots at the same court.** If an owner ever configures 30-min and 60-min grids on one court, the unique index won't catch a partial overlap. Enforce a single `slotDurationMinutes` per court, or add an explicit overlap check.

---

## 3. Wallet, Payments & Escrow

27. **Insufficient balance.** Check `spendable = deposit + winnings + bonus` minus nothing (locked is already excluded from the buckets — it moves out on hold). Reject with the exact shortfall so the UI can prefill a top-up.
28. **Debit ordering.** Always `bonus → deposit → winnings`. This maximises what stays withdrawable for the user and is the industry norm. A single entry fee may split across buckets → that's **multiple** `Transaction` rows, one per bucket.
29. **Bonus money is never withdrawable.** Enforce at the withdrawal endpoint, not just in the UI.
30. **Razorpay webhook replay.** Razorpay retries on non-2xx and can deliver duplicates. Dedupe on `webhookEvents.eventId`. Credit the wallet only if `PaymentOrder.status !== 'paid'`, inside a transaction.
31. **Webhook signature verification is mandatory.** `hmac_sha256(body, RAZORPAY_WEBHOOK_SECRET)`. Verify against the **raw** body — parsing to JSON and re-stringifying changes the bytes and breaks the HMAC. Mount a raw-body parser on that route only.
32. **Webhook arrives before the client callback.** Both paths credit the wallet; both must be idempotent and converge on the same `Transaction`.
33. **Payment succeeded, our server was down.** Reconciliation job: every 15 min, fetch Razorpay orders in `created`/`attempted` older than 10 min and reconcile against the provider API. Money must never be stuck.
34. **Partial/failed refunds.** Razorpay refunds are async. Model `withdrawal_reversal` and re-credit only on the refund webhook, not optimistically.
35. **Escrow on challenge accept.** Debit **both** sides in one transaction at accept time. If the opponent's debit fails, the creator's hold must roll back. This is exactly what MongoDB sessions are for — no manual compensation logic.
36. **Prize pool math.** `prizePool = (2 × entryFee) − commission`. Commission is computed and stored at *accept* time, not at payout — a config change mid-match must not alter an in-flight contract.
37. **Rounding.** Commission of 10% on ₹150 entry = 1500 paise exactly. But 7% of 33300 = 2331. Always `Math.floor` the commission and give the remainder to the winner. Never let rounding create paise from nothing (violates I5).
38. **Negative balance is impossible.** `min: 0` on the schema plus a guarded `$inc` with a `$gte` filter. If you ever see a negative balance, it's a bug in a non-transactional path.
39. **Concurrent debits from one wallet.** User accepts two challenges simultaneously with just enough for one. Use a conditional update: `updateOne({_id, 'wallet.depositPaise': {$gte: amt}}, {$inc: {'wallet.depositPaise': -amt}})` and check `modifiedCount`.
40. **Withdrawal while funds are locked.** Only `winningsPaise` is withdrawable, and only the unlocked portion. Create the `WithdrawalRequest` **and** debit in one transaction, so the user can't request twice.
41. **Withdrawal rejected by admin.** Must re-credit `winningsPaise` via a `withdrawal_reversal` row. Never edit the original row.
42. **TDS (s.194BA).** 30% on net winnings at withdrawal and at financial-year end. Compute from `net winnings = total withdrawals + closing balance − total deposits − opening balance`. Store `tdsPaise` on the request. Get this reviewed by a CA before launch.
43. **Deposit limits.** Enforce `monthlyDepositLimitPaise` if the user set one. Responsible-gaming requirement.
44. **Mock payments must be impossible in production.** `ENABLE_MOCK_PAYMENTS` defaults to `false` and the server refuses to boot if it is `true` while `NODE_ENV=production`.

---

## 4. Challenges & Matchmaking

45. **Accepting your own challenge.** Reject. Also reject if any user appears in both lineups (alt accounts colluding to launder money — a real RMG attack).
46. **Challenge never matched.** `matchExpiresAt` (default: slot `startAt` minus 60 min). Sweeper cancels it, refunds the creator's escrow in full, and offers to keep the booking as a normal casual booking.
47. **Two users accept simultaneously.** Atomic guard: `findOneAndUpdate({_id, status: 'open'}, {$set: {status: 'matched', ...}})`. Loser gets `409 CHALLENGE_ALREADY_MATCHED`.
48. **Creator cancels after match.** Not allowed unilaterally once `matched`. Either mutual cancel (both agree → full refund both) or forfeit (canceller loses entry fee to the opponent, minus commission). Make the penalty explicit in the UI **before** they confirm.
49. **Team size mismatch.** Badminton doubles requires exactly 2 active members per side at accept time. Validate; don't discover it at score entry.
50. **A player leaves the team between accept and match.** Freeze the lineup into `Match.lineup` at accept time. Roster changes afterwards don't affect this match.
51. **Skill filter bypass.** Validate `skillFilter` / ELO band server-side. A modified client will send whatever it wants.
52. **Entry fee bounds.** Clamp to `min_entry_fee_paise` / `max_entry_fee_paise` from `AppConfig`. A ₹0 challenge is legal (friendly); a ₹50,000 one is not, at MVP.
53. **Geo-restriction.** Real-money gaming is restricted or banned in several Indian states. Read `blocked_states` from `AppConfig` and check at *challenge creation and accept* time using the user's registered state. Free bookings stay available everywhere. **Get legal advice before enabling paid challenges.**

---

## 5. Score Entry, Verification & Disputes

54. **Only one side submits, ever.** The most common real-world case — the loser just closes the app. `confirmationDeadline` (default 24h after `scheduledAt`). On expiry, auto-accept the submitted score, mark `admin_resolved` with a system note, and pay out. Notify the silent side twice before the deadline.
55. **Neither side submits.** After 72h, void the match, refund both escrows, mark `voided`. Don't hold money indefinitely.
56. **Scores match → verify.** Compare *normalised* payloads (sort games by `gameNumber`, coerce types). `21-18` from one side and `18-21` from the other describe the same game from opposite perspectives — **normalise to the creator's frame before comparing.** This is the #1 subtle bug in dual-confirmation systems.
57. **Scores mismatch → dispute.** Create a `Dispute`, hold escrow, notify both + admins, set `slaDueAt = now + 48h`.
58. **Badminton validity rules.** Reject at the API boundary:
    - A game ends at 21 **unless** tied at 20-all, then win-by-2, hard cap 30 (so `30-29` is legal, `30-28` is not).
    - Winner's score must be ≥ 21 (or exactly 30).
    - Loser's score < winner's score.
    - Best-of-3: exactly 2 or 3 games. Never 1, never 4.
    - If 2 games, the same side won both. If 3, the sides split the first two.
    - A "draw" is impossible in badminton — reject `isDraw` for this sport.
59. **Cricket validity.** `wickets` ≤ 10 (or team size − 1 for box cricket). `overs` decimal part must be 0–5 (12.6 is not a thing). Runs ≥ 0. Ties are possible → refund both, or super-over if configured.
60. **Football.** Goals ≥ 0. Draws are legal → split the pot minus commission, or refund both (pick one and document it; refund-both is friendlier at MVP).
61. **Score submitted before the match started.** Reject anything submitted before `scheduledAt`.
62. **Late submission.** After `confirmationDeadline`, reject with a clear "the window closed" error rather than silently accepting.
63. **Editing a submission.** Allowed only while the other side hasn't submitted, and only within 10 minutes. Every edit writes an `AuditLog`.
64. **Non-participant submits a score.** Verify `byUserId` is in `Match.lineup` for `byTeamId`. Captains only, at MVP.
65. **Admin resolves a dispute.** Must set winner *or* void. Writes `AuditLog` with a mandatory `adminNote`. Payout and status flip happen in one transaction. An admin cannot resolve a dispute they are a participant in.
66. **Double payout.** Guard payout on `status !== 'verified'` inside the transaction. `Match.payoutTransactionIds` being non-empty is a second check.
67. **Walkover.** One side confirms opponent no-show, uploads evidence, and after the deadline with no counter-claim → award the walkover. Repeat no-shows (3 in 30 days) → auto-suspend.
68. **ELO update ordering.** Compute ELO *after* the match is terminal, from the ratings snapshotted at match start (`eloDelta.before`), not live ratings — otherwise two matches settling concurrently corrupt each other. Store both before and after.
69. **Voided match must not touch ELO or stats.**

---

## 6. Teams & Invites

70. **Duplicate team names.** Unique per `{slug, sport}` for real teams only. Suggest alternatives on collision, don't 500.
71. **Invite link forwarded to a WhatsApp group.** `maxUses` + `expiresAt` on the token. Default `maxUses = 1` for direct invites, higher for a shareable link the captain generates explicitly.
72. **Joining a full team.** Enforce max size by sport/format (doubles = 2, box cricket = 8–12).
73. **Captain leaves.** Auto-promote the longest-tenured vice-captain, else the oldest member. If they were the only member, soft-delete the team. A team must never be captain-less.
74. **Removing a member with an in-flight challenge.** Blocked while any challenge involving that team is `matched`/`locked`.
75. **Same user in two teams for the same sport.** Allowed generally, but blocked from being on both sides of a single match (see rule 45).
76. **Pseudo-teams for singles.** Auto-created, `isPseudoTeam = true`, excluded from name uniqueness, hidden from team lists and leaderboards.
77. **Invite token in a public URL.** Tokens are single-use and short-lived; the accept endpoint requires auth, so a leaked link can't add a stranger silently — they must log in.

---

## 7. Maps & Location

78. **`[lng, lat]`, not `[lat, lng]`.** GeoJSON is longitude-first; Google Maps displays latitude-first. Reversing them puts Lucknow (26.85, 80.95) into the Indian Ocean off Somalia. Validate that `lat` is within India's bounds (6–38 N, 68–98 E) at ingest and reject otherwise.
79. **`2dsphere` index is mandatory** on `Arena.location` or `$near` throws at runtime, not at boot.
80. **Location permission denied.** The app must fully work without GPS — fall back to a manual area picker (Gomti Nagar, Aliganj, Hazratganj, …) and `homeAreaName`. Never block the arena list on a location prompt.
81. **Maps API key restrictions.** The Android key is restricted by package name + SHA-1; the iOS key by bundle ID; the browser key by HTTP referrer; the **server** key by IP and must never ship to a client. Four different keys — see `env/README.md`.
82. **Never call Google Geocoding from the mobile client.** Client-side keys are extractable from any APK. Proxy geocoding through your backend with the server key so you can rate-limit and cache.
83. **Cache geocoding results.** Store `googlePlaceId` and `formattedAddress` on the arena. Re-geocoding the same address on every list render will produce a genuinely alarming bill.
84. **Set a billing budget alert on day one.** An unrestricted leaked key is the single most common way small teams get a five-figure Google bill. Also cap daily quota per API in the Cloud Console.
85. **Distance sort ≠ travel time.** `$near` returns crow-flies distance. Label it "5 km away", not "10 min away", unless you actually call the Distance Matrix API.
86. **Radius search returning nothing.** Widen progressively (5 → 10 → 25 km) and, if still empty, show all city arenas rather than an empty screen.

---

## 8. Notifications

87. **Stale FCM tokens.** FCM returns `UNREGISTERED` / `INVALID_ARGUMENT` for dead tokens — remove them from `User.fcmTokens` on that response. Otherwise the array grows forever and every send burns quota.
88. **One user, many devices.** Send to all tokens; use `sendEachForMulticast`. Partial failures are normal — handle per-token results.
89. **Push is not delivery.** Always write a `Notification` row first (the in-app inbox is the source of truth); FCM is best-effort transport on top. A user with notifications disabled must still see everything in-app.
90. **Never put money amounts or OTPs in a push payload** — they render on lock screens.
91. **Notification during a transaction.** Send **after** the DB transaction commits, never inside it. A rolled-back transaction that already sent "You won ₹500" is unrecoverable.
92. **Respect `notificationPrefs`** and quiet hours (22:00–08:00 IST) for non-critical types. Payment and dispute notifications always go through.

---

## 9. API, Security & Operations

93. **Rate limits.** Global 100 req/min/IP; auth endpoints 5/min; booking and challenge-accept 10/min/user. Use a Redis-backed limiter — an in-memory one is useless the moment you run 2 instances.
94. **Validate every payload with Zod** at the route boundary. Strip unknown keys (`.strict()`) so a client can't inject `role: "admin"` into a profile update.
95. **Mass assignment.** Explicitly whitelist updatable fields. Never `Object.assign(user, req.body)`.
96. **IDOR.** Every `:id` route must verify ownership. Arena owners see only their own arenas; users see only their own bookings and transactions. This is the most likely real vulnerability in a generated codebase — test it explicitly.
97. **Pagination is mandatory** on every list endpoint. Cursor-based (`?after=<id>&limit=20`) for feeds; cap `limit` at 100. An unbounded `/api/transactions` will eventually OOM the server.
98. **MongoDB transactions need a replica set.** They silently no-op on a standalone `mongod`. Atlas is fine; a local single-node dev setup is not — run `mongod --replSet rs0` locally and document it, or wallet bugs will only appear in production.
99. **Consistent error envelope.** `{ success: false, error: { code, message, details? } }` with machine-readable `code`s. The Flutter app must switch on `code`, never on English message text.
100. **NoSQL injection.** `{"phoneNumber": {"$ne": null}}` in a JSON body becomes a query operator. Zod's type checking blocks this — but also enable `mongoose.set('sanitizeFilter', true)`.
101. **Never log** OTPs, JWTs, Razorpay signatures, full phone numbers, or bank details. Redact at the logger level, not at each call site.
102. **File uploads** (avatars, dispute evidence): validate magic bytes not extensions, cap at 5 MB, strip EXIF (GPS data leaks home addresses), serve from a separate origin, generate presigned URLs rather than proxying bytes.
103. **Health checks.** `/health` (liveness, no deps) and `/health/ready` (checks Mongo + Redis). Load balancers need both.
104. **Graceful shutdown.** Trap `SIGTERM`, stop accepting connections, wait for in-flight requests, close Mongo. Killing a pod mid-transaction is how you get orphaned holds.
105. **Timezone of the server.** Force `TZ=UTC` in the container. Never rely on the host's local time.
106. **Cron job idempotency.** If two instances run the same sweeper, both must be safe. Use conditional updates or a distributed lock.

---

## 10. Flutter Client

107. **Offline.** Cache the arena list and wallet balance; queue nothing financial offline. Show an explicit offline banner. Never let a booking be "created" locally.
108. **Double-tap on submit.** Disable the button on first tap **and** send an idempotency key. Users on slow networks tap repeatedly.
109. **Token refresh storm.** When the access token expires, 10 parallel requests all 401 at once. Use a single-flight mutex around refresh and replay the queued requests.
110. **App backgrounded mid-payment.** Razorpay's SDK returns via callback; if the app was killed, reconcile on next launch by polling the order status.
111. **Deep links.** Team invites and match results open specific screens. Handle the cold-start case (link arrives before auth is initialised) — stash the route and replay it after login.
112. **Optimistic wallet updates must be reverted on failure.** Better: always re-fetch from the server after any financial action.
113. **Number formatting.** Display `₹1,234.50` with Indian digit grouping (`1,23,456` for lakhs), from paise integers.
114. **Long team/arena names** must ellipsis, not overflow. Test with a 40-char name and Hindi text.

---

## 11. Test Scenarios (write these first)

```
□ Two concurrent bookings on one slot → exactly one succeeds
□ Two concurrent accepts on one challenge → exactly one succeeds
□ Wallet debit with insufficient funds under concurrency → never negative
□ Razorpay webhook delivered 3× → wallet credited once
□ Badminton 30-28 → rejected;  30-29 → accepted
□ Badminton 21-18 / 18-21 from opposite sides → recognised as a MATCH, not a dispute
□ One-sided score submission + deadline passes → auto-resolved, paid out
□ Neither submits + 72h → voided, both refunded
□ Ledger sum == wallet balance after 1000 random operations
□ Arena owner A cannot read arena B's bookings
□ User A cannot read user B's transactions
□ Slot hold expires → slot becomes bookable again
□ Cancel booking backing a matched challenge → blocked
□ $near query returns arenas sorted by real distance
```

---

## 11b. Arena Partners & Offline Bookings

From the competitor teardown (`competitive_analysis.md` §6) — these are real operational failures, not hypotheticals.

115. **The arena takes a walk-in we don't know about.** Every Indian turf accepts phone and walk-in bookings. If desk staff can't record those, we sell the same slot online and it is *our* name on the failure. `POST /owner/bookings/offline` and `Slot.status = blocked` exist for this. Make it the fastest screen in the partner panel — two taps — or staff won't use it and the data will be wrong.
116. **Pay-at-venue no-show.** The user books, never arrives, the arena loses the slot. Take a forfeitable deposit (`Arena.depositPercent`), track `User.noShowCount`, and force prepaid after 2 no-shows in 30 days. Never offer pay-at-venue on a slot that backs a paid challenge.
117. **Desk staff privilege creep.** `arena_staff` must not see earnings, settlements, pricing, or bank details. Scope in the service layer, not by hiding menu items — the API is what matters.
118. **Staff account outlives the employee.** Owners forget to revoke. Auto-expire staff sessions after 8h, and prompt the owner quarterly to review the staff list.
119. **Settlement includes a disputed booking.** Hold it in `heldBookingIds` until the dispute resolves rather than paying out and clawing back. Clawbacks from arena partners do not work in practice.
120. **Arena's bank account name doesn't match the owner.** Hold settlement, escalate to ops. Classic payout-fraud vector.
121. **Holiday pricing not applied.** The rule resolver must check `appliesTo: 'holiday'` against the holiday calendar *before* falling back to weekend/weekday. Test with a Saturday that is also a national holiday — the holiday band should win.
122. **Owner changes price while a slot is held.** The held price is locked at hold time. Never re-price a slot someone is mid-checkout on.
123. **Duplicate venue registration.** Two people apply for the same turf. Check for an existing arena within 100m with a similar name at submit time and flag for ops.
124. **Map pin is wrong.** Google's pin for a turf is often 100–300m off or on the main road. The owner must drag and confirm it; ops re-verifies against satellite. A wrong pin means the venue never appears in radius search and the owner blames us.

---

## 12. Deliberately Out of Scope for Phase 1

Documented so nobody "helpfully" builds them:

- Live ball-by-ball scoring / commentary
- Tournaments & brackets (Phase 2)
- Chat between players (Phase 2 — moderation burden)
- Multi-city expansion (schema is ready; ops are not)
- Automated payout to bank without manual review
- Referral payouts (`referralCode` is captured now, monetised later)
- iOS real-money flows (App Store review on RMG is its own project)
