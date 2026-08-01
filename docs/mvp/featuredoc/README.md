# MVP Feature Docs

One document per MVP feature area from [`prd.md §4`](../../prd.md). Each doc is the
single place to answer "what is this feature, what's the contract, and what's actually built."

**Scope of the MVP:** Lucknow only · Badminton (primary), Box Cricket, Turf Football · Month 1–3.

**Launch posture:** ship with `ENABLE_PAID_CHALLENGES=false`. The money loop is built and
tested but dormant behind a runtime flag until legal and app-store approval. The launchable
day-one product is **free bookings, teams, scoring, and leaderboards**.

**Last audited:** 2026-08-01 · see [`../../progress.md`](../../progress.md) for the task-level tracker.

---

## Index

| # | Feature | PRD | Backend | Web | Flutter | Free-launch path? |
|---|---|---|---|---|---|---|
| [01](./01-auth-profiles.md) | Auth & Profiles | §4.1 | ✅ 15/15 | ✅ | 🟡 mock | **Yes** |
| [02](./02-arena-discovery.md) | Arena Discovery | §4.2 | ✅ 9/9 | 🟡 no map | 🟡 mock | **Yes** |
| [03](./03-booking-wallet.md) | Booking & Wallet | §4.3 | 🟡 9/12 | 🔴 | 🔴 | **Yes** (booking half) |
| [04](./04-teams-invites.md) | Teams & Invites | §4.4 | 🟡 7/8 | 🔴 | 🔴 | **Yes** |
| [05](./05-challenges.md) | Matchmaking Challenges | §4.5 | 🟡 3/6 | 🟡 | 🟡 mock | Flag-gated |
| [06](./06-results-verification.md) | Results & Dual Verification | §4.6 | 🟡 3/6 | 🟡 admin only | 🟡 mock | **Yes** |
| [07](./07-leaderboards.md) | Leaderboards | §4.7 | 🔴 0/3 | 🟡 seed data | 🔴 | **Yes** |
| [08](./08-notifications.md) | Notifications | §4.8 | ✅ 3/3 | 🔴 | 🟡 FCM only | **Yes** |
| [09](./09-partner-panel.md) | Arena Partner Panel | §4.9 | 🟡 18/20 | 🟡 | n/a | **Yes** |
| [10](./10-admin-panel.md) | Admin Panel | §4.10 | ✅ 22/22 | 🟡 | n/a | **Yes** |

**Backend totals: 92 of ~105 contract endpoints (~88%).**

---

## The four MVP blockers

Ordered by what actually stops a free launch:

1. **Leaderboards have no backend at all** (07) — 0 of 3 endpoints. It's a free-tier feature *and* the SEO surface.
2. **Teams has a complete backend and zero UI** on either platform (04).
3. **Players cannot raise a dispute** (06) — admins can resolve, but `POST /matches/:id/dispute` doesn't exist.
4. **Flutter — the designated player surface — never calls the API.** 9 screens read from `seed_data.dart`.

**Recently closed:** the slot pipeline (09) — pricing bands now resolve, the 30-day window
rolls forward on an hourly cron, and owners can manage hours, courts, amenities, and pricing.

---

## Conventions used in every doc

- **Status:** ✅ done · 🟡 partial · ⬜ stub file only · 🔴 not started
- Endpoint tables mark each contract row `✅` implemented or `🔴` missing, against
  [`api_contract.md`](../../api_contract.md).
- `[verify]` = the code exists but its acceptance criterion has not been executed.
- Money is always integer paise. IDs in URLs are `publicId`, never Mongo ObjectIds.
