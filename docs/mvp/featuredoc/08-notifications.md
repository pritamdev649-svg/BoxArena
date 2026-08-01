# 08 — Notifications

**PRD:** [§4.8](../../prd.md) · **Roadmap:** M8 · **Task IDs:** B9, F3.6, M5
**Status:** Backend ✅ 3/3 · Web 🔴 · Flutter 🟡 (FCM configured, no inbox)

---

## What it is

An **in-app inbox is the source of truth**; FCM is only the transport. Per-type preferences
and quiet hours are respected. Every notification deep-links to the screen it's about.

## Design rules that must not be relaxed

| Rule | Why |
|---|---|
| Write the **inbox row first**, then multicast via FCM | A push that fails must not lose the notification. The inbox is the record |
| **Always fire post-commit** | A "you won ₹500" push for a transaction that then rolls back is unrecoverable trust damage |
| Prune dead tokens on `UNREGISTERED` | Silent delivery failure otherwise accumulates forever |
| Respect prefs and quiet hours **server-side** | Client-side muting still wakes the phone |
| Every `NotificationType` has a designed row **and a working deep link** | F3.6's done-when |

## API surface — 3/3 ✅

| Method | Path | Status |
|---|---|---|
| `GET` | `/notifications` | ✅ |
| `POST` | `/notifications/:id/read` | ✅ |
| `POST` | `/notifications/read-all` | ✅ |

Token management lives in [01 — Auth & Profiles](./01-auth-profiles.md):
`POST` / `DELETE /users/me/fcm-token`.

## Models

`Notification` · `User.notificationPrefs`

## Background jobs

`slotReminders` — every 10 min ("your match is in 2 hours").
`pruneFcmTokens` — weekly, drops tokens that returned `UNREGISTERED`.

## Where it's built

| Surface | Files | Notes |
|---|---|---|
| Backend | [`modules/notifications/`](../../../backend/src/modules/notifications/), [`config/firebase.ts`](../../../backend/src/shared/config/firebase.ts) | Complete |
| Web | — | **No inbox route** |
| Flutter | [`firebase_service.dart`](../../../flutter_app/lib/core/services/firebase_service.dart), `firebase_messaging` in pubspec | FCM transport configured; **no inbox screen** |

## Gaps

1. **No inbox UI on either surface** — which means the "inbox is the source of truth" rule is currently aspirational. FCM is the only delivery path, so a missed push is a lost notification.
2. **No deep-link routing verified.** Flutter has `go_router`; F3.6 and M5 both require every notification type to land on the right screen. `[verify]`
3. **No per-type preference UI.**
4. Notification types that reference unbuilt screens (teams, match history, leaderboards) will dead-end until those ship.

## Security note

`backend/serviceAccountKey.json` exists on disk and is **correctly covered** by the root
[`.gitignore`](../../../.gitignore) (`serviceAccount*.json`, alongside `google-services.json`
and `*.keystore`). Nothing is committed yet — the project is not a git repository. Initialise
it with that `.gitignore` already in place, and keep the launch-gate check in mind:
**no secrets in the APK**, verified by `unzip` + `grep`.
