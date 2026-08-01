# BoxArena — Lucknow Box-Cricket, Turf-Football & Badminton League

Complete product, technical, and operational specification for **BoxArena**, written to be fed to an AI coding agent and turned into a working codebase.

**What it is:** the organized amateur sports league for a city — book a turf, find opponents at your level, record verified scores, climb a real leaderboard, and (once legally cleared) play for money. Launching in Lucknow, badminton first.

---

## 📂 Documentation

| Doc | What it covers |
|---|---|
| [prd.md](docs/prd.md) | Vision, personas, MVP scope with acceptance criteria, non-functional requirements, success metrics |
| [technical_spec.md](docs/technical_spec.md) | Architecture, stack, layering rules, directory layouts, key subsystems, security, testing, deployment |
| [mongodb_schemas.ts](docs/mongodb_schemas.ts) | 21 Mongoose models — users, arenas, courts, slots, bookings, teams, challenges, matches, disputes, ledger, payments, stats, audit |
| [api_contract.md](docs/api_contract.md) | Every endpoint, error code, and background job. The contract shared by all three clients |
| **[edge_cases.md](docs/edge_cases.md)** | **124 failure modes and the rules that handle them. The most important file here** |
| [competitive_analysis.md](docs/competitive_analysis.md) | Playo / CricHeroes / PlaySpots / Hudl teardown, the positioning, and 14 features they ship that we'd missed |
| **[tasks.md](docs/tasks.md)** | **The execution backlog — frontend-first, with dependencies and "done when" per task** |
| [code_standards.md](docs/code_standards.md) | Feature-based architecture, size budgets, naming, TypeScript rules — all lint-enforced |
| [design_system.md](docs/design_system.md) | The "floodlit night" theme — color, type, components, voice, and §8 on not looking AI-generated |
| [arena_onboarding.md](docs/arena_onboarding.md) | How a venue goes from lead to live: application → wizard → ops verification → settlement |
| [compliance.md](docs/compliance.md) | Real-money gaming, TDS/GST, KYC, DPDP, app-store policy — and the kill-switches that make them enforceable |
| [phased_roadmap.md](docs/phased_roadmap.md) | Milestones M0–M8, F1–F4, W1–W3, and the launch gate |
| [claude_instructions.md](docs/claude_instructions.md) | One-shot backend prompt + 15 staged build prompts |
| [env/README.md](env/README.md) | Google Maps (4 keys), Razorpay, Firebase, MSG91, MongoDB replica set setup |

**Env templates:** [backend](env/backend.env.example) · [flutter](env/flutter.env.example) · [web](env/web.env.example)

**Reference screenshots:** [docs/screenshots/](docs/screenshots/) — Playo, CricHeroes, PlaySpots web + partner apps

---

## 🏗️ What gets built

```
backend/       Node + Express + TypeScript + Mongoose  (REST API + cron workers)
flutter_app/   Flutter                                 (player app, Android + iOS)
web/           Next.js 14 — ONE app, three audiences:
                 /          public SEO site, leaderboards, arena pages
                 /partner   arena owner + desk staff panel
                 /admin     ops: disputes, applications, payouts
```

Backed by MongoDB (replica set), Redis, Firebase FCM, Razorpay, Google Maps, and S3.

**Positioning:** not a booking app (Playo owns that) and not a stats app (CricHeroes owns that) — **the city's real league**, where booking and stats are features underneath escrowed entry fees and automatic verified payouts. See [competitive_analysis.md](docs/competitive_analysis.md).

---

## 🚀 Building it

1. **Read [edge_cases.md](docs/edge_cases.md) first.** It's the difference between a demo and something you can route money through.
2. Set up third-party accounts using [env/README.md](env/README.md) — Maps keys and DLT registration have lead times, so start them early.
3. **Work through [tasks.md](docs/tasks.md) in order.** It runs frontend-first against a mock API, so you have a clickable demo for turf owners in week 2 and the backend drops in behind an already-proven UX.
4. Use [claude_instructions.md](docs/claude_instructions.md): §A2 for the frontend foundation, §A for a one-shot backend, §B to build stage by stage.
5. Attach **all** the docs as context. Dropping `edge_cases.md` to save tokens is the most expensive saving available.

```bash
cp env/backend.env.example backend/.env
cp env/flutter.env.example flutter_app/.env
cp env/web.env.example     web/.env.local
```

---

## ⚠️ Five things that will bite you

1. **MongoDB must be a replica set**, even locally. Transactions silently no-op on standalone `mongod` — so every wallet guarantee vanishes without a single error, and you find out in production.
2. **Money is integer paise, never floats.** ₹250.50 is `25050`.
3. **You need four Google Maps keys**, restricted four different ways. One shared key ends up extracted from your APK and billed by strangers — set a budget alert on day one.
4. **Badminton `21-18` and `18-21` from opposite sides are the same result.** Normalise perspective before comparing, or every honest match becomes a dispute.
5. **Ship with `ENABLE_PAID_CHALLENGES=false`.** Free bookings, teams, scoring and leaderboards are a complete, launchable product with none of the regulatory exposure. Turn the money loop on later, server-side, once legal and store approvals land — no new build required.

---

## 🎨 Two standards that get skipped

**Feature-based, or it rots.** Code that changes together lives together — `features/booking/` on the web, `modules/booking/` on the backend. Boundaries are lint-enforced, not trusted. Size budgets fail CI. See [code_standards.md](docs/code_standards.md).

**Premium, not generated.** [design_system.md §8](docs/design_system.md) is a specific banned list: no purple gradients, no emoji icons, no icon-in-rounded-square feature grids, no untouched shadcn defaults, no "Team A vs Team B". A card must earn its border; league tables need type hierarchy, not containers. Every screen passes the §8.7 review test before it ships.

---

## 📋 Status

Specification stage — no code yet. Documents are written to be built from directly.
