# 06 — Results & Dual Verification

**PRD:** [§4.6](../../prd.md) · **Roadmap:** M7 · **Task IDs:** B8, F3.3, F3.4, F5.2, M4
**Status:** Backend 🟡 3/6 · Web 🟡 (admin side only) · Flutter 🟡 (mock-backed)

> This is **moat #2** — the trusted prize loop. PRD §2 is explicit: trust is destroyed by
> the edge cases, not the happy path.

---

## What it is

Sport-specific score entry validated server-side. Both sides submit; **matching scores
auto-verify and pay out**; mismatches become disputes. One-sided submission auto-resolves
after 24h — the most common real case. Admins work a dispute queue with evidence, an SLA,
and an audited resolution.

## Acceptance criteria (PRD)

- `21-18` and `18-21` submitted from **opposite sides** are recognised as **agreement**, not conflict.

## Badminton rules (PRD §5, edge_cases §5)

- Game to **21**. At 20-all, **win by 2**. Hard cap **30** — so `30-29` is valid, `30-28` is **not**.
- Match is **best of 3**: exactly 2 or 3 games. **No draws.**
- Formats: Singles (1v1), Doubles (2v2), with **separate ELO for each**.
- Tracked: games won/lost, point differential, streaks, per-partner records.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| **Perspective normalisation before comparison** | `21-18` from A and `18-21` from B is the same result. Comparing raw strings creates phantom disputes — the stated AC (edge case 56) |
| Settlement is **one transaction**: status + payout + commission + stats + ELO | A partial settlement is unrecoverable |
| ELO computed from **start-of-match snapshots** | Otherwise concurrent settlements race and ratings drift |
| **Voided matches never touch ratings** | |
| Dispute resolution requires a **mandatory audit note** | |
| Client-side validation **mirrors** the server, never replaces it | |
| Notifications fire **post-commit** | A "you won ₹500" push for a rolled-back transaction is unrecoverable trust damage |

## Match states

`awaiting yours` · `awaiting theirs` · `verified` · `disputed` · `voided` — all five must be
rendered distinctly (F3.3). "Needs your confirmation" must be **unmissable**.

## API surface — 3/6

| Method | Path | Status |
|---|---|---|
| `GET` | `/matches/mine` — `?status=` | ✅ |
| `GET` | `/matches/:publicId` — participants see submissions; public sees final only | ✅ |
| `POST` | `/matches/:publicId/score` + Idem — validates, normalises, compares, settles in one transaction | ✅ |
| `PATCH` | `/matches/:publicId/score` — edit within 10 min, only if opponent hasn't submitted | 🔴 **missing** |
| `POST` | `/matches/:publicId/dispute` — `{ reason, description, evidenceUrls[] }` | 🔴 **missing** |
| `POST` | `/matches/:publicId/walkover` — claim opponent no-show | 🔴 **missing** |

Admin side (all ✅): `GET /admin/disputes` · `GET /admin/disputes/:id` ·
`POST /admin/disputes/:id/assign` · `POST /admin/disputes/:id/resolve`

## Error codes

`CONFIRMATION_WINDOW_CLOSED` 409 (score submitted too late) · `VALIDATION_ERROR` 400 (invalid score)

## Models

`Match` · `Dispute` · `PlayerSportStats` · `Transaction` (payout + commission) · `AuditLog`

## Background jobs

`autoResolveMatches` — every 15 min, applies the **24h** single-submission deadline (edge case 54).
`voidStaleMatches` — hourly, **72h** of silence → refund both sides.
Both are live in [`worker.ts`](../../../backend/src/jobs/worker.ts).

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | [`score-validator.ts`](../../../backend/src/modules/matches/score-validator.ts) + [tests](../../../backend/src/modules/matches/score-validator.test.ts), [`elo.service.ts`](../../../backend/src/modules/matches/elo.service.ts), [`match.service.ts`](../../../backend/src/modules/matches/match.service.ts) | Validator and ELO complete |
| Web | [`admin/disputes/page.tsx`](../../../web/src/app/admin/disputes/page.tsx) (83 lines) | **No player-side score entry (F3.3) or match history (F3.4)** |
| Flutter | [`score_entry_screen.dart`](../../../flutter_app/lib/features/scoring/presentation/score_entry_screen.dart) | Mock-backed; no match history |

## Gaps

1. **Players cannot raise a dispute.** `POST /matches/:id/dispute` doesn't exist, so the admin dispute queue has no player-driven inflow. The auto-resolve path can create disputes; a player who disagrees cannot.
2. **No walkover claim** — opponent no-show has no route, despite `noShowCount` being tracked partner-side.
3. **No 10-minute score edit** — a fat-fingered score is permanent, which converts typos into disputes and directly worsens the <3% dispute-rate success metric.
4. **F3.3 is not built on web** — one of the three ⚠️ awkward-state tasks `tasks.md` says to build *early* precisely because it encodes the weird states.
5. **No match history / detail (F3.4)**, so no shareable public match page and no OG image.
6. `[verify]` B8's done-when: `21-18` vs `18-21` = agreement; `30-28` rejected, `30-29` accepted.

## Success-metric tie

Dispute rate **< 3% of matches** is one of the two primary metrics — it's the number that
decides whether the prize loop survives. Items 1–3 above all push that number up.

## Launch-gate ties

- `edge_cases.md` §5 badminton table and §11 checklist fully passing.
- Dispute resolution p95 within SLA.
