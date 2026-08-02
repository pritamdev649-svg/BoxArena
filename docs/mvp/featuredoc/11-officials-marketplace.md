# 11 — Officials Marketplace & Match Money Calculation

**PRD:** not yet in `prd.md` · **Roadmap:** unscheduled · **Task IDs:** OF1–OF7, MM1–MM5
**Status:** 🔴 **Pending — nothing built.** Spec captured 2026-08-02, awaiting scheduling.

> Two features in one doc because they are one decision: an official is a **cost of
> playing**, and the money engine cannot be specified without knowing who charges what.

---

## Why this exists

Officials solve **result verification / anti-cheating** — the trust mechanism the entire
prize-money model rests on. Today a result is settled by two captains agreeing
([06](./06-results-verification.md)); a disagreement becomes a dispute an admin must work.
An official is the third path: a neutral party whose scorecard settles the match without
either captain's consent.

It is also its own revenue line — the platform takes a cut of the official's fee.

---

# Part 1 — Officials Marketplace

## The three sources of an official

| Source | Neutrality | Can trigger auto-payout? |
|---|---|---|
| **Venue-provided** — venue owner lists their own staff | High | ✅ Yes |
| **Platform-registered independent** | High | ✅ Yes (once verified) |
| **Team-added** — a team brings their own person | Low | 🔴 No |

## Core rule

**Anyone may list themselves and set their own price.** There is no restriction on who can
charge money to officiate.

**Only venue-provided or platform-verified independent officials can trigger automatic prize
payout.** A team-added official may still officiate and still get paid — but their scorecard
alone does not release escrow; it still requires both-captain confirmation.

## Features to build

### OF1 — Official registration & onboarding
Profile: name, sport specialisation, experience, price per match, availability calendar.
ID verification (required to reach `verified` status). Rating, accrued from completed
matches. Type flag: `venue_staff` / `independent` / `team_added`.

### OF2 — Venue onboarding addition
Venue owners can optionally list their own officials at signup — bundled into the court rate
or priced separately. Extends the onboarding wizard (`arena_onboarding.md`).

### OF3 — Booking-flow addition
At challenge/match creation the captain picks one of three:
1. the venue's official,
2. browse independent officials near that venue and slot,
3. add their own person — casual matches only, or hired-but-non-triggering for paid matches.

**Both captains must confirm the chosen official before it locks.** Mutual consent, never a
unilateral pick.

### OF4 — Payment for the official
Collected **upfront** when both teams confirm, through the same escrow flow as the entry fee.
Default split 50/50 between teams, configurable. Released to the official once the match is
marked complete.

### OF5 — Data model

**`Official`**

| Field | Notes |
|---|---|
| `id` | |
| `type` | `venue_staff` \| `independent` \| `team_added` |
| `name`, `sport`, `price`, `rating` | price is per match, integer paise |
| `verificationStatus` | drives `canTriggerPayout` |
| `linkedVenueId` | nullable — set for `venue_staff` |
| `canTriggerPayout` | **true only for `venue_staff` and verified `independent`** |

**`Match` additions**

| Field | Notes |
|---|---|
| `officialId` | |
| `officialConfirmedByTeamA` | bool |
| `officialConfirmedByTeamB` | bool |
| `officialType` | denormalised at lock time — see open question Q3 |

### OF6 — Edge cases that need a decided policy

| Case | Required behaviour |
|---|---|
| Teams cannot agree on an official | Fall back to the venue's listed official, or platform auto-assigns from the independent pool |
| Official no-shows | Refund or rebooking policy — **not yet decided** |
| No official available at a venue for a paid tournament | Venue may need excluding from the "paid-tournament-eligible" list until it has official coverage |

### OF7 — Multi-phase / bracket support
Official assignment is **per match** — each round of a bracket may use the same or a different
official. Score entry is **per set/phase**, not only the final result.

**`Match.phases[]`** sub-table: `phaseNumber`, `score`, `confirmedByOfficial`, `timestamp`.

---

# Part 2 — Match Money Calculation

## Principle

**Venue fee and official fee are fixed costs of playing.** They are never part of the prize
pool and never refunded. **Only entry fees form the prize pool.** Money moves **once per
match**, on the final result — never per set.

## Who sets which price

| Actor | Sets own price? |
|---|---|
| Venue owner | ✅ ₹/hour |
| Official | ✅ ₹/match |
| Challenge/event creator | ✅ entry fee per team |
| **Platform** | ❌ commission % only — never a fixed amount |

## Formula

```
Venue Fee (V)                     set by venue owner
Official Fee (O)                  set by official
Entry Fee (E)                     set by challenge creator
Commission on entry     (C%)
Commission on venue     (Cv%)
Commission on official  (Co%)     optional

Per-team cost    = (V / 2) + (O / 2) + E

Total Entry Pool = E × number of teams
Net Prize Pool   = Total Entry Pool − (Total Entry Pool × C%)

Platform Revenue = (Total Entry Pool × C%) + (V × Cv%) + (O × Co%)
```

## Features to build

### MM1 — Live calculation engine
Runs at challenge/event creation as the creator picks venue, official and entry fee.
Recalculates in real time as any input changes.

### MM2 — Creator-side warning system
If projected winner profit is ₹0 or negative — entry fee too low against venue + official
cost — show a **soft** warning: *"Winner's profit is low — consider raising entry fee."*
Needs a suggested-minimum-entry-fee formula so the app can auto-suggest a floor.

### MM3 — Challenge details screen, shown to the opponent **before** accepting
- Full cost breakdown: venue fee, official fee, entry fee, total to join.
- Prize pool breakdown: total entry pool, platform commission, net prize pool.
- **"If you win / if you lose"** outcome table — net profit or loss, stated explicitly.
- The official's payout-trigger status: verified vs. requires-both-captains.
- Dispute window and refund policy, shown or linked.
- **Mandatory confirmation checkbox** before *Accept Challenge*:
  *"I understand I will pay ₹X. If I win, I receive ₹Y. If I lose, I receive ₹0."*

### MM4 — Data model additions

**`Event`/`Challenge`:** `venueFee`, `officialFee`, `entryFee`, `commissionRateEntry`,
`commissionRateVenue`, `commissionRateOfficial`.

**Computed server-side, never client-trusted:** `totalPool`, `netPrizePool`, `perTeamCost`,
`platformRevenue`.

### MM5 — Escrow trigger logic
- Funds lock once **both teams pay** — venue + official + entry, combined per team.
- Release on **any** of: both-captain agreement · a verified official's confirmed scorecard ·
  dispute window expiry with no challenge raised.
- **Commission is deducted at collection, not at payout** — the net prize pool is shown
  upfront, before any risk of dispute or cancellation.

---

## API surface — 0 / ~14 (all pending)

Paths are indicative; none are in [`api_contract.md`](../../api_contract.md) yet.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/officials` | Register as an official |
| `GET` | `/officials/me` · `PATCH` `/officials/me` | Own profile & price |
| `GET` | `/officials` — `?sport=&arenaId=&startAt=` | Browse available near a venue/slot |
| `POST` | `/officials/:id/verify` | Admin ID verification → `canTriggerPayout` |
| `GET` | `/officials/:id` | Public profile + rating |
| `POST` | `/owner/officials` · `GET` `/owner/officials` | Venue lists its own staff |
| `POST` | `/challenges/:id/official` | Propose an official |
| `POST` | `/challenges/:id/official/confirm` | Second captain confirms → locks |
| `POST` | `/matches/:id/phases` | Per-set/phase score entry by the official |
| `POST` | `/challenges/quote` | **MM1** — live cost/prize quote, server-computed |
| `POST` | `/matches/:id/official-scorecard` | Official's confirmed result |

---

## How this lands on what already exists

| Existing | Interaction |
|---|---|
| [06 Results & verification](./06-results-verification.md) | Adds a **third** settlement path beside dual-captain agreement and admin dispute resolution |
| [05 Challenges](./05-challenges.md) | Challenge creation gains official selection + mutual confirmation before lock |
| [09 Partner panel](./09-partner-panel.md) | Venue owners gain an officials roster alongside courts & pricing |
| Wallet escrow | Official fee joins entry fee in the same hold; a third payee at release |
| Settlements | Officials become a **new payee class** — the current settlement service pays venues only |

## Open questions — decide before building

| # | Question | Why it blocks |
|---|---|---|
| **Q1** | Official no-show: refund, rebook, or auto-downgrade to dual-captain verification? | OF6 has no stated policy; it is the most likely real failure |
| **Q2** | Does commission-at-collection apply to the **venue fee** too? | The shipped settlement service computes venue commission **at settlement**. Two different timings for the same rupee cannot both be right — see [`settlement.service.ts`](../../../backend/src/modules/settlements/settlement.service.ts) |
| **Q3** | Is `Match.officialType` denormalised at lock time, or read live? | An official verified *after* the match locks would otherwise retroactively change whether that match could auto-pay |
| **Q4** | Suggested-minimum-entry-fee formula (MM2) | Stated as needed, never specified |
| **Q5** | Who pays if the two teams' 50/50 split is reconfigured and one side refuses? | OF4 says "configurable" without saying by whom |
| **Q6** | Does an official's fee sit inside the ₹ cap that compliance applies to a match? | [`compliance.md`](../../compliance.md) governs RMG limits |

---

## Status

Nothing in this document is built. No models, no endpoints, no UI, on any of the three
surfaces. It is recorded here so it is tracked rather than remembered.
