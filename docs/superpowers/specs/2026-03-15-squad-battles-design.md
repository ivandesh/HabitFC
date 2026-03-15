# Squad Battles — Design Spec

## Overview

A PvP battle system where players challenge friends to squad-vs-squad matches. Matches are simulated with a minute-by-minute live timeline, influenced by player stats, chemistry, coach perks, formation tactics, and random factors. Same squads can produce different results each time.

## Challenge System

### Flow

1. Player A visits Player B's profile (or sees them in Friends list)
2. Player A taps "Challenge" button
3. Challenge is created with `pending` status, stored in Supabase
4. Player B sees incoming challenge in the Friends page
5. Player B taps "Accept" → match simulates immediately, Player B watches live
6. Player A receives the completed match. When they open the app, they see "Match ready!" and watch the same timeline play out as if live (seeded RNG produces identical event sequence)

### Rules

- **Eligibility**: Both players must have a full squad (11 players) AND an assigned coach. If either condition is unmet, the challenge button is disabled with a tooltip explaining why.
- **One pending challenge per friend**: Cannot send a second challenge to the same friend while one is pending.
- **24-hour expiry**: Pending challenges auto-expire after 24 hours. Expired challenges are cleaned up on next app load.
- **Cancellable**: Challenger can cancel a pending challenge before it's accepted.
- **Decline**: Challenged player can decline (removes the challenge).

### Rewards (first match per friend only)

| Result | Coins |
|--------|-------|
| Win    | 100   |
| Draw   | 50    |
| Loss   | 0     |

- Subsequent matches against the same friend award 0 coins (but are still playable).
- Whether a first-match reward has been claimed is derived from the `matches` table: query for any match where `coins_awarded_to = currentUser` involving the given opponent. No separate store state needed — this avoids multi-device sync issues.

## Match Simulation Engine

### Input

Both squads are frozen at the moment of acceptance:
- 11 players with stats (pace, shooting, passing, dribbling) and rarity
- Formation (4-3-3, 4-4-2, etc.)
- Chemistry links (club/nationality matches)
- Assigned coach + coach level + perk
- Each player's habit streak (max streak across all habits, captured in SquadSnapshot for both sides)

### Variables & Weights

The engine calculates a **team strength score** for each side, then simulates the match probabilistically. The final score is a weighted sum of normalized sub-scores:

```
teamStrength = (baseStats / MAX_BASE_STATS) * 40
             + (rarityBonus / MAX_RARITY) * 10
             + (chemistryScore / MAX_CHEMISTRY) * 15
             + (coachBonus / MAX_COACH) * 10
             + (formationBonus / MAX_FORMATION) * 5
             + (positionFit / MAX_POSITION) * 5
             + (squadComplete / 1) * 3
             + (streakBonus / MAX_STREAK) * 5
             + (homeBonus / MAX_HOME) * 2
             + (formTotal / MAX_FORM) * 5
```

Each sub-score is normalized to 0–1 range before applying the weight. This produces a team strength between 0–100.

#### 1. Base Player Stats (weight: 40)
Sum of all 11 players' effective stats based on position relevance:
- **GK**: passing (distribution) + dribbling (reflexes proxy) — 2 stats
- **DEF**: pace + passing — 2 stats
- **MID**: passing + dribbling — 2 stats
- **FWD**: pace + shooting — 2 stats

`MAX_BASE_STATS` = 11 players × 2 stats × 99 max = 2178

#### 2. Player Rarity Bonus (weight: 10)
- Common: +0
- Rare: +2 per player
- Epic: +5 per player
- Legendary: +10 per player

`MAX_RARITY` = 11 × 10 = 110

#### 3. Chemistry (weight: 15)
Compare ALL player pairs (consistent with existing `getChemistryLinks` which uses all-pairs comparison). Each pair can produce one link:
- Same club only: +3
- Same nationality only: +3
- Both club + nationality: +8 (not additive — this is a single bonus for dual match)

`MAX_CHEMISTRY` = C(11,2) × 8 = 55 × 8 = 440

#### 4. Coach Perks (weight: 10)
- **Stat-boost coaches** (e.g., Guardiola +passing to MID): Apply stat boosts to eligible players before calculating base stats. The bonus is the total stat points added across all boosted players, normalized by `MAX_COACH` = 11 × 12 = 132 (max boost per player × 11).
- **Non-stat-boost coaches** (coin perks like Ancelotti): Flat team bonus of +3 per coach level (level 1 = +3, level 2 = +6, level 3 = +9). Normalized against MAX_COACH same way.

#### 5. Formation Matchup (weight: 5)
Rock-paper-scissors modifiers:

| Formation | Category |
|-----------|----------|
| 4-3-3     | Attacking |
| 3-5-2     | Attacking |
| 4-4-2     | Balanced |
| 4-2-3-1   | Balanced |
| 5-3-2     | Defensive |

- Favorable matchup (attacking > defensive > balanced > attacking): +5
- Unfavorable matchup: +0
- Mirror/same category: +2

`MAX_FORMATION` = 5

#### 6. Position Fit (weight: 5)
Players in their correct position type (FWD in FWD slot, etc.) get full stats. Players out of position lose 20% of their stat contribution. GK out of position loses 50%.

Score = number of correctly positioned players / 11. `MAX_POSITION` = 1.0

#### 7. Squad Completeness (weight: 3)
Both sides must have 11 players (enforced by eligibility check), so this is always 1.0. Reserved for future partial-squad modes.

#### 8. Habit Streak Bonus (weight: 5)
Ties battles back to the core habit-tracking loop. Both sides get their respective streak bonus:
- Max streak across all habits: `streak` (from each player's own `SquadSnapshot.maxHabitStreak`)
- Bonus: `min(streak * 0.5, 15)` points

`MAX_STREAK` = 15

#### 9. Home Advantage (weight: 2)
The challenger (Player A) gets a fixed bonus of 1.0; the challenged player gets 0.0.

`MAX_HOME` = 1

#### 10. Fatigue/Form — Random Per-Player (weight: 5)
Each player gets a random form modifier for this match:
- Range: -5 to +10 (skewed positive for excitement)
- "On fire" events trigger when a player rolls +8 or above
- Seeded by match seed so both viewers see identical form rolls
- Team form = sum of all 11 player form rolls

`MAX_FORM` = 11 × 10 = 110

### Match Simulation Algorithm

1. Calculate final team strength for both sides (all variables above)
2. Compute **win probability** from strength difference using a sigmoid curve — even a weaker team has ~20-30% chance to win
3. Generate a **match seed** (hash of both user IDs + timestamp) for deterministic RNG
4. Using seeded RNG, simulate minute-by-minute:
   - Each minute has a chance of producing an event
   - Goal probability influenced by team strength ratio and current form
   - Total goals typically 0-6 (weighted toward 1-3)
   - Events are generated for both teams proportionally to their strength
5. Output: ordered list of `MatchEvent` objects with minute stamps

### Event Types

| Event | Icon | Frequency | Mechanical Effect |
|-------|------|-----------|-------------------|
| Goal | ⚽ | 1-4 per match | Changes score |
| Yellow Card | 🟨 | 0-4 per match | -3% goal probability for that team for remaining minutes |
| Red Card | 🟥 | 0-1 per match (rare) | -10% goal probability for that team + that player's stats removed from team strength for remaining minutes |
| Near Miss | 💨 | 2-5 per match | None (flavor) |
| Great Save | 🧤 | 1-3 per match | None (flavor) |
| Player on Fire | 🔥 | 0-2 per match | None (shown when form roll is high) |
| Momentum Shift | 🔄 | 1-2 per match | None (flavor) |

## Live Match UI

### Layout: Scoreboard + Event Feed

```
┌─────────────────────────────────┐
│   YOUR SQUAD    45'   ANDRIY FC │
│      2          HT       1      │
│  ━━━━━━━━━━━━━━━━━░░░░░░░░░░░  │  ← progress bar (0' to 90')
│                                 │
│  12' ⚽ Haaland — Header        │
│  23' 🟨 Rodri — Tactical foul   │
│  31' ⚽ Salah — Counter attack  │
│  38' 🔥 Mbappé is on fire!      │
│  42' ⚽ Mbappé — Solo run        │
│                                 │
└─────────────────────────────────┘
```

- **Scoreboard**: Both player display names (from `user_state.username`), large score numbers, current minute
- **Progress bar**: Visual 0'→90' with green fill advancing
- **Event feed**: Scrolling list, newest at bottom, events appear with animation as the minute ticks by
- **Half-time**: Brief pause at 45' with "HT" indicator
- **Full-time**: Final whistle animation, result banner (WIN / DRAW / LOSS), coin reward if applicable

### Timing

- Match plays out in ~30-60 seconds real time
- Minutes tick at variable speed (faster when nothing happens, pauses slightly on events)
- Goal events get a brief dramatic pause before appearing

### Sound Effects

- ⚽ Goal: Crowd roar + whistle
- 🟨 Yellow card: Sharp whistle
- 🟥 Red card: Long whistle + crowd gasp
- 💨 Near miss: Crowd "ooh"
- 🧤 Great save: Crowd applause
- Full-time whistle: Triple whistle blast

## Data Model

### Supabase Tables

#### `challenges`
```sql
CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users,
  challenged_id uuid NOT NULL REFERENCES auth.users,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  challenger_squad jsonb NOT NULL,  -- SquadSnapshot at challenge creation time
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Note:** Only the challenger's squad is stored here. The challenged player's squad is captured from their live `user_state` at acceptance time and written directly to the `matches` table.

#### `matches`
```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges,
  challenger_id uuid NOT NULL REFERENCES auth.users,
  challenged_id uuid NOT NULL REFERENCES auth.users,
  challenger_squad jsonb NOT NULL,  -- copied from challenge
  challenged_squad jsonb NOT NULL,  -- captured at accept time
  match_seed text NOT NULL,         -- deterministic RNG seed
  events jsonb NOT NULL,            -- array of MatchEvent
  score_home int NOT NULL DEFAULT 0,
  score_away int NOT NULL DEFAULT 0,
  result text NOT NULL CHECK (result IN ('home_win', 'away_win', 'draw')),
  coins_awarded_to uuid REFERENCES auth.users,  -- null if rematch (no reward)
  played_at timestamptz NOT NULL DEFAULT now()
);
```

#### RLS Policies

```sql
-- challenges: users can see challenges they're involved in
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY challenges_select ON challenges FOR SELECT
  USING (auth.uid() IN (challenger_id, challenged_id));

CREATE POLICY challenges_insert ON challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY challenges_update ON challenges FOR UPDATE
  USING (auth.uid() IN (challenger_id, challenged_id));

-- matches: users can see matches they're involved in
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select ON matches FOR SELECT
  USING (auth.uid() IN (challenger_id, challenged_id));

CREATE POLICY matches_insert ON matches FOR INSERT
  WITH CHECK (auth.uid() = challenged_id);  -- only acceptor creates the match row
```

### TypeScript Types

```typescript
interface Challenge {
  id: string
  challengerId: string
  challengedId: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
  challengerSquad: SquadSnapshot
  createdAt: string
  expiresAt: string
}

interface SquadSnapshot {
  squad: string[]  // 11 footballer IDs
  formation: string
  coachId: string
  coachLevel: number
  maxHabitStreak: number
}

interface MatchEvent {
  minute: number
  type: 'goal' | 'yellow_card' | 'red_card' | 'near_miss' | 'great_save' | 'on_fire' | 'momentum_shift'
  team: 'home' | 'away'
  playerId: string
  description: string  // Short text: "Header from corner", "Solo run", etc.
}

interface Match {
  id: string
  challengeId: string
  challengerId: string
  challengedId: string
  challengerSquad: SquadSnapshot
  challengedSquad: SquadSnapshot
  matchSeed: string
  events: MatchEvent[]
  scoreHome: number
  scoreAway: number
  result: 'home_win' | 'away_win' | 'draw'
  coinsAwardedTo: string | null
  playedAt: string
}
```

### Zustand Store Additions

```typescript
// No new AppState fields needed — challenges and matches live in Supabase tables,
// battleRewards derived from matches table queries.

// New actions (can live in a separate useBattleStore or as standalone async functions)
sendChallenge(friendId: string): Promise<void>
cancelChallenge(challengeId: string): Promise<void>
acceptChallenge(challengeId: string): Promise<Match>
declineChallenge(challengeId: string): Promise<void>
fetchChallenges(): Promise<Challenge[]>
fetchMatchHistory(limit?: number): Promise<Match[]>  // default limit: 50
hasClaimedReward(opponentId: string): Promise<boolean>
```

## Friends Page Integration

The Friends page gets restructured with sections:

1. **Incoming Challenges** (top, if any) — accept/decline buttons
2. **Outgoing Challenges** (if any) — cancel button, time remaining
3. **Match History** — recent matches list: opponent name, score, date, W/D/L badge, tap to rewatch
4. **Friends List** — existing following list with "Challenge" button on each friend (disabled if eligibility not met)

## Eligibility Checks

Before allowing a challenge to be sent:
- **Your squad**: Must have 11 players AND an assigned coach
- **Friend's squad**: Must have 11 players AND an assigned coach (check from their synced state)
- **No pending challenge**: No existing pending challenge to this friend
- If any check fails, "Challenge" button is disabled with a tooltip/message explaining the requirement

## Match Notification / Discovery

Player A (challenger) discovers completed matches via polling, not real-time subscriptions:

1. On Friends page mount, query `matches` table for rows where `challenger_id = currentUser` AND the match hasn't been "watched" yet.
2. Track watched status locally (localStorage key `watchedMatches: Set<matchId>`).
3. Unwatched matches appear as a "Match ready!" banner at the top of the Friends page. Tapping plays the full live simulation.
4. A badge/dot on the Friends nav link indicates unwatched matches (query on app load).

This avoids adding Supabase Realtime subscriptions and fits the existing architecture (poll on mount).

## Sound Effects — Implementation Note

All existing sounds are synthesized via Web Audio API (`src/lib/sounds.ts`). New battle sounds follow the same approach:
- **Goal crowd roar**: Filtered noise burst (bandpass 200-800Hz) with fast attack, slow decay (~1.5s)
- **Whistle**: High sine oscillator (~3kHz) with short envelope
- **Crowd "ooh"**: Noise burst through vowel-shaped formant filter (bandpass ~500Hz)
- **Crowd applause**: White noise through highpass (2kHz) with medium sustain
- **Triple final whistle**: Three short sine bursts at ~3kHz, 200ms apart

## Edge Cases

- **Squad changes after challenge sent**: Challenger's squad is snapshotted at challenge creation time. Challenged player's squad is snapshotted at acceptance time. Changes after these points don't affect the match.
- **Unfollowing during pending challenge**: Challenge remains valid. Can still be accepted/declined.
- **Both players challenge each other simultaneously**: Both challenges exist independently. Each produces its own match when accepted.
- **Expired challenge cleanup**: On app load, mark expired challenges as `expired`. Don't delete — keep for audit.
- **Replay integrity**: Match seed + both squad snapshots = fully deterministic replay. No server-side simulation needed — client generates identical events from the same inputs.
- **Footballer data changes across app versions**: `SquadSnapshot` stores footballer IDs, not full stats. Replays rely on current footballer data — if stats change in a future update, old replays may produce slightly different event sequences. This is acceptable; match results (score, events) are stored in the `matches` table as the source of truth. Replays are cosmetic.
