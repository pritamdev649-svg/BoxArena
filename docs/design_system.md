# Design System — BoxArena

## 1. The Decision: Floodlit Night

**Direction: dark, broadcast-grade, floodlit.** Near-black surfaces, electric volt-green accent, condensed uppercase display type, tabular numerals, sharp geometry.

### Why this, and not green-and-friendly

Every Indian competitor looks the same. Playo is white with forest green, rounded and casual. PlaySpots is navy-and-green but softens it with cartoon characters. Both read as *"a convenient way to book a turf."*

BoxArena's proposition is different: **this is a real league, your record is permanent, and money is on the line.** A friendly pastel booking app cannot carry that claim — the visual language would contradict the product every time someone stakes ₹500.

Hudl proves the dark broadcast aesthetic works in sport and reads as *professional tool*. CricHeroes proves the emotional angle ("we make grassroots cricketers heroes") is what people actually buy. **BoxArena = Hudl's look carrying CricHeroes' feeling, aimed at one city's turf players.**

The literal reference is real: box cricket and turf football in Lucknow are played **at night, under floodlights.** The product should look like the thing it's for.

> **One rule that protects the positioning:** no cartoon illustrations, no mascots, no clip-art. Real photography of real local players, or nothing. The moment it looks cute, it stops looking like somewhere you'd stake money.

---

## 2. Color

```
/* Base — near-black with a cool cast, never pure #000 */
--bg-base        #0A0E13   page
--bg-surface     #121821   cards
--bg-elevated    #1B232E   modals, popovers, raised rows
--bg-inset       #070A0E   wells, code, score strips

/* Borders */
--border-subtle  #1E2733
--border-default #2A3644
--border-strong  #3B4A5C

/* Text */
--text-primary   #F2F5F8
--text-secondary #9AA8B8
--text-muted     #64748B
--text-inverse   #0A0E13

/* VOLT — the brand accent. Floodlight glare / tennis-ball yellow-green. */
--volt-400       #D4FF57
--volt-500       #C2F53C   ← primary. CTAs, active states, focus rings
--volt-600       #A5D62B
--volt-glow      rgba(194, 245, 60, 0.18)

/* Semantic */
--win            #34D77F   won, verified, confirmed, available
--loss           #F0556B   lost, cancelled, unavailable
--dispute        #FFA524   disputed, pending, held, SLA warning
--info           #4DA6FF   informational
--gold           #FFC245   prize money, winnings, podium, MVP

/* Sport accents — instant orientation in mixed lists */
--sport-cricket   #FF8A3D
--sport-football  #4DA6FF
--sport-badminton #C2F53C
```

**Volt is not Playo's green.** Playo uses a mid-saturation forest green (`#4CAF50`-ish) that reads friendly and safe. Volt is a high-chroma yellow-green that reads *electric*. Side by side they are not confusable.

### Color rules

1. **Volt is for action, never decoration.** If everything glows, nothing does. One primary volt element per view.
2. **Money is gold, not volt.** Prize pools, winnings, and payouts use `--gold`. This separation means a user learns to read gold as "this is real money" — worth protecting.
3. **Never encode outcome in color alone.** Won/lost always carries a label or icon. ~8% of Indian men have some red-green deficiency, and this app is mostly men judging red-green win/loss states.
4. **Contrast floor: 4.5:1 for text, 3:1 for UI boundaries.** Volt on near-black passes easily; **volt text on white does not** — on light backgrounds use `--volt-600` or darker.
5. **Light mode is Phase 2.** Ship dark-only and do it well. A half-committed dual theme is worse than one confident one.

---

## 3. Typography

```
Display  — "Archivo Expanded" 700/800, or Anton
           UPPERCASE, tight tracking (-0.02em)
           Scoreboards, hero headlines, team names, section heads

UI/Body  — "Inter" 400/500/600
           Sentence case. All interface text.

Numerals — Inter with font-variant-numeric: tabular-nums
           MANDATORY for scores, money, timers, tables, leaderboards
```

**Tabular numerals are a functional requirement, not taste.** A leaderboard or a live score where digits shift width as they change looks broken and reads as amateur. Set it globally on any element rendering a number that updates or aligns in a column.

Both fonts are on Google Fonts, free, and support Devanagari (Inter does) for Phase 2 Hindi.

### Scale

| Token | Size / Line | Use |
|---|---|---|
| `display-xl` | 56 / 1.0 | Landing hero |
| `display-lg` | 40 / 1.05 | Page titles |
| `display-md` | 28 / 1.15 | Section heads |
| `score-hero` | 64 / 1.0 | The score on a match detail |
| `score-card` | 32 / 1.0 | Score in a list row |
| `body-lg` | 18 / 1.5 | Lead paragraph |
| `body` | 16 / 1.5 | Default |
| `body-sm` | 14 / 1.45 | Secondary |
| `caption` | 12 / 1.4 | Timestamps, meta |
| `label` | 11 / 1.2 | UPPERCASE, +0.08em tracking, chips and column heads |

Minimum body size on mobile is **14px**. Playo's dense cards drop to ~10px for metadata and it is genuinely hard to read outdoors — which is exactly where this app gets used.

---

## 4. Geometry & Motion

- **Radius**: 4 (chips) / 8 (buttons, inputs) / 12 (cards) / 16 (sheets). Nothing fully rounded except avatars. Pill-shaped buttons read consumer-casual; slightly-squared reads tool.
- **Angled accents** — a 6–8° skew on section dividers and badge edges, borrowed from Hudl. Use sparingly, twice per page maximum.
- **Elevation is border + subtle glow**, not drop shadow. Shadows are invisible on near-black; a 1px `--border-default` and a faint volt glow on focus does the work.
- **Motion**: 150ms ease-out for state changes, 250ms for sheets. **Respect `prefers-reduced-motion`.** No parallax, no scroll-jacking — the marketing site must stay fast on a mid-range Android on 4G.

---

## 5. Signature Components

**Score strip** — the thing people screenshot and share to WhatsApp. Two teams, tabular score, winner side marked with a volt left-edge bar and a `WON` chip. Must be legible at thumbnail size and must render correctly in an OG image.

**Match status chip** — one glanceable token: `SCHEDULED` (muted) · `AWAITING SCORES` (info) · `NEEDS YOUR CONFIRMATION` (volt, pulsing once) · `VERIFIED` (win) · `DISPUTED` (dispute) · `VOIDED` (muted, struck).

**Prize badge** — gold, always paired with a ₹ amount in tabular figures. Never volt.

**Slot grid** — the booking core. Available = surface + border. Selected = volt fill, inverse text. Booked = inset, muted, struck. Held-by-you = volt outline + countdown. Blocked = diagonal hatch. Must be usable one-handed with 44px minimum targets.

**Leaderboard row** — rank (tabular, gold for 1–3), avatar, name, area, ELO (tabular, right-aligned), delta arrow in win/loss color.

---

## 6. Voice

Confident, local, factual. Never cute.

| Write | Don't |
|---|---|
| "Gomti Nagar · 2.1 km" | "Super close to you! 🎉" |
| "Opponent submitted 21-18, 19-21, 21-15. Confirm?" | "Uh oh! Scores don't match 😬" |
| "₹450 credited to winnings" | "Cha-ching! You won big!" |
| "Slot held for 4:32" | "Hurry! Almost gone!!" |
| "3 of 4 courts booked" | "Filling fast!" |

Money and disputes get **plain, precise, unexcited** language. Any hint of hype next to a rupee amount reads as a scam — which is the single thing this product cannot afford.

Hindi/Hinglish is fine in marketing ("Lucknow ka apna league"), never in transactional UI.

---

## 7. Taglines

Primary — the league claim:
> **Lucknow's real league. Book it. Play it. Win it.**

Alternates:
- *Every match counts. Every rank is earned.*
- *Where Gomti Nagar finds out who's actually best.*
- *Your record follows you.*

Answering CricHeroes' *"we make grassroots cricketers heroes"* — theirs is about feeling; ours is about **stakes**: the table is real, the payout is automatic.

Arena-partner side:
> **Fill your empty slots. Get paid on time.**

---

## 8. Not Looking AI-Generated

Generated UI has a recognisable smell: technically correct, visually anonymous. It looks like a template someone forgot to finish. The tells are specific and avoidable.

### 8.1 The banned list

| Never | Why it reads as generated | Instead |
|---|---|---|
| Purple/violet gradients | The single most recognisable LLM default | Flat `--bg-surface`. One volt accent |
| Gradient text headings | Decoration with no meaning | Solid `--text-primary`, weight does the work |
| Emoji as UI icons (🏏 ⚡ 🎯) | Instantly amateur; renders differently per OS | Lucide icons at 1.5px stroke, or nothing |
| An icon in a rounded square above every feature | The universal "AI landing page" block | Real screenshots, real photos, or plain type |
| Three equal cards in a row, three times down the page | No hierarchy — everything shouts equally | Vary block width, density, and rhythm |
| `backdrop-blur` glassmorphism everywhere | 2021 template default | Solid surfaces + a 1px border |
| Everything centered | Nothing to anchor the eye | Left-align content; center only heroes |
| Uniform 24px gaps everywhere | Mechanical, no breathing | Deliberate rhythm — see 8.2 |
| "Welcome back! Here's what's happening 👋" | Nobody talks like that | "Wednesday, 14 Aug · 2 matches this week" |
| `shadcn` defaults untouched | Recognisable at a glance | Retheme radius, borders, and focus rings first |
| Lorem ipsum / "John Doe" / stock avatars | Fake content produces fake-looking layouts | Real Lucknow names, real turf photos |
| A spinner for every load | Layout jumps, feels cheap | Skeletons matching final geometry |
| `box-shadow` on a dark theme | Invisible; adds nothing but mud | Borders + a faint volt glow |

### 8.2 Spacing rhythm

Generated layouts use one gap value everywhere. Crafted layouts vary density on purpose — related things are tight, unrelated things are far apart.

```
4px   inside a chip
8px   label → value
12px  rows inside a card
24px  card → card
48px  section → section
96px  major page divisions
```

**Proximity encodes meaning.** A score and its team name sit 8px apart because they're one idea; the next match is 24px away because it's a different one. When everything is 24px, the reader has to do that grouping work themselves — and it *feels* like work, even if they can't say why.

### 8.3 Let type carry the hierarchy, not boxes

The default generated move is: uncertain about hierarchy → wrap it in a card. Ten cards later everything has equal weight and nothing leads.

A league table needs **no cards**. It needs a heading, tabular numerals, aligned columns, and a hairline rule between rows. Look at any broadcast scoreboard: almost no containers, total clarity.

> **Rule:** a card must earn its border. If removing it loses no meaning, remove it.

### 8.4 Real content, always

Design against the worst real data you have, not the prettiest:

- A 40-character team name. Hindi text. A player with 0 matches.
- An arena with 1 blurry photo. A 3-day-old unresolved dispute.
- ₹1,23,456.50 in a column beside ₹50.

Mock data must come from `docs/` seed content — real Lucknow areas (Gomti Nagar, Aliganj, Hazratganj), plausible names, real turf photography. **The moment a layout is built on "Team A vs Team B", it stops surviving contact with reality.**

### 8.5 The details that read as craft

None of these are noticed individually; together they're the whole difference.

- **Tabular numerals** on every score, price, timer, and table column (§3).
- **Optical alignment**: an icon beside text usually needs 1px of nudge. Trust the eye over the number.
- **Typographic punctuation**: `₹1,234` with Indian grouping, `—` not `--`, `·` as a separator, non-breaking space before units.
- **Focus rings on everything**, styled to match — never `outline: none`.
- **Varied motion**: 120ms for a hover, 200ms for a state change, 320ms for a sheet. One duration everywhere feels robotic.
- **Active states**, not just hover. Half your users are on touch and will never hover.
- **Loading states that match final geometry** so nothing shifts when data lands.
- **Text selection colour** set to volt at low alpha. Nobody notices; everybody feels it.

### 8.6 Sport-specific texture

The cheapest way to stop looking generic is to look like the *thing it's for*. This is a sports league, so borrow from sports broadcast:

- Score strips with a hard volt edge on the winner, like a TV lower-third.
- League tables with rank, form (`W W L W D` as small pills), and points — the shape every football fan already reads fluently.
- Fixture lists grouped by date with sticky date headers.
- Team crests as circular avatars with a 1px ring; fall back to monogram initials on the sport accent colour, never a generic grey person icon.
- A floodlit-turf photo, dark-overlaid, as the only hero image on the site.

### 8.7 The review test

Before any screen ships, ask:

```
□ Could this be any product, in any category?          → too generic
□ Is there one clear focal point?                      → if not, flatten something
□ Does it survive a 40-char name and ₹1,23,456?        → test it
□ Do empty / loading / error states exist and look designed?
□ Is there exactly one volt element competing for attention?
□ Would a Lucknow turf player recognise this as a league, not a form?
```

If a screen is all evenly-spaced cards with icon-title-subtitle, it will look generated no matter how good the code is. Delete half the containers and let the content lead.

---

## 9. Implementation

**As built:** Tailwind **v4**, which is CSS-first — there is no `tailwind.config.ts`. All tokens live in an `@theme` block in `web/src/app/globals.css`, which is the single source of truth. Flutter mirrors the same names in `lib/core/theme/` (`AppColors`, `AppTypography`, `AppSpacing`) so a change is a two-file change and design reviews share one vocabulary.

```css
/* web/src/app/globals.css */
@import 'tailwindcss';

@theme {
  --color-base: #0a0e13;
  --color-surface: #121821;
  --color-volt: #c2f53c;
  --color-gold: #ffc245;
  --radius-control: 8px;   /* generates `rounded-control` automatically */
}
```

⚠️ **Tailwind v4 gotcha, already hit once.** The v3 arbitrary syntax `rounded-[--radius-control]` compiles to the invalid declaration `border-radius: --radius-control`, which browsers silently drop — buttons render with sharp corners and nothing errors. In v4, a `--radius-*` theme key auto-generates its utility, so write `rounded-control`. Same for `--color-*` → `bg-volt`, `text-gold`.

Verify tokens actually resolved after any theme change:
```bash
grep -oE "\.rounded-control\{[^}]*\}" $(find .next -name '*.css' | head -1)
# expect: .rounded-control{border-radius:var(--radius-control)}
```

```css
/* non-negotiable globals */
@utility tabular { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
:focus-visible { outline: 2px solid var(--color-volt); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
  animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

### Accessibility floor
Every interactive element ≥ 44×44px · visible focus ring everywhere · outcome never by color alone · body ≥ 14px on mobile · usable at 200% text scale · screen-reader labels on all icon-only buttons.

The app is used at night, outdoors, on a phone, by someone who just finished playing. Design for tired eyes and sweaty thumbs.
