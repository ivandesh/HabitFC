# Cinematic Match Battles — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Problem

The current match simulation feels flat — the ball drifts randomly, events fire instantly, and matches feel samey after a few watches. There's no buildup before big moments, no substitution system, and limited event variety.

## Solution

Add cinematic multi-phase events (penalties, free kicks, corners, counterattacks, VAR reviews), an auto-bench system with halftime and red-card substitutions, and a phase-driven pacing model that pauses the match timer during dramatic moments.

## Approach

"Cinematic Events Layer" — a new event pipeline layered on top of the existing `simulateMatch()` engine. The current simulation logic stays intact; new event types and phase data are added alongside it. The `MatchLive` UI gains a phase machine that freezes the minute timer during cinematic sequences.

---

## 1. New Event Types & Engine Changes

### New `MatchEvent` types

| Event | Trigger | Outcome |
|-------|---------|---------|
| `penalty` | ~15% of goals become penalties (foul-in-box) | Goal or great save |
| `free_kick` | ~20% of goals become free kicks (foul near box) | Goal, save, or near_miss |
| `corner` | Standalone flavor event (~2-3 per match) | Header goal (~15%), save, or cleared |
| `counterattack` | ~15% of goals become fast breaks | Multi-pass sequence ending in goal |
| `var_review` | ~10% chance after any goal | Confirmed or disallowed (score adjusted) |
| `substitution` | Halftime or post-red-card | Player swap, shown in commentary |

### Integration with existing simulation

1. When a goal minute is reached, the engine rolls **what kind of goal**: regular (50%), penalty (15%), free kick (20%), counterattack (15%).
2. Each cinematic goal type stores `phases` in the event data — an array of `{ phase: string, duration: number }` that the UI reads.
3. Corner kicks get their own probability band within the existing flavor roll (alongside yellow/red/near_miss/great_save/etc.). Pre-roll 2-3 corner minutes (using `rng.int(2, 3)` for count). A corner that scores (~15% chance) **replaces** the nearest upcoming goal from the budget, keeping total goals within the pre-rolled budget range. If no goals remain in the budget, the corner cannot score (save or cleared only).
4. VAR triggers post-goal with ~10% chance. The engine emits the `goal` event normally (score incremented), then emits a `var_review` event on the same minute with the matching `team` field. If `varOutcome: 'disallowed'`, the engine decrements the score immediately in simulation state, and the final `scoreHome`/`scoreAway` in `SimulationResult` already reflect the adjustment. The UI decrements the displayed score when it processes the `var_review` event with `disallowed` outcome.

### Event phases

```
penalty:       foul (0.8s) → whistle (0.5s) → player_walks_to_spot (1.5s) → keeper_ready (0.8s) → kick (0.5s) → outcome (1.0s)  [~5.1s]
free_kick:     foul (0.8s) → wall_lines_up (1.2s) → run_up (1.0s) → kick (0.5s) → outcome (1.0s)  [~4.5s]
corner:        ball_out (0.5s) → corner_setup (1.0s) → cross (0.8s) → header (0.5s) → outcome (1.0s)  [~3.8s]
counterattack: interception (0.5s) → pass_1 (0.8s) → pass_2 (0.8s) → shot (0.5s) → outcome (1.0s)  [~3.6s]
var_review:    celebration_pause (1.5s) → var_check (2.0s) → decision (1.5s)  [~5.0s]
```

---

## 2. Auto-Bench System

### Bench selection (at match start)

When building a squad snapshot, 3 bench players are auto-picked from the owner's collection:

1. Filter collection to players **not** in the starting 11.
2. For each position category (DEF, MID, FWD), pick the highest-overall player available.
3. If a position category has no available player, fill from the next best regardless of position.
4. No GK on bench.
5. If fewer than 3 non-starting players are available in the collection, bench size equals whatever is available (0, 1, or 2).

### Halftime substitutions (minute 45)

1. Calculate first-half ratings for all 11 players using `calcRating` — extracted to a shared module `src/lib/playerRating.ts` (imported by both `battleEngine.ts` and `MatchLive.tsx`). The rating uses event contributions (goals, saves, cards, etc.) plus each player's `formRoll` value (from the pre-rolled form array) as a tiebreaker, so players without first-half events aren't all identical at 6.5.
2. Pick the **2 lowest-rated outfield players**. If still tied after formRoll inclusion, broken by `rng.pick()`.
3. Swap them for bench players matching their position category. If no positional match, use best available bench player.
4. Generate `substitution` events shown in commentary.
5. Subbed-out players can't appear in second-half events.

### Red card substitutions

1. When a red card happens, immediately pick a bench player matching the sent-off player's position.
2. Generate a `substitution` event.
3. Team plays with 10 for the **remainder of that minute** (sub arrives next minute).
4. If no bench players remain, no sub happens (team stays short).

### Cinematic event queuing

If multiple cinematic events land on the same or adjacent minutes (e.g. a red card followed by a substitution), each plays its full phase sequence before the next begins. No overlapping cinematics.

---

## 3. Match Pacing & Cinematic UI

### Timing model

| State | Tick speed | What's happening |
|-------|-----------|-----------------|
| Normal play | 250ms per minute | Ball drifts, no events |
| Minor event | 800ms pause | Yellow card, near miss, momentum shift |
| Halftime | 2s pause | HT overlay + substitution summary |
| **Cinematic event** | **Frozen** | Minute timer stops. Phases advance on their own durations (0.5-1.5s each). Total 4-6s. Timer resumes after final phase. |

Typical match: ~45-60s. A 5-goal thriller: ~75s.

### CinematicOverlay component

New component rendered on top of the pitch during cinematic events:

- **Penalty**: Pitch zooms to penalty area (CSS transform). Penalty spot highlighted. Keeper sways. Kick → ball trajectory → net ripple (goal) or diving save.
- **Free kick**: Wall of dots lines up. Ball arcs from free kick position. Curling trajectory as dotted path → outcome.
- **Corner**: Ball moves to corner flag. Cross arc. Header attempt at near/far post.
- **Counterattack**: Ball moves rapidly through 2-3 player positions with pass-line trails → shot.
- **VAR**: Subtle blue screen tint + "VAR" badge. Replay freeze. Verdict banner (confirmed/disallowed).

### Overlay-to-outcome transition

The `CinematicOverlay`'s final "outcome" phase animates the result (goal net ripple, diving save, ball sailing over). Once the outcome phase duration expires, the overlay dismisses and the `MatchLive` phase machine processes the next event in the queue (the canonical `goal`, `great_save`, or `near_miss` event). The outcome event triggers its normal sound (`playGoal()`, etc.) and score update. During the overlay, the ball position is controlled by the overlay component (not `getBallState`). After overlay dismissal, `getBallState` resumes normal operation.

### Sound design

| Phase | Sound |
|-------|-------|
| Foul whistle (penalty/free kick) | Sharp whistle blast |
| Setup/tension | Low rumble building |
| Kick | Impact thud |
| Goal outcome | Existing `playGoal()` |
| Save outcome | Existing `playGreatSave()` |
| Miss outcome | Existing `playNearMiss()` |
| VAR check | Electronic beep sequence |
| VAR confirmed | Crowd roar |
| VAR disallowed | Crowd groan + whistle |
| Substitution | Short whistle + applause |
| Counterattack buildup | Rising tempo percussion |

### PostMatchLineup changes

After the starting 11, render a "Лава" (Bench) section:
- Show bench players with a "SUB" tag and the minute they entered (e.g. "↑ 46'").
- Starting players who were subbed out show dimmed with "↓ 46'" next to their name.
- Players sent off (red card) show with a red "🟥" badge and strikethrough, no sub-in indicator unless a sub replaced them.
- Bench players who never entered are shown greyed out.

### Commentary improvements

During cinematic events, commentary updates phase-by-phase:

```
42' 🔴 Фол у штрафному! Пенальті!
42' ⏳ Salah підходить до м'яча...
42' ⚽ ГОЛ! Salah — Удар у лівий кут!
```

Each phase appends a new line, giving the user time to follow along.

---

## 4. Data Model Changes

### Updated `MatchEvent` (in `types.ts`)

New optional fields added:
- `phases?: { phase: string; duration: number }[]` — cinematic sequence
- `varOutcome?: 'confirmed' | 'disallowed'` — only on `var_review`
- `subInPlayerId?: string` — only on `substitution`. `playerId` = player leaving, `subInPlayerId` = player entering.

New event type values: `'penalty' | 'free_kick' | 'corner' | 'counterattack' | 'var_review' | 'substitution'`

### Cinematic events as lead-ins (not goal replacements)

Cinematic events (`penalty`, `free_kick`, `corner`, `counterattack`) are **lead-in events** that precede the outcome event. If a penalty results in a goal, the engine emits a `penalty` event (with phases) followed by a `goal` event on the same minute. If saved, a `penalty` event followed by a `great_save`. This keeps `goal` as the single canonical scoring event — the UI score logic and post-match stats remain unchanged. The UI plays the cinematic sequence for the lead-in, then processes the outcome event normally.

### Updated `SquadSnapshot`

New field: `bench: string[]` — 3 auto-picked player IDs.

### Backwards compatibility

- `phases` is optional — no phases = plays like current instant events.
- `bench` is optional — no bench = no substitutions in post-match.
- Old event types render exactly as before.
- No Supabase migration needed (JSONB absorbs new fields).
- New matches store `bench` within `SquadSnapshot`, which is already serialized as JSONB in the `challengerSquad`/`challengedSquad` columns. Post-match replay uses the stored bench data to render substitution info.

---

## 5. File Changes

| File | Change |
|------|--------|
| `src/types.ts` | Update `MatchEvent` with new types + optional fields. Update `SquadSnapshot` with `bench`. |
| `src/lib/battleEngine.ts` | Cinematic goal type rolling. Corner events in flavor pool. VAR post-goal rolls. Phase data generation. Halftime + red card sub logic. Auto-bench picker. |
| `src/lib/playerRating.ts` | **New file.** Extract `calcRating` + `buildPlayerStats` from `MatchLive.tsx` into shared module. Imported by both engine and UI. |
| `src/lib/sounds.ts` | ~6 new sounds: `playWhistleShort()`, `playTensionBuild()`, `playKickImpact()`, `playVarBeep()`, `playCrowdGroan()`, `playSubstitution()` |
| `src/hooks/useBattle.ts` | Update `buildMySnapshot()` to compute bench from collection. |
| `src/components/battle/MatchLive.tsx` | Phase machine freezing minute timer. Phase-by-phase commentary. Substitution display. `PostMatchLineup` bench section + sub indicators. |
| `src/components/battle/CinematicOverlay.tsx` | **New file.** Penalty/free kick/corner/counterattack/VAR overlays with zoom, trajectory, outcome animations. Sound triggers per phase. |

### Unchanged

- `src/lib/battleApi.ts` — no schema changes
- `src/lib/seededRng.ts` — unchanged
- `src/data/footballers.ts` — unchanged
- Supabase tables — no migration (JSONB)
- All other pages/components — untouched
