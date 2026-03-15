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
- Track `battleRewards: Record<string, boolean>` — keyed by `opponentUserId`, `true` if first match reward has been claimed.

## Match Simulation Engine

### Input

Both squads are frozen at the moment of acceptance:
- 11 players with stats (pace, shooting, passing, dribbling) and rarity
- Formation (4-3-3, 4-4-2, etc.)
- Chemistry links (club/nationality matches)
- Assigned coach + coach level + perk
- Challenger's habit streak (current max streak across all habits)

### Variables & Weights

The engine calculates a **team strength score** for each side, then simulates the match probabilistically.

#### 1. Base Player Stats (weight: ~40%)
Sum of all 11 players' stats (pace + shooting + passing + dribbling). Higher total = stronger team. Each stat's contribution depends on position:
- **GK**: passing (distribution), dribbling (reflexes proxy)
- **DEF**: pace, passing
- **MID**: passing, dribbling
- **FWD**: pace, shooting

#### 2. Player Rarity Bonus (weight: ~10%)
- Common: +0
- Rare: +2 per player
- Epic: +5 per player
- Legendary: +10 per player

#### 3. Chemistry (weight: ~15%)
Count chemistry links between adjacent players in formation. More links = better team cohesion. Each link type:
- Same club: +3
- Same nationality: +3
- Both club + nationality: +8

#### 4. Coach Perks (weight: ~10%)
Apply coach stat boosts to eligible players before calculating base stats. Coaches with coin-only perks (like Ancelotti's habit coin bonus) provide a smaller flat team bonus instead.

#### 5. Formation Matchup (weight: ~5%)
Rock-paper-scissors style modifiers between formations:
- Attacking formations (4-3-3, 3-5-2) get +bonus vs defensive formations (5-3-2)
- Balanced formations (4-4-2, 4-2-3-1) get +bonus vs attacking formations
- Defensive formations get +bonus vs balanced formations
- Mirror matchups: neutral

#### 6. Position Fit (weight: ~5%)
Players in their correct position type (FWD in FWD slot, etc.) get full stats. Players out of position lose 20% of their stat contribution. GK out of position loses 50%.

#### 7. Squad Completeness (weight: ~3%)
Both sides must have 11 players (enforced by eligibility check), so this is always satisfied. Reserved for future partial-squad modes.

#### 8. Habit Streak Bonus (weight: ~5%)
Ties battles back to the core habit-tracking loop:
- Max streak across all habits: `streak`
- Bonus: `min(streak * 0.5, 15)` points added to team strength
- Capped at 15 to prevent runaway advantage

#### 9. Home Advantage (weight: ~2%)
The challenger (Player A) gets a small fixed bonus (+3 to team strength), representing "home crowd" energy.

#### 10. Fatigue/Form — Random Per-Player (weight: ~5%)
Each player gets a random form modifier for this match:
- Range: -5 to +10 (skewed positive for excitement)
- "On fire" events trigger when a player rolls +8 or above
- Seeded by match ID so both viewers see identical form rolls

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
| Yellow Card | 🟨 | 0-4 per match | Slight team debuff for rest of match |
| Red Card | 🟥 | 0-1 per match (rare) | Significant team debuff, player removed |
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

- **Scoreboard**: Both team names, large score numbers, current minute
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
id: uuid (PK)
challenger_id: uuid (FK → auth.users)
challenged_id: uuid (FK → auth.users)
status: text ('pending' | 'accepted' | 'declined' | 'expired' | 'cancelled')
challenger_squad: jsonb  -- snapshot of squad, formation, coach at challenge time
created_at: timestamptz
expires_at: timestamptz  -- created_at + 24h
```

#### `matches`
```sql
id: uuid (PK)
challenge_id: uuid (FK → challenges)
challenger_id: uuid (FK → auth.users)
challenged_id: uuid (FK → auth.users)
challenger_squad: jsonb  -- snapshot
challenged_squad: jsonb  -- snapshot
match_seed: text  -- deterministic RNG seed
events: jsonb  -- array of MatchEvent
score_home: int
score_away: int
result: text ('home_win' | 'away_win' | 'draw')
coins_awarded_to: uuid | null  -- who got coins (null if rematch)
played_at: timestamptz
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
// Added to AppState
battleRewards: Record<string, boolean>  // opponentUserId → true if first match reward claimed

// New actions
sendChallenge(friendId: string): Promise<void>
cancelChallenge(challengeId: string): Promise<void>
acceptChallenge(challengeId: string): Promise<Match>
declineChallenge(challengeId: string): Promise<void>
fetchChallenges(): Promise<Challenge[]>
fetchMatchHistory(): Promise<Match[]>
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

## Edge Cases

- **Squad changes after challenge sent**: Challenger's squad is snapshotted at challenge creation time. Challenged player's squad is snapshotted at acceptance time. Changes after these points don't affect the match.
- **Unfollowing during pending challenge**: Challenge remains valid. Can still be accepted/declined.
- **Both players challenge each other simultaneously**: Both challenges exist independently. Each produces its own match when accepted.
- **Expired challenge cleanup**: On app load, mark expired challenges as `expired`. Don't delete — keep for audit.
- **Replay integrity**: Match seed + both squad snapshots = fully deterministic replay. No server-side simulation needed — client generates identical events from the same inputs.
