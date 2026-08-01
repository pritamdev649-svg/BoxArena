# 05 — Matchmaking Challenges

**PRD:** [§4.5](../../prd.md) · **Roadmap:** M6 · **Task IDs:** B7, F3.2, M4
**Status:** Backend 🟡 3/6 · Web 🟡 · Flutter 🟡 (mock-backed)

---

## What it is

Post a challenge on a slot you already booked, optionally with an entry fee and a skill/ELO
band. Others browse the open feed by sport, area, date, and fee. On accept, **both entry fees
escrow atomically** and a `Match` is created with a frozen lineup.

## Acceptance criteria (PRD)

- You cannot accept your own challenge, or appear on **both sides** of one.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| Accept is a single atomic update guarded on `status: 'open'` | Two simultaneous accepts must produce exactly one winner — B7's done-when |
| The creator's fee escrows **at create**, the opponent's **at accept** | Otherwise a matched challenge can be unfunded |
| Skill/ELO band enforced **server-side** | A client-side band is a suggestion, not a rule |
| Lineup is **frozen** into the `Match` at accept | Roster changes after accept must not alter who played |
| Self-accept and same-player-both-sides checks | The stated AC |
| Forfeit penalty is shown **before** the user confirms a cancellation | Surprise penalties are the fastest route to a support ticket (edge case 48) |
| `expireUnmatchedChallenges` refunds the creator | Escrow must never strand money |

## API surface — 3/6

| Method | Path | Status |
|---|---|---|
| `POST` | `/challenges` + Idem — `{ bookingId, teamId, entryFeePaise, skillFilter?, notes? }`, escrows creator | ✅ |
| `GET` | `/challenges` — feed: `?sport=&areaName=&maxEntryFeePaise=&date=&arenaPublicId=` | ✅ |
| `GET` | `/challenges/:publicId` | 🔴 **missing** |
| `POST` | `/challenges/:publicId/accept` + Idem — atomic, escrows opponent, creates `Match` | ✅ |
| `POST` | `/challenges/:publicId/cancel` — pre-match full refund; post-match forfeit rules | 🔴 **missing** |
| `GET` | `/challenges/mine` | 🔴 **missing** |

Also live: `GET /arenas/:publicId/challenges` — open challenges at a given venue.

## Error codes

`CHALLENGE_ALREADY_MATCHED` 409 (lost the accept race) · `INSUFFICIENT_BALANCE` 409 ·
`GEO_RESTRICTED` 403 (paid play blocked in the user's state)

## Models

`Challenge` · `Match` (created on accept) · `Transaction` (escrow rows)

## Background jobs

`expireUnmatchedChallenges` — every 5 min, refunds creator escrow.

## The runtime flag

Paid challenges are gated at
[`challenge.service.ts:143`](../../../backend/src/modules/challenges/challenge.service.ts#L143)
on `env.ENABLE_PAID_CHALLENGES`. The launch build ships with it **`false`** — free challenges
work, entry fees do not. See [`compliance.md §7`](../../compliance.md).

> ⚠️ [`.env.example:50`](../../../backend/.env.example#L50) ships `ENABLE_PAID_CHALLENGES=true`,
> which is the opposite of the launch-gate requirement. Fix the default so a fresh deploy is
> safe by accident, not by discipline.

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | [`modules/challenges/`](../../../backend/src/modules/challenges/) | 3 of 6 routes |
| Web | [`challenges/page.tsx`](../../../web/src/app/challenges/page.tsx) feed ✅; [`challenges/new/page.tsx`](../../../web/src/app/challenges/new/page.tsx) is a **22-line `ComingSoon` stub** | |
| Flutter | [`challenges_screen.dart`](../../../flutter_app/lib/features/matchmaking/presentation/challenges_screen.dart), [`challenge_detail_screen.dart`](../../../flutter_app/lib/features/matchmaking/presentation/challenge_detail_screen.dart), [`create_challenge_screen.dart`](../../../flutter_app/lib/features/matchmaking/presentation/create_challenge_screen.dart) | All three + the provider read `seed_data.dart` |

## Gaps

1. **No cancel endpoint** — so the forfeit rules (edge case 48) and F3.2's "penalty shown before confirming" cannot be built on any surface.
2. **No detail endpoint**, yet Flutter already has a `challenge_detail_screen` running on mocks. Wiring it will fail.
3. **No `/challenges/mine`** — a user can't see challenges they created.
4. **Web create flow is a stub.**
5. F3.2's done-when: `CHALLENGE_ALREADY_MATCHED` must render a **clean message, not a crash**. `[verify]`
6. `[verify]` B7's done-when: concurrent accepts → exactly one wins.
