# Product Requirements Document (PRD) — BoxArena

## 1. Executive Summary & Vision

**BoxArena** is a hyper-localized, unified sports league platform, launching in **Lucknow**.

Rather than a booking app, BoxArena is **the organized amateur league for the city** — stitching together turf bookings, matchmaking, stats tracking, and competitions into one high-trust loop.

### Supported Sports
* 🏏 **Box Cricket**
* ⚽ **Turf Football**
* 🏸 **Badminton** — Singles/Doubles, best-of-3 games, full points validation

### Platforms
1. **Mobile App (Flutter)** — the player surface. Profiles, teams, WhatsApp invites, booking, challenges, scoring, wallet.
2. **Public Website (Next.js)** — SEO portal: city leaderboards, results, player profiles, arena pages.
3. **Admin & Arena Partner Panel (Next.js)** — two role-scoped surfaces in one app. Arena owners manage courts, slots, and pricing for **their own venues only**; BoxArena ops handle disputes, withdrawals, and configuration.

---

## 2. Competitive Landscape & the Unclaimed Gap

The market is fragmented (Playo, CricHeroes, Hudle), but no platform runs a secure, unified **book ➡️ play ➡️ score ➡️ win** loop.

### The Three Moats
1. **The Unified Loop** — book, play, auto-record stats, rank up, win, all in one platform.
2. **Trusted Prize Loop** — escrowed entry fees, dual-confirmed results, automatic payout, human dispute resolution.
3. **Local Density** — own Gomti Nagar, Aliganj, Hazratganj completely before expanding. Liquidity is local: a player needs opponents *at their court on Saturday*, not nationwide.

### The real risk to the moats
The prize loop's value is **trust**, and trust is destroyed by the edge cases, not the happy path. A single double-booked slot, lost ₹500, or unresolved dispute costs more than a missing feature. `edge_cases.md` is therefore a product document as much as a technical one.

---

## 3. Personas

| Persona | Needs | Pain today |
|---|---|---|
| **Rahul, 24, regular player** | Find a court tonight; find opponents at his level | WhatsApp groups, calling turfs one by one |
| **Priya, 21, badminton doubles** | A consistent partner; a real ranking | No record of who's actually good |
| **Imran, 32, team captain** | Coordinate 10 people; collect money; book | Chasing payments manually |
| **Mr. Verma, arena owner** | Fill off-peak slots; stop no-shows | Paper register, phone bookings, walk-outs |
| **Ops admin** | Resolve disputes fast and fairly | — (new role) |

---

## 4. Phase 1 — MVP Scope (Month 1–3)

**Geography**: Lucknow. **Sports**: Badminton (primary), Box Cricket, Turf Football.

> **Launch posture:** ship with `ENABLE_PAID_CHALLENGES=false`. The full money loop is built, tested, and dormant behind a runtime flag until legal and app-store approvals land. Free bookings, teams, scoring, and leaderboards are the launchable product. See `compliance.md` §7.

### 4.1 Auth & Profiles
* Phone + OTP. Rotating refresh tokens, multi-device session list.
* Profile: name, photo, primary sport, skill level, home area.
* Per-sport, per-format stats with independent ELO (singles ≠ doubles).
* **AC**: OTP rate-limited; a user can log out one device without killing the others.

### 4.2 Arena Discovery
* Browse and search Lucknow venues; filter by sport, area, price, amenities.
* **Map view + "near me"** via geo-indexed radius search, with distance shown.
* Arena detail: photos, courts, amenities, hourly pricing, reviews, directions.
* **AC**: fully usable with location permission denied — manual area picker fallback.

### 4.3 Booking & Wallet
* Per-court slot grid by date; booked and blocked slots visually distinct.
* Multi-hour bookings as one atomic transaction.
* Three-bucket wallet (deposit / winnings / bonus) + Razorpay top-up.
* Cancellation with policy-driven refund tiers; check-in code at the venue.
* **AC**: two users tapping the same slot simultaneously — exactly one succeeds, the other sees a clear message, neither is charged twice.

### 4.4 Teams & Invites
* Create a team (name, sport, format, logo); captain and vice-captain roles.
* WhatsApp invite links with expiring, use-limited tokens.
* Badminton doubles pairs; auto-created pseudo-teams for singles.
* **AC**: a forwarded invite link cannot add unlimited strangers.

### 4.5 Matchmaking Challenges
* Post a challenge on a booked slot, optionally with an entry fee and a skill/ELO band.
* Browse open challenges by sport, area, date, and fee.
* Accept → both entry fees escrowed atomically → match created.
* **AC**: you cannot accept your own challenge, or appear on both sides.

### 4.6 Results & Dual Verification
* Sport-specific score entry with server-side validity rules.
* Both sides submit; matching scores auto-verify and pay out; mismatches become disputes.
* **One-sided submission auto-resolves after 24h** — the most common real case.
* Admin dispute queue with evidence, SLA, and audited resolution.
* **AC**: `21-18` and `18-21` submitted from opposite sides are recognised as agreement, not conflict.

### 4.7 Leaderboards
* City and area leaderboards per sport and format, by ELO. Public and SEO-indexed.

### 4.8 Notifications
* In-app inbox as the source of truth; FCM as transport. Per-type preferences, quiet hours.

### 4.9 Arena Partner Panel
* Manage courts, operating hours, peak/off-peak pricing, block slots for maintenance.
* View today's bookings, verify check-in codes, see earnings.
* **AC**: an owner can never see another arena's data.

### 4.10 Admin Panel
* Dispute queue and resolution; user search, suspend; withdrawal approvals; arena verification; runtime config editor; ledger reconciliation report; audit log.

---

## 5. Badminton Game Logic

* **Formats**: Singles (1v1), Doubles (2v2).
* **Game**: to 21. At 20-all, win by 2. Hard cap 30 — so `30-29` is valid, `30-28` is not.
* **Match**: best of 3. Exactly 2 or 3 games. No draws.
* **Tracked**: games won/lost, point differential, streaks, per-partner records.
* **Rankings**: separate ELO for singles and doubles.

Full validation table: `edge_cases.md` §5.

---

## 6. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | p95 API < 400 ms; arena list < 1 s on 4G; app cold start < 3 s |
| Availability | 99.5% for booking and wallet paths |
| Correctness | **Zero tolerance on money.** Ledger must reconcile daily |
| Concurrency | Correct under simultaneous booking and challenge-accept load |
| Security | No IDOR; no secrets in client bundles; all admin actions audited |
| Scale target | 10k users, 50 arenas, 500 bookings/day in Lucknow |
| Accessibility | Readable at 200% text scale; tap targets ≥ 44 px |
| Localisation | English at MVP; strings externalised for Hindi in Phase 2 |
| Offline | Browse cached arenas; no financial action offline |

---

## 7. Success Metrics

**Primary:** weekly repeat bookings per active user, and **dispute rate < 3% of matches** — the trust metric that decides whether the prize loop survives.

**Secondary:** slot fill rate (arena-side value), D30 retention, time-to-match for a posted challenge, share of matches with both scores submitted, wallet top-up conversion.

**Guardrails:** zero unreconciled ledger days, zero double-bookings, dispute resolution p95 within SLA.

---

## 8. Out of Scope for Phase 1

Live ball-by-ball scoring · tournaments and brackets · in-app chat · multi-city · automated bank payouts without review · referral payouts · Hindi UI · iOS real-money flows.

---

## 9. Open Questions

1. Do arena partners settle weekly or monthly, and who bears payment-gateway fees?
2. Football/cricket draws — refund both, or split the pot? (Refund-both is friendlier at MVP.)
3. Is the arena's own staff a role, or does the owner account cover check-in?
4. Minimum viable arena count in Gomti Nagar before launch is worth doing — 5? 10?
5. Does the free product launch first, with paid challenges enabled later as a separate event? (Recommended.)
