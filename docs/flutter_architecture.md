# Flutter App — Architecture Reference

The player-and-official mobile app. This doc is the single place to answer
"where does X live, and what talks to what" without opening 46 files.

**Stack:** Flutter · Riverpod 3.3 · go_router 17.3 · `http` (not dio) · Firebase (core/auth/messaging)
**Size:** 46 Dart files · ~9,900 LOC
**Backend:** the same API the web app uses — see [`api_contract.md`](./api_contract.md)
**Last surveyed:** 2026-08-03

---

## The shape

```
lib/
  main.dart                  entry: preload i18n, lock portrait, init Firebase, run app
  core/                      everything shared. No feature may be imported from here.
    constants/               app_constants.dart (base URL, sport/skill enums), api_routes.dart
    localization/            app_localizations.dart — JSON preloaded at boot (en, hi)
    mock/                    seed_data.dart — hardcoded fixtures. See "the mock problem" below.
    navigation/              app_router.dart — every route, plus the auth redirect
    providers/               profile, locale, theme, services_providers
    services/                api_client.dart, auth_service.dart, firebase_service.dart
    theme/                   app_theme.dart — AppColors + ThemeData
    utils/                   app_snackbar.dart
    widgets/                 AppButton, AppInputField, AppDropdown, AppLoader, AppAlertDialog
  features/
    <feature>/
      models/                plain Dart, fromJson only
      providers/             Riverpod notifiers — all state lives here
      presentation/          screens, and widgets/ for screen-local pieces
```

**The rule:** a feature owns its models, providers and screens. Cross-feature
access goes through `core/`, never by reaching into another feature's folder.

---

## Features

| Feature | Screens | Data source |
|---|---|---|
| `splash` | splash | — |
| `auth` | login, registration | ✅ API |
| `booking` | arena list, arena detail, arena info, fullscreen table | 🔴 **mock** |
| `matchmaking` | challenges, challenge detail, create challenge | 🔴 **mock** |
| `wallet` | wallet | ✅ API (+ Razorpay) |
| `profile` | player profile, edit profile | ✅ API |
| `scoring` | **live scoring**, **official matches**, score entry | ✅ API (live scoring); score entry is legacy |

---

## Routes

Defined in [`core/navigation/app_router.dart`](../flutter_app/lib/core/navigation/app_router.dart).
A `routerNotifierProvider` listens to profile state so the router re-evaluates
its redirect the moment a session appears or expires.

| Path | Screen | Notes |
|---|---|---|
| `/` | splash | decides where to send you |
| `/login`, `/register` | auth | phone + OTP |
| `/discover` | arena list | inside the shell (bottom nav) |
| `/challenges` | challenges | shell |
| `/wallet` | wallet | shell |
| `/profile` | player profile | shell |
| `/score/:matchId` | **live scoring** | the official's scoreboard |
| `/official/matches` | **official fixtures** | an official's assigned matches |
| `/score-entry` | score entry | legacy dual-captain entry |
| `/create-challenge` | create challenge | |
| `/edit-profile` | edit profile | |

The four shell routes use `NoTransitionPage` so bottom-nav switching does not animate.

---

## State — Riverpod

Every provider in the app:

| Provider | File | Kind |
|---|---|---|
| `profileProvider` | core/providers/profile_provider | session + user, the auth source of truth |
| `isProfileLoadingProvider` | core/providers/profile_provider | |
| `localeProvider`, `l10nProvider` | core/providers/locale_provider | |
| `themeProvider` | core/providers/theme_provider | |
| `authServiceProvider`, `firebaseServiceProvider`, `authStateProvider` | core/providers/services_providers | |
| `apiClientProvider` | core/services/api_client | |
| `routerNotifierProvider`, `routerProvider` | core/navigation/app_router | |
| `authControllerProvider` | features/auth | |
| `arenasProvider` | features/booking | **mock-backed** |
| `challengesProvider` | features/matchmaking | **mock-backed** |
| `walletProvider` | features/wallet | `Notifier` |
| `liveScoringProvider` | features/scoring | `Notifier` |
| `officialMatchesProvider` | features/scoring | `FutureProvider.autoDispose` |

**Riverpod 3 note.** `StateNotifier` is gone; use `Notifier` +
`NotifierProvider(X.new)`. `NotifierProvider.family` with a `FamilyNotifier`
does **not** type-check in this version — `liveScoringProvider` is a plain
`Notifier` with an explicit `open(matchId)` call instead, which is also the
right model since an official scores one match at a time.

---

## Networking

[`core/services/api_client.dart`](../flutter_app/lib/core/services/api_client.dart) — `get` / `post` / `patch`.

- **Base URL** from `AppConstants.apiBaseUrl`: `10.0.2.2:5001` on Android
  (the emulator's alias for the host machine), `localhost:5001` elsewhere.
- **Auth**: reads `profileProvider` and attaches `Authorization: Bearer …`.
- **Envelope**: unwraps `{ success, data, error }`; on failure throws
  `ApiException` carrying the server's message, including flattened Zod
  `details` so validation errors surface verbatim.

Paths live in [`core/constants/api_routes.dart`](../flutter_app/lib/core/constants/api_routes.dart).

---

## Live scoring (the officials feature)

Mirrors the web scoreboard exactly, against the same endpoints, so an official
can pick up either device mid-match. See
[`games_rule/badminton.md`](./games_rule/badminton.md) and
[`featuredoc/11`](./mvp/featuredoc/11-officials-marketplace.md).

```
features/scoring/
  models/rally_state.dart          GameScore, DoublesPositions, RallyState, LiveMatch
  providers/live_scoring_provider  load / start / recordPoint / undo / timeout / confirmResult
  presentation/
    live_scoring_screen.dart       the board
    official_matches_screen.dart   fixture list — the entry point on mobile
    widgets/court_view.dart        court from above, server's cell marked
    widgets/score_header.dart      per-side rows + umpireCall()
    widgets/point_zones.dart       the two tap targets + OutcomeTags
```

**The one rule that governs this feature: the app never computes a score.** It
sends "point to creator" and renders the state the server returns. Any scoring
rule implemented in Dart would be a second source of truth — which is the exact
thing officials exist to prevent.

Consequences worth keeping:

- `RallyState` is a dumb transport shape. `fromJson` only, no logic beyond
  `gamesWon` (a display tally).
- Every command carries a client-generated **idempotency key**, so a retried
  tap on bad signal is a no-op rather than a phantom point.
- The match clock ticks against the real `startedAt` instant, not a local
  counter — a backgrounded app freezes timers and would under-report.
- Outcome tags (winner / unforced error / service fault) are **one-shot**: they
  apply to the next rally then clear. A sticky tag would silently mis-attribute
  every following point.

---

## The mock problem

**Eight files still read `core/mock/seed_data.dart`** while a working backend
sits unused:

```
features/booking/providers/arenas_provider.dart
features/booking/presentation/arena_list_screen.dart
features/booking/presentation/arena_detail_screen.dart
features/booking/presentation/arena_info_screen.dart
features/matchmaking/providers/challenges_provider.dart
features/matchmaking/presentation/challenges_screen.dart
features/matchmaking/presentation/challenge_detail_screen.dart
features/matchmaking/presentation/create_challenge_screen.dart
```

Discovery and matchmaking are therefore demo-only on mobile. Auth, wallet,
profile and live scoring are real. This is the single largest gap in the app and
is tracked as the Flutter blocker in [`progress.md`](./progress.md).

---

## Known issues

| # | Issue | Where |
|---|---|---|
| 1 | **`ApiClient` pretty-prints every request and response body** with `print()`. Those payloads carry OTP codes, phone numbers and tokens — a captured log or a shipped release build is a credential leak. The web client already redacts (`api.ts` `REDACTED_KEYS`); this does not. | `core/services/api_client.dart` |
| 2 | **`AppColors.isDarkMode` is a global mutable static.** Colours are read as statics at build time, so the theme is not reactive per widget tree and a toggle relies on a full rebuild. | `core/theme/app_theme.dart` |
| 3 | **No token refresh.** The app uses `http`, not dio, and nothing intercepts a 401 to refresh. `tasks.md` M1's done-when ("single-flight refresh under 10 parallel 401s") cannot currently pass. | `core/services/api_client.dart` |
| 4 | Discovery and matchmaking are mock-backed — see above. | 8 files |

---

## Conventions

- Money is **integer paise** end to end. Format at the edge, never store rupees.
- IDs in URLs are `publicId`, never Mongo ObjectIds.
- Screen-local widgets go in that screen's `widgets/` folder, not `core/widgets/`.
  `core/widgets/` is for things two features both use.
- Prefer `Notifier` over ad-hoc `StateProvider` for anything with more than one field.
- Status/serving indicators must never rely on colour alone — pair every colour
  with a dot, label or icon (mirrors `design_system.md §2 rule 3`).
