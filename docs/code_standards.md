# Code Standards — BoxArena

Feature-based, maintainable, and enforced by tooling rather than goodwill. Every rule here is either lint-enforced or checked in review; a rule nobody can verify is a suggestion, and suggestions decay.

---

## 1. Feature-Based Architecture (all three codebases)

**The rule:** code that changes together lives together. When you add "cancel a booking", you should touch **one folder**, not five.

Type-based folders (`controllers/`, `services/`, `models/`) look tidy at 10 files and become a scavenger hunt at 200. Feature modules stay navigable because the folder *is* the feature.

### 1.1 Backend — `src/modules/<feature>/`

```text
backend/src/
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts        # route declarations only
│   │   ├── auth.controller.ts    # parse req -> call service -> shape res
│   │   ├── auth.service.ts       # business logic, transactions
│   │   ├── auth.repository.ts    # all Mongoose access
│   │   ├── auth.validators.ts    # Zod schemas
│   │   ├── auth.types.ts
│   │   ├── auth.service.test.ts  # colocated
│   │   └── index.ts              # PUBLIC API of this module
│   ├── arenas/  booking/  wallet/  payments/  teams/
│   ├── challenges/  matches/  disputes/  notifications/
│   ├── partner/  admin/  settlements/
├── models/                       # shared Mongoose models (cross-module)
├── shared/
│   ├── config/  errors/  middlewares/  utils/  types/
├── jobs/                         # cron workers, import services from modules
├── app.ts
└── server.ts
```

### 1.2 Web — `src/features/<feature>/`

```text
web/src/
├── app/                          # ROUTING ONLY — thin, no business logic
│   ├── (public)/  (auth)/  partner/  admin/
├── features/
│   ├── arenas/
│   │   ├── api/                  # TanStack Query hooks: useArenas, useArena
│   │   ├── components/           # ArenaCard, ArenaMap, SlotGrid
│   │   ├── hooks/
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   └── index.ts              # PUBLIC API
│   ├── booking/  wallet/  teams/  challenges/  matches/
│   ├── leaderboard/  partner/  admin/
├── shared/
│   ├── ui/                       # design-system primitives ONLY
│   ├── lib/                      # api client, auth, rbac, money, datetime
│   ├── hooks/
│   └── types/
└── styles/
```

### 1.3 Flutter — `lib/features/<feature>/`

Already specified in `technical_spec.md §3.2`: `data/` · `domain/` · `presentation/` per feature. Unchanged.

### 1.4 The import rules (lint-enforced)

1. A feature may import from `shared/`. Always allowed.
2. A feature may import another feature **only through its `index.ts` barrel** — never `features/booking/components/SlotGrid` from inside `features/arenas`.
3. `shared/` may **never** import from a feature. If shared code needs feature knowledge, it isn't shared.
4. `app/` composes features; it holds no business logic and no data transformation.
5. No circular dependencies, ever.

```js
// .eslintrc — enforced, not advisory
'import/no-restricted-paths': ['error', { zones: [
  { target: './src/shared', from: './src/features', message: 'shared/ must not depend on features/' },
  { target: './src/features/*/!(index.ts)', from: './src/features', except: ['./index.ts'],
    message: 'Import other features via their index.ts barrel' },
]}],
'import/no-cycle': ['error', { maxDepth: Infinity }],
```

---

## 2. Size & Complexity Budgets

Hard CI failures, not warnings. A budget you can exceed is not a budget.

| Unit | Limit | If exceeded |
|---|---|---|
| Function | 50 lines | Extract |
| React component | 150 lines | Split; move logic to a hook |
| File | 300 lines | Split by responsibility |
| Function params | 3 | Pass an options object |
| Cyclomatic complexity | 10 | Extract or use a lookup table |
| Nesting depth | 3 | Early returns / guard clauses |
| `useEffect` per component | 2 | You're syncing state that should be derived |

```js
complexity: ['error', 10],
'max-depth': ['error', 3],
'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
'max-params': ['error', 3],
```

---

## 3. Naming

Names are the documentation that can't go stale.

| Thing | Convention | Example |
|---|---|---|
| Files (web) | kebab-case | `slot-grid.tsx`, `use-wallet.ts` |
| Files (backend) | `<module>.<layer>.ts` | `booking.service.ts` |
| Components | PascalCase, noun | `SlotGrid`, `ScoreStrip` |
| Hooks | `use` + noun | `useWallet`, `useSlotHold` |
| Booleans | `is/has/can/should` | `isHeld`, `canCancel` |
| Handlers | `handle` + event | `handleSlotSelect` |
| Async fns | verb phrase | `fetchArena`, `confirmBooking` |
| Money vars | **always** `…Paise` | `entryFeePaise` |
| Dates | `…At` (instant) / `…Date` (calendar day) | `startAt`, `localDate` |
| Constants | SCREAMING_SNAKE | `MAX_HOLD_SECONDS` |

**Never**: `data`, `info`, `item`, `temp`, `handleClick2`, `utils.ts` as a dumping ground, or abbreviations beyond `id`/`url`/`api`.

**The `Paise` suffix is a safety rule, not a style rule.** It makes `total = subtotalPaise + feeRupees` visibly wrong at the call site.

---

## 4. TypeScript

```jsonc
// tsconfig.json — non-negotiable
"strict": true,
"noUncheckedIndexedAccess": true,   // arr[0] is T | undefined. It is.
"noImplicitOverride": true,
"exactOptionalPropertyTypes": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true
```

- **`any` is banned.** Use `unknown` and narrow. One `@ts-expect-error` per file maximum, with a comment explaining why.
- **Parse, don't validate.** External data (API responses, `process.env`, webhooks) enters through a Zod schema and exits typed. No casting.
- **Discriminated unions over optional-field soup.**
  ```ts
  // NO — every consumer must guess which fields are set
  type Match = { status: string; winnerId?: string; disputeId?: string }

  // YES — the compiler enforces the states
  type Match =
    | { status: 'scheduled' }
    | { status: 'verified'; winnerTeamId: string }
    | { status: 'disputed'; disputeId: string }
  ```
- **Branded types for IDs** so you cannot pass a `UserId` where an `ArenaId` belongs.
- Derive types from Zod schemas (`z.infer`) — one source of truth, no drift.

---

## 5. React / Next.js

1. **Server Components by default.** `'use client'` only for interactivity, and push it as far down the tree as possible.
2. **No business logic in components.** A component decides *what it looks like*; a hook or a `utils.ts` decides *what is true*.
3. **Derive, don't sync.** If a value can be computed from props/state, compute it. `useEffect` that sets state from other state is a bug.
4. **One responsibility per component.** If the name needs "And", split it.
5. **Server state ≠ client state.** TanStack Query owns server state. `useState` owns UI state. Never copy server data into `useState`.
6. **Every list needs four states**: loading (skeleton, not a spinner), empty (with an action), error (with retry), loaded. An undesigned empty state is the fastest way to look unfinished.
7. **Keys are stable IDs**, never array index.
8. **Money never touches `number` arithmetic in components.** Use `shared/lib/money.ts`.

---

## 6. Backend

Layering is strict and one-directional:

```
routes → middleware → controller → service → repository → model
```

| Layer | Does | Never |
|---|---|---|
| Route | Declares path + middleware chain | Contains logic |
| Controller | Parses `req`, calls **one** service method, shapes the response | Touches Mongoose, holds business rules |
| Service | Business logic, transactions, invariants | Sees `req`/`res` |
| Repository | All Mongoose access | Holds business rules |

**Services must be Express-free.** They take plain arguments and return plain values. That is what makes them callable from cron jobs and testable without HTTP.

```ts
// NO — untestable, unreusable
export async function cancelBooking(req: Request, res: Response) { … }

// YES
export async function cancelBooking(
  input: { bookingId: string; userId: string; reason: string },
  session?: ClientSession,
): Promise<CancelResult> { … }
```

Other rules:
- Every money mutation takes an optional `session` so callers can compose transactions.
- Repositories return domain objects, never raw Mongoose documents with `.save()` still attached.
- One `AppError` subclass per failure mode; controllers never build error responses by hand.
- No `process.env` outside `shared/config/env.ts`.

---

## 7. Testing

Colocated with the code. `booking.service.test.ts` sits beside `booking.service.ts`.

| Layer | Coverage floor | Focus |
|---|---|---|
| Services (money/concurrency) | **95%** | Every branch, every failure path |
| Services (other) | 80% | |
| Repositories | Integration only | Real replica-set memory server |
| Components | Behaviour, not markup | Testing Library, never snapshots of whole trees |
| E2E | The 5 critical flows | Book, challenge, score, dispute, payout |

Test names read as specifications:

```ts
it('releases the slot when the hold expires before payment', …)
it('rejects a badminton game of 30-28', …)
it('treats 21-18 and 18-21 from opposite sides as agreement', …)
```

The checklist in `edge_cases.md §11` is the definition of done. Write those tests *first*.

---

## 8. Comments

Code says **what**. Comments say **why**.

```ts
// NO
// increment the counter
count += 1;

// YES
// Google's pin for a turf is routinely 100-300m off, so we store the
// owner-confirmed coordinate rather than the geocoder's. See edge case 124.
const location = application.location.ownerConfirmedCoordinates;
```

Every non-obvious business rule cites its source: `// edge_cases.md §56` or `// BWF rule: win by 2 after 20-all`. That's how the next person knows it's deliberate.

**Delete commented-out code.** Git remembers.

---

## 9. Git & CI

**Commits**: `type(scope): subject` — `feat(booking): add slot hold countdown`. Imperative mood, under 72 chars.

**Branches**: `feat/`, `fix/`, `chore/` + short slug.

**PRs**: under ~400 lines of diff. Bigger than that and review quality collapses. Every PR states what changed, why, and how it was verified.

**CI blocks merge on**: typecheck → lint → test → build → bundle-size budget. No exceptions, no `--no-verify`.

Pre-commit (husky + lint-staged): format, lint the staged files, typecheck.

---

## 10. The Refactor Triggers

Refactor when you hit one of these, not on a schedule:

- The same logic appears a **third** time (twice is coincidence).
- A file needs scrolling to understand.
- A change requires touching more than 3 files across features.
- You add a boolean parameter to change a function's behaviour — split it instead.
- A test needs more than 10 lines of setup.
- You can't name something well, which usually means it does two things.
