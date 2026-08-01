# 02 — Arena Discovery

**PRD:** [§4.2](../../prd.md) · **Roadmap:** M2 · **Task IDs:** B4, F2.2, F2.3, M3
**Status:** Backend ✅ · Web 🟡 (no map) · Flutter 🟡 (mock-backed)

---

## What it is

Browse and search Lucknow venues; filter by sport, area, price, amenities. Map view and
"near me" via a geo-indexed radius search with distance shown. Arena detail carries photos,
courts, amenities, hourly pricing, reviews, and directions.

## Acceptance criteria (PRD)

- **Fully usable with location permission denied** — a manual area picker fallback must exist.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| `2dsphere` index on `Arena.location`; GeoJSON order is **`[lng, lat]`** | A coordinate swap silently returns venues in the wrong hemisphere. M2's done-when is an ingest-time rejection test |
| Google Places is **proxied server-side** with the server key + 30-day Redis cache | A client-side key gets scraped and bills you (edge case 82) |
| Distance is labelled **"km away", never "min away"** | We don't know traffic; a wrong ETA is a trust cost (edge case 85) |
| Owner endpoints scoped to owned arenas only | IDOR surface |

## API surface — 9/9 ✅

| Method | Path | Status |
|---|---|---|
| `GET` | `/arenas` — `?sport=&areaName=&q=&limit=&after=` | ✅ |
| `GET` | `/arenas/nearby` — `?lat=&lng=&radiusKm=5&sport=` → includes `distanceMeters` | ✅ |
| `GET` | `/arenas/:publicId` — detail + courts + amenities + rating | ⚠️ implemented as **`/arenas/:slug`** |
| `GET` | `/arenas/:publicId/slots` — `?date=&sport=&courtId=` grouped by court | ✅ |
| `GET` | `/arenas/:publicId/challenges` — open challenges at this arena | ✅ |
| `GET` | `/arenas/:publicId/reviews` — paginated | ✅ |
| `POST` | `/arenas/:publicId/reviews` — requires a completed booking | ✅ |
| `GET` | `/geo/autocomplete` — proxied Places | ✅ |
| `GET` | `/geo/reverse` — proxied reverse geocode → area name | ✅ |

> **Contract drift.** The detail route is `/:slug` in code, `/:publicId` in the contract.
> Slug is arguably better for SEO (§10 wants `/public/arenas/:slug`), but the contract says
> *"do not invent endpoints"* — pick one and update the other. Flutter and web must agree.

## Models

`Arena` · `Court` · `PricingRule` · `Review`

## Background jobs

`materialiseSlots` — daily 02:00 IST, rolling 30-day window. Never touches booked slots.

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | [`modules/arenas/`](../../../backend/src/modules/arenas/), [`modules/geo/`](../../../backend/src/modules/geo/) | Complete |
| Web | [`arenas/page.tsx`](../../../web/src/app/arenas/page.tsx) (69 lines), [`arenas/[slug]/page.tsx`](../../../web/src/app/arenas/[slug]/page.tsx), [`arena-card.tsx`](../../../web/src/features/arenas/components/arena-card.tsx), [`tonight-panel.tsx`](../../../web/src/features/arenas/components/tonight-panel.tsx) | List page is thin |
| Flutter | [`arena_list_screen.dart`](../../../flutter_app/lib/features/booking/presentation/arena_list_screen.dart), [`arena_detail_screen.dart`](../../../flutter_app/lib/features/booking/presentation/arena_detail_screen.dart), [`arena_info_screen.dart`](../../../flutter_app/lib/features/booking/presentation/arena_info_screen.dart) | All three read `seed_data.dart` |

## Gaps

1. **No map view on either surface.** PRD §4.2 names it explicitly, and F2.2's done-when is about the *permission-denied fallback* — which can't be tested until the permission path exists.
2. **Web list page is 69 lines** — filters (sport/area/price/amenities), search, and sort-by-distance are not all there.
3. **Flutter discovery is mock-backed.** `/arenas` and `/arenas/nearby` are live and unused.
4. Resolve the `:slug` vs `:publicId` drift before Flutter is wired, or it gets wired to the wrong shape.
5. `[verify]` F2.3: arena detail renders correctly with 1 photo and no reviews.

## Launch-gate ties

- All 4 Maps keys **restricted**, with a billing budget alert firing on a test spike.
- 5+ Gomti Nagar arenas onboarded with **verified coordinates**.
