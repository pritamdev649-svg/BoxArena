# 04 — Teams & Invites

**PRD:** [§4.4](../../prd.md) · **Roadmap:** M5 · **Task IDs:** B7, F3.1, M4
**Status:** Backend 🟡 7/8 · Web 🔴 · Flutter 🔴

> **The widest build gap in the MVP.** The backend is essentially done and there is
> no user interface on either platform.

---

## What it is

Create a team (name, sport, format, logo) with captain and vice-captain roles. Invite via
**WhatsApp links carrying expiring, use-limited tokens**. Badminton doubles form pairs;
singles get auto-created pseudo-teams so every match has two "teams" on the wire.

## Acceptance criteria (PRD)

- A **forwarded** invite link cannot add unlimited strangers.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| Invite tokens carry `maxUses` **and** an expiry | A WhatsApp link is public the moment it's sent — this is the whole AC |
| Team names are **scoped-unique**, not globally unique | Two "Titans" in different sports is fine; two in the same league is not |
| Size limits enforced **by format** | 2 for doubles, 1 for singles pseudo-teams, 5–11 for cricket/football |
| Member removal **blocked during a live challenge** | The lineup is frozen at accept time; removing a player mid-match breaks settlement |
| Captain succession is handled on leave | A team must never be captainless |
| Pseudo-teams for singles are auto-created | Keeps `Match` uniform across sports |

## API surface — 7/8

| Method | Path | Status |
|---|---|---|
| `POST` | `/teams` — `{ name, sport, format, logoUrl? }` | ✅ |
| `GET` | `/teams/mine` | ✅ |
| `GET` | `/teams/:publicId` — public team page | ✅ |
| `PATCH` | `/teams/:publicId` — captain only | 🔴 **missing** |
| `POST` | `/teams/:publicId/invites` — `{ maxUses?, expiresInHours? }` → `{ token, whatsappUrl, deepLink }` | ✅ |
| `POST` | `/teams/invites/:token/accept` — validates uses / expiry / size | ✅ |
| `DELETE` | `/teams/:publicId/members/:userPublicId` — captain only, blocked during live challenge | ✅ |
| `POST` | `/teams/:publicId/leave` — handles captain succession | ✅ |

## Models

`Team` · `TeamInvite`

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | [`modules/teams/`](../../../backend/src/modules/teams/) | 7 routes live |
| Web | — | **No `/teams` route exists** |
| Flutter | — | **No teams screen exists** |

## Gaps

1. **No UI anywhere.** F3.1 (web) and the teams half of M4 (Flutter) are both untouched. Teams gate challenges, which gate matches — this blocks the compete loop end to end.
2. **`PATCH /teams/:publicId` missing** — no way to rename a team or change its logo.
3. F3.1's done-when is unusual and easy to miss: a **duplicate team name suggests alternatives** rather than erroring.
4. `[verify]` the deep link in `whatsappUrl` resolves in the Flutter app (needs `go_router` deep-link config).

## Free-launch note

Teams are **fully in scope for day one** — they're free-tier, independent of
`ENABLE_PAID_CHALLENGES`, and are the social hook that makes the app worth reopening.
