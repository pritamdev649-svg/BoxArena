# Environment & Third-Party Setup — BoxArena

Four apps, four `.env` files. Copy each `*.env.example` to its app folder and fill it in.

Three apps, three `.env` files. Copy each `*.env.example` to its app folder and fill it in.

| File | Copy to | Notes |
|---|---|---|
| `backend.env.example` | `backend/.env` | Holds every real secret |
| `flutter.env.example` | `flutter_app/.env` | Nothing here is secret — see below |
| `web.env.example` | `web/.env.local` | Public site **+ `/partner` + `/admin`** — one Next.js app |

```bash
# from repo root, once each app exists
cp env/backend.env.example backend/.env
cp env/flutter.env.example flutter_app/.env
cp env/web.env.example     web/.env.local
```

Add to `.gitignore` on day one:
```
.env
.env.*
!.env.example
google-services.json
GoogleService-Info.plist
serviceAccount*.json
*.jks
*.keystore
```

---

## 🗺️ Google Maps — you need FOUR keys, not one

This is the part most projects get wrong. A single unrestricted key shared across app, web, and server is the most common cause of a surprise five-figure Google bill: it ships inside your APK, someone pulls it out with `apktool`, and bills your project.

Each key is restricted by a *different mechanism*, which is why they can't be shared.

| Key | Lives in | Restriction type | APIs to enable |
|---|---|---|---|
| **Android** | `flutter_app/.env` → AndroidManifest | Android apps: package name + SHA-1 | Maps SDK for Android |
| **iOS** | `flutter_app/.env` → AppDelegate | iOS apps: bundle ID | Maps SDK for iOS |
| **Browser** | `web/` (public, `/partner`, `/admin`) | HTTP referrers | Maps JavaScript API, Places |
| **Server** | `backend/.env` only | IP addresses | Geocoding, Places, Distance Matrix |

### Setup, start to finish

1. **Create a project** at [console.cloud.google.com](https://console.cloud.google.com) → new project `boxarena`.
2. **Enable billing.** Maps returns `REQUEST_DENIED` without it, even inside the free tier. There is a recurring monthly credit; a low-traffic MVP typically stays inside it.
3. **Enable APIs** → *APIs & Services → Library*: Maps SDK for Android, Maps SDK for iOS, Maps JavaScript API, Geocoding API, Places API, (optional) Distance Matrix API.
4. **Create 4 keys** → *Credentials → Create credentials → API key*. Rename each (`boxarena-android`, `-ios`, `-browser`, `-server`).
5. **Restrict every one of them** — both *Application restrictions* and *API restrictions*. An unrestricted key is a liability, not a convenience.
6. **Get your Android SHA-1s** (register debug *and* release, or maps render as a grey grid in release builds):
   ```bash
   # debug
   keytool -list -v -keystore ~/.android/debug.keystore \
     -alias androiddebugkey -storepass android -keypass android
   # release
   keytool -list -v -keystore release.jks -alias <your-alias>
   ```
   Using Play App Signing? Google re-signs your app — copy the SHA-1 from *Play Console → Setup → App integrity* instead, or maps break only in production.
7. **Set budget alerts** → *Billing → Budgets & alerts*: alert at ₹1,000 / ₹5,000. Then *APIs & Services → Quotas* and cap daily requests per API. Do this before writing any map code.

### Architectural rule

> The mobile app and browser **display** maps. They never **call** Geocoding or Places directly.

Autocomplete and reverse-geocoding go through your backend's `/geo/autocomplete` and `/geo/reverse` endpoints, which use the server key, cache results for 30 days, and rate-limit per user. This keeps the billable key un-extractable and makes your Maps spend roughly flat regardless of user count. See `docs/edge_cases.md` §7.

### Indian alternatives

If Google's pricing becomes an issue at scale, **Mappls (MapmyIndia)** and **Ola Maps** have better Indian address coverage and cheaper geocoding. Keep all map calls behind a `GeoService` interface in the backend so swapping providers is a one-file change. The `Arena.location` GeoJSON field is provider-agnostic already.

---

## 💳 Razorpay

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com) → stay in **Test Mode** for all of Phase 1.
2. *Settings → API Keys → Generate*. `key_id` may go to clients; `key_secret` is backend-only.
3. *Settings → Webhooks → Add*:
   - URL: `https://<your-api>/api/v1/webhooks/razorpay`
   - Secret: generate one, paste into `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`
4. Local webhook testing: `ngrok http 5000` and use the public URL.
5. **Verify the signature against the raw request body.** Mount `express.raw({type:'application/json'})` on that route only — the global `express.json()` parser reformats bytes and breaks the HMAC. This is edge case 31 and it catches nearly everyone once.
6. Going live needs business KYC. Real-money payouts additionally need RazorpayX and, in this product category, legal review first.

---

## 🔔 Firebase (FCM)

1. [console.firebase.google.com](https://console.firebase.google.com) → new project. **Use separate projects for dev and prod** — a test push to production users is not recoverable.
2. Add Android app (package `com.boxarena.app`) → download `google-services.json` → `flutter_app/android/app/`.
3. Add iOS app (bundle `com.boxarena.app`) → download `GoogleService-Info.plist` → `flutter_app/ios/Runner/`.
4. iOS also needs an APNs auth key: Apple Developer → Keys → new key with APNs → upload the `.p8` to *Firebase → Cloud Messaging*. Push silently does nothing on iOS without it.
5. Backend: *Project Settings → Service Accounts → Generate new private key*. Either paste the fields into `FIREBASE_*`, or base64 the whole file:
   ```bash
   base64 -i serviceAccount.json | tr -d '\n'   # macOS
   ```
   into `FIREBASE_SERVICE_ACCOUNT_BASE64`. Never commit the JSON.
6. `FIREBASE_PRIVATE_KEY` gotcha: the value contains newlines. Wrap it in double quotes with literal `\n` escapes, and `.replace(/\\n/g, '\n')` when loading.

---

## 📱 MSG91 (OTP SMS)

1. [msg91.com](https://msg91.com) → get an auth key.
2. **DLT registration is legally mandatory in India.** Register your entity and your OTP template with a TRAI-approved DLT portal (Jio/Airtel/VI). Without it messages are dropped at the operator with no error surfaced to you. Budget 3–7 working days — start this early, it is a common launch blocker.
3. Template must match what you send, exactly, including the variable placeholder.
4. Until DLT clears, develop with `OTP_DEV_MODE=true` and `OTP_DEV_CODE=123456`.

---

## 🗄️ MongoDB

**Transactions require a replica set.** On a standalone `mongod`, sessions are silently ignored and every wallet guarantee in this project quietly disappears — in dev only, so you find out in production.

Local:
```bash
mongod --replSet rs0 --dbpath /usr/local/var/mongodb
mongosh --eval "rs.initiate()"
# MONGODB_URI=mongodb://127.0.0.1:27017/boxarena?replicaSet=rs0
```
Or `docker run -d -p 27017:27017 mongo:7 --replSet rs0` then initiate.

Atlas (recommended, free M0 tier): always a replica set. Choose the **Mumbai (ap-south-1)** region — latency and data residency both matter here.

---

## ✅ Pre-launch checklist

```
□ All 4 Maps keys created AND restricted (check each one individually)
□ Google Cloud budget alert + per-API daily quota caps set
□ Release SHA-1 registered (incl. Play App Signing key if used)
□ Razorpay webhook secret set; signature verified against raw body
□ Firebase prod project separate from dev; APNs .p8 uploaded
□ DLT template approved
□ MongoDB is a replica set in every environment
□ NODE_ENV=production, ENABLE_MOCK_PAYMENTS=false, OTP_DEV_MODE=false
□ Server refuses to boot if any [SECRET] is missing or still CHANGE_ME
□ JWT secrets rotated off the examples; access ≠ refresh secret
□ CORS lists exact origins, not *
□ COOKIE_SECURE=true on the admin panel
□ ENABLE_PAID_CHALLENGES stays false until legal sign-off
□ .env files confirmed absent from git:  git ls-files | grep -i env
```

Validate env at boot with Zod and **crash on missing values** — a server that starts with a blank `RAZORPAY_WEBHOOK_SECRET` will happily accept forged payment webhooks.
