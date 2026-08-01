# 07 — Leaderboards

**PRD:** [§4.7](../../prd.md) · **Roadmap:** W3 · **Task IDs:** F3.5, M4
**Status:** Backend 🔴 **0/3** · Web 🟡 (renders from seed data) · Flutter 🔴

> **The only MVP area with no backend at all.** It is simultaneously a free-tier feature
> and the entire SEO surface, which puts it squarely on the launch path.

---

## What it is

City and area leaderboards, per sport and per format, ranked by ELO. **Public and
SEO-indexed** — this is how strangers discover BoxArena without paid acquisition.

## Why it matters more than its size suggests

- It's the **payoff of the unified loop**: book → play → score → **rank** → win. Without a
  visible rank, scoring is data entry with no reward.
- It's **free-tier**, so it ships on day one regardless of `ENABLE_PAID_CHALLENGES`.
- It's the **organic acquisition channel** (roadmap W3: ISR + schema.org + sitemap).

## Design rules

| Rule | Why |
|---|---|
| Separate boards per **sport × format** | Singles and doubles ELO are independent; merging them is meaningless |
| Area boards, not just city | Moat #3 is local density — a player cares who's best at *their* court |
| Public, no auth | It has to be crawlable |
| Tables use **tabular numerals** and stay tables — no cards | F3.5's done-when, from `design_system.md §8.3` |
| Form pills render as `W W L W D` | |

## API surface — 0/3 🔴

| Method | Path | Status |
|---|---|---|
| `GET` | `/leaderboards` — `?sport=&format=&areaName=&period=all\|month` | 🔴 **missing** |
| `GET` | `/public/matches/recent` — for the Next.js SEO site | 🔴 **missing** |
| `GET` | `/public/arenas/:slug` — SEO arena page | 🔴 **missing** |

The word "leaderboard" appears in the backend only inside
[`schemas.ts`](../../../backend/src/models/schemas.ts) — there is no module, no route, no service.

## Models

`PlayerSportStats` (the ELO source, already populated by settlement) · `Match` · `User`

The data is **already being produced correctly** by
[`elo.service.ts`](../../../backend/src/modules/matches/elo.service.ts) on every settled match.
This feature is a read layer over data that exists.

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | — | Nothing |
| Web | [`leaderboard/page.tsx`](../../../web/src/app/leaderboard/page.tsx), [`leaderboard-row.tsx`](../../../web/src/shared/ui/leaderboard-row.tsx) | The row component is done and matches `design_system.md §5`. The page renders **seed data** |
| Flutter | — | No leaderboard screen (M4 scope) |

## Gaps

1. **Build the three endpoints.** This is the cheapest high-value work left in the MVP — a read layer over `PlayerSportStats`, which already has correct ELO.
2. **No player profile page on web** (F3.5 covers profiles too): per-format stats and partner records have a backing endpoint (`GET /users/:publicId`, `GET /users/me/stats`) and no UI.
3. **No Flutter leaderboard.**
4. **W3 SEO work is untouched** — ISR, schema.org markup, and sitemap all depend on `/public/*`.
5. `[verify]` F3.5's done-when: the table uses tabular numerals and needs no cards.

## Sequencing note

Do this **after** wiring Flutter to the API but **before** any polish work. It converts
already-correct data into the product's most visible reward and its only organic
acquisition channel, and it unblocks W3 entirely.
