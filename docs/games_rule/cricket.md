# Cricket — official-run live scoring

**Status: on hold.** Cricket courts are bookable and cricket matches can be
scored by both captains. What is deliberately not built is the *official-run
live scoring engine* — and until it is, **cricket challenges are closed too**
(`CHALLENGE_SPORTS` is badminton only). Booking a pitch is one thing; staking
money on a result nothing verifies is another.

## Why it is on hold

Badminton is the reference implementation ([`badminton.md`](./badminton.md) §8).
Its shape — granular log → aggregated set/match record → confirmation → escrow
trigger — is meant to carry over, but the granular unit is different:

| | Badminton | Cricket |
|---|---|---|
| Atom | rally | ball |
| Aggregate | game to 21 | over, then innings |
| Ends | one side wins the rally | runs, extras, wickets, dismissal type |
| Draw possible | **no** | yes |

A ball is not a rally with different labels. It carries runs, extras, a
dismissal, and a striker/non-striker rotation, and the innings has a target.
None of that exists yet.

**A half-built cricket scoreboard that settles prize money would be worse than
none**, which is why cricket matches keep the dual-captain flow: both captains
submit, matching scores auto-verify, mismatches become disputes
([`06-results-verification.md`](../mvp/featuredoc/06-results-verification.md)).

## What is already true

- `validateCricket` in [`score-validator.ts`](../../backend/src/modules/matches/score-validator.ts)
  validates final scores — runs, wickets 0–10, and `.6` overs rejected.
- `POST /matches/:id/live/*` refuses a cricket match with a message that says
  captains submit instead, rather than a generic error.
- `LIVE_SCORING_SPORTS` in [`sports.ts`](../../backend/src/shared/config/sports.ts)
  is the switch. Adding `cricket` to it before the engine exists would expose a
  scoreboard that cannot score.

## Before building it

Decide the atom. Everything else follows from whether a `MatchPoint` becomes a
`MatchBall` with runs and a dismissal, or cricket gets its own log table.
