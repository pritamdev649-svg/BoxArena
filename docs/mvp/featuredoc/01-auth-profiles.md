# 01 — Auth & Profiles

**PRD:** [§4.1](../../prd.md) · **Roadmap:** M1 · **Task IDs:** B3, F1.4, M2
**Status:** Backend ✅ · Web ✅ · Flutter 🟡 (mock-backed)

---

## What it is

Phone + OTP is the only identity. There are no passwords. A user carries a profile
(name, photo, primary sport, skill level, home area) and **independent ELO per sport
per format** — singles rating and doubles rating never mix.

## Acceptance criteria (PRD)

- OTP is rate-limited.
- A user can log out **one** device without killing the others.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| OTP codes stored **hashed** with a TTL index and attempt caps | A leaked DB must not hand over live login codes |
| Dual rate limiting — **by phone and by IP** | Either alone is trivially bypassed |
| `/auth/otp/request` always returns 200 | Must never reveal whether a number is registered |
| Refresh tokens **rotate**, with reuse detection → revoke **all** sessions | A replayed refresh token means the chain is compromised |
| `authMiddleware` re-reads `role`/`status` **from the DB** | A suspended user must not survive on a valid 15-min token |
| Profile PATCH uses a **strict field whitelist** | Stops role/wallet escalation via mass assignment |
| Account deletion **anonymises**, retains ledger | Financial records must survive erasure (edge case 8) |

Token TTLs: access 15 min, refresh 30 days.

## API surface — 15/15 ✅

| Method | Path | Status |
|---|---|---|
| `POST` | `/auth/otp/request` — rate-limited 3/15min | ✅ |
| `POST` | `/auth/otp/verify` → `{ accessToken, refreshToken, user, isNewUser }` | ✅ |
| `POST` | `/auth/refresh` — rotates + detects reuse | ✅ |
| `POST` | `/auth/logout` — revokes the presented token | ✅ |
| `POST` | `/auth/logout-all` | ✅ |
| `GET` | `/auth/sessions` — active device list | ✅ |
| `GET` | `/users/me` — profile + wallet + KYC | ✅ |
| `PATCH` | `/users/me` — whitelisted fields only | ✅ |
| `POST` `DELETE` | `/users/me/fcm-token` | ✅ |
| `GET` | `/users/me/stats` — all `PlayerSportStats` rows | ✅ |
| `GET` | `/users/:publicId` — public profile, **no phone, no wallet** | ✅ |
| `POST` | `/users/me/kyc` — PAN + document | ✅ |
| `POST` | `/users/me/bank-account` — requires OTP re-verification | ✅ |
| `DELETE` | `/users/me` — anonymise | ✅ |

`GET /auth/me` also exists (not in contract) — harmless, but fold it into `/users/me` or document it.

## Error codes

`UNAUTHENTICATED` 401 · `TOKEN_REUSE_DETECTED` 401 (all sessions revoked) ·
`FORBIDDEN` 403 · `ACCOUNT_SUSPENDED` 403 · `RATE_LIMITED` 429 (`Retry-After` set)

## Models

`User` · `Otp` · `RefreshToken` · `PlayerSportStats`

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | [`modules/auth/`](../../../backend/src/modules/auth/), [`modules/users/`](../../../backend/src/modules/users/), [`middlewares/auth.ts`](../../../backend/src/shared/middlewares/auth.ts) | Complete |
| Web | [`login/page.tsx`](../../../web/src/app/login/page.tsx), [`panel-auth.ts`](../../../web/src/shared/lib/panel-auth.ts) | Role gating lives in layouts — **there is no `middleware.ts`** |
| Flutter | [`login_screen.dart`](../../../flutter_app/lib/features/auth/presentation/login_screen.dart), [`registration_screen.dart`](../../../flutter_app/lib/features/auth/presentation/registration_screen.dart), [`auth_service.dart`](../../../flutter_app/lib/core/services/auth_service.dart) | **`auth_service.dart` reads `seed_data.dart`** — not wired to the API |

## Gaps

1. **Flutter auth is fake.** `auth_service.dart` resolves against mock seed data. Wire it to `/auth/otp/*` first — everything else in the app depends on a real token.
2. **No single-flight refresh proof.** M1's done-when is "10 parallel 401s issue exactly one refresh." Flutter uses `http`, not the `dio` client the roadmap specifies. `[verify]`
3. **No `middleware.ts` on web.** F1.4's done-when (unauthenticated `/admin` → login; player → `/partner` = 403) is unproven.
4. `[verify]` OTP resend fallback appears after 30s (M2 done-when).

## Launch-gate ties

- DLT template approved and **real OTP delivery confirmed on Jio / Airtel / VI**. `OTP_DEV_MODE` must be off.
- Edge cases §1–11 passing.
