# Compliance & Legal Considerations — BoxArena

> **This is an engineering checklist, not legal advice.** BoxArena moves real money between users. Before enabling `ENABLE_PAID_CHALLENGES`, get written advice from an Indian lawyer who works on real-money gaming, and a CA for the tax treatment. The technical controls below exist so that *when* you get that advice, the platform can already enforce it.

The product is buildable and launchable today without any of this — **free bookings, teams, scoring, and leaderboards carry none of this risk.** Everything here applies only to the paid-challenge loop.

---

## 1. Why this matters for the architecture

The riskiest possible outcome is building the money loop as an unremovable assumption, then discovering you must switch it off in one state or for one age group. Every control below is therefore a **runtime flag**, not a code change:

| Control | Mechanism |
|---|---|
| Master switch | `AppConfig.paid_challenges_enabled` — kills all paid play instantly, no deploy |
| Geographic | `AppConfig.blocked_states` checked at challenge create **and** accept |
| Age | `dateOfBirth` → 18+ gate on paid play and withdrawal |
| Financial ceilings | `min/max_entry_fee_paise`, daily withdrawal cap |
| Self-exclusion | `User.selfExcludedUntil`, `monthlyDepositLimitPaise` |
| Audit | `AuditLog` on every privileged action |

Build all six in Phase 1 even while `ENABLE_PAID_CHALLENGES=false`. Retrofitting them under regulatory pressure is far more expensive.

---

## 2. Game of skill vs. game of chance

Indian law broadly protects **games of skill**; games of chance are gambling and prohibited in most states. Badminton, cricket, and football played by the users themselves are about as clearly skill-based as it gets — this is materially safer ground than fantasy sports or card games.

That said, the legal position is state-specific and actively litigated. Several states have attempted or enacted bans covering online real-money games regardless of skill. The `RMG_BLOCKED_STATES` default in `backend.env.example` reflects states that have at various points restricted online money gaming — **it is a starting point that will be out of date; verify current law before launch and keep it in `AppConfig` so it can be updated without a deploy.**

Determine the user's state from their **registered address / KYC**, not from IP or GPS — VPNs and travel make those unreliable, and a wrong call in either direction is bad.

---

## 3. Taxation

Two separate things, often confused:

**TDS on winnings — s.194BA, Income Tax Act.** 30% on *net winnings*, deducted at withdrawal and again at financial-year end. Net winnings ≈ `(withdrawals + closing balance) − (deposits + opening balance)`. Store the computed `tdsPaise` on every `WithdrawalRequest` and issue Form 16A. This calculation has real subtleties across a financial year — have a CA review your implementation, not just your intent.

**GST.** 28% on the full deposit value for online money gaming, under the 2023 amendment. Whether and how it applies to your model materially affects unit economics — the platform, not the user, generally bears it. Model this in your pricing *before* launch; discovering a 28% cost after acquiring users is fatal.

Keep `TDS_PERCENT` and `GST_ON_DEPOSIT_PERCENT` configurable. Rates change.

---

## 4. KYC / AML

- KYC (PAN + one government ID) is required **before the first withdrawal**, not at signup — demanding it at signup will destroy your activation funnel.
- Store only `panLast4` and a document URL in private storage. Never the full PAN in plaintext.
- Bank account changes require OTP re-verification (a common account-takeover cash-out path).
- Flag for manual review: deposit → immediate withdrawal with no play, many accounts sharing a bank account or device, and unusual paired win/loss patterns between two accounts (collusion — see edge case 45).

---

## 5. Payments

Razorpay's live-mode approval for this category requires disclosing the business model. Real-money gaming attracts extra underwriting; do not assume approval is automatic, and start the conversation early. Automated payouts need RazorpayX with its own onboarding.

Maintain a clear separation between **user funds** and **platform revenue** in your ledger — commission is a distinct `TransactionType` and should be swept to a separate account. Commingling is a common finding in audits.

---

## 6. Data protection (DPDP Act, 2023)

- Consent at signup for processing; a plain-language privacy policy.
- Right to erasure — implemented as anonymisation, since financial records must be retained (edge case 8).
- Breach notification obligations to the Data Protection Board.
- Keep data in India (`ap-south-1` for both Atlas and S3).
- Children's data: under-18s need verifiable parental consent, which is a strong practical reason to simply block under-18 accounts from paid features.

---

## 7. App store policy

Google Play requires a separate declaration and, in India, participation in its real-money gaming program — with an approval process and its own restrictions. Apple's App Store rules on real-money gaming are stricter still and often require a licensed entity.

**Practical implication for Phase 1:** ship the app with paid challenges **disabled**, get approved as a sports booking and scoring app, then enable the money loop server-side once legal and store approvals are in hand. This is the single strongest argument for the runtime kill-switch design above — the store build never changes.

---

## 8. Responsible gaming

Implement from day one, not after an incident:
- User-set monthly deposit limits (`monthlyDepositLimitPaise`).
- Self-exclusion for a chosen period (`selfExcludedUntil`), irreversible before expiry.
- Visible display of net position (deposits vs. winnings) in the wallet.
- No advertising or push notifications framing play as a way to earn income.
- Age verification before paid play.

---

## 9. User-facing documents needed before launch

```
□ Terms of Service (including the dispute-resolution mechanism and admin finality)
□ Privacy Policy (DPDP-compliant)
□ Refund & Cancellation Policy (must match Arena.cancellationPolicy in code)
□ Responsible Gaming Policy
□ Fair Play Policy (collusion, multi-accounting, score manipulation)
□ Grievance Officer name + contact, published (statutory requirement)
□ State-restriction notice on the paid-challenge screen
```

The refund policy is the one most likely to drift from the code. Whatever `freeCancellationHours` and `partialRefundPercent` you ship must match the published document exactly.
