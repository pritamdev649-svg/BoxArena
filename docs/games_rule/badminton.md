BADMINTON LIVE SCORING SYSTEM — OFFICIAL-RUN MATCH INTERFACE
SPEC (TEXT)

===================================================

1. FLOW: FROM "SETTLED" TO "MATCH LIVE"
===================================================

1. Payment settled (venue + official + entry fee, both teams paid) → Match status: CONFIRMED
1. Both captains + official check in at venue (app shows "Start Match" button, visible only to the assigned official)
1. Official taps "Start Match" → Match status: LIVE
1. Scoring interface opens on official's device (this is the source of truth — not the players' devices)
1. Once match completes → Match status: COMPLETED → triggers escrow release logic (from earlier spec)

Only the assigned official can start/score the match if they have can_trigger_payout = true. If it's a team-added official (non-triggering), the same scoring screen can still be used, but final result still needs both-captain confirmation before escrow moves.

===================================================
2. BADMINTON RULES ENGINE (what the system needs to know)
===================================================

- Match = best of 3 sets (configurable: best of 1/3/5)
- Each set played to 21 points, win by 2, cap at 30 (29-29 → next point wins)
- Serve alternates based on rally-point scoring rules (server changes on server's own missed rally per badminton scoring, receiver becomes server)
- Side change: after each set, and mid-way in the deciding 3rd set when leader reaches 11 points
- A match is decided once a team wins 2 sets

The scoring engine should encode these as rules, not let the official free-type scores — this prevents invalid states (e.g., someone accidentally recording 21-20 as a set win, which is invalid under win-by-2).

===================================================
3. LIVE SCORING SCREEN — WHAT THE OFFICIAL SEES
===================================================

Header:

- Team A vs Team B, Set 1/2/3, current score, server indicator (icon showing who's serving)

Main controls:

- Two large tap zones: "Point: Team A" / "Point: Team B" — one tap per rally won
- "Undo Last Point" button (mistakes happen — must be correctable, but logged as a correction, not silently overwritten)
- "Timeout" button (each team gets limited timeouts per match — track usage)
- "End Set" (auto-triggers when rules satisfied, but official confirms)

Live display:

- Current set score
- Previous completed sets' scores (small strip at top, e.g. "Set 1: 21-15 (A)")
- Server indicator auto-updates per point (per badminton serve rules)
- Match clock (elapsed time)

===================================================
4. LOGGING — WHAT GETS RECORDED (this is the "all logs" part)
===================================================

Every single point is logged, not just the final score. This is what makes the record dispute-proof and stats-rich.

POINT LOG (one row per rally)

- match_id
- set_number
- point_number (sequential within the set)
- scoring_team (A or B)
- score_after (e.g., "5-3")
- server_at_time_of_point
- timestamp
- recorded_by (official_id)
- is_correction (bool — true if this point was an undo/fix)

SET LOG (one row per set)

- match_id
- set_number
- final_score (e.g., "21-15")
- winner
- duration
- started_at / ended_at

MATCH LOG (summary, auto-derived from sets)

- match_id
- sets_won_A / sets_won_B
- final_winner
- total_duration
- official_id
- confirmed_by_official (bool)
- confirmed_by_team_a / confirmed_by_team_b (bool, if non-triggering official)
- dispute_status (none / raised / resolved)

TIMEOUT/EVENT LOG (optional but useful)

- match_id, set_number, team, timestamp, event_type (timeout/injury/interruption)

===================================================
5. WHY POINT-BY-POINT LOGGING MATTERS
===================================================

- Dispute-proofing: if a team disputes the final score, you have a full replayable log, not just "21-15, trust us"
- Stats engine: point-by-point data lets you show things like longest rally streaks, comeback stats, server win-rate — the "pro league" feel you wanted from CricHeroes-style records
- Audit trail: is_correction + recorded_by fields mean you always know if/when the official fixed a mistake, protecting against accusations of tampering
- Escrow trust: the match_log confirmation fields are exactly what your escrow release logic checks before auto-paying the winner

===================================================
6. END-OF-MATCH FLOW
===================================================

1. Official's screen shows: "Match Complete: Team A wins 2-1" with full set breakdown
2. Official taps "Confirm Final Result"
3. If official.can_trigger_payout = true → match status = COMPLETED, escrow release triggers immediately (or after dispute window, per your earlier policy)
4. If official.can_trigger_payout = false (team-added) → both captains get a confirmation prompt on their own app ("Do you agree with this result: Team A won 2-1?") — escrow only releases once both confirm, or dispute window passes

===================================================
7. DATA MODEL SUMMARY (new tables needed)
===================================================

- Match (existing, extended): status (CONFIRMED/LIVE/COMPLETED/DISPUTED), started_at, ended_at
- Set: id, match_id, set_number, final_score, winner, started_at, ended_at
- Point: id, set_id, point_number, scoring_team, score_after, server, timestamp, recorded_by, is_correction
- MatchEvent: id, match_id, set_number, event_type, team, timestamp

===================================================
8. WHAT THIS BUILDS TOWARD
===================================================

This same structure (point log → set log → match log) is sport-agnostic in shape — box cricket would swap "points" for "balls/overs," football for "goals/events," but the underlying pattern (granular log → aggregated set/match record → confirmation → escrow trigger) stays the same. Build the badminton version first as the reference implementation, then reuse the schema for other sports.
