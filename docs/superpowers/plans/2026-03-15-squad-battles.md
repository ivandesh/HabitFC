# Squad Battles Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PvP squad battles where players challenge friends to simulated matches with live minute-by-minute timelines.

**Architecture:** Client-side match simulation using seeded RNG for deterministic playback. Challenges and match results stored in Supabase tables with RLS. Match engine calculates team strength from 10 weighted variables, then generates events minute-by-minute. Friends page becomes the hub for challenges and match history.

**Tech Stack:** React, TypeScript, Zustand, Supabase (PostgreSQL + RLS), Tailwind CSS, Framer Motion, Web Audio API

**Spec:** `docs/superpowers/specs/2026-03-15-squad-battles-design.md`

---

## Chunk 1: Foundation — Types, Seeded RNG, Database

### Task 1: Battle Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add battle types to types.ts**

Add after the existing `CoachPackDef` interface at the end of `src/types.ts`:

```typescript
// ─── Battle System ──────────────────────────────────────────────────────────

export interface SquadSnapshot {
  squad: string[]           // 11 footballer IDs
  formation: string
  coachId: string
  coachLevel: number
  maxHabitStreak: number
}

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'

export interface Challenge {
  id: string
  challengerId: string
  challengedId: string
  status: ChallengeStatus
  challengerSquad: SquadSnapshot
  createdAt: string
  expiresAt: string
}

export type MatchEventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'near_miss'
  | 'great_save'
  | 'on_fire'
  | 'momentum_shift'

export interface MatchEvent {
  minute: number
  type: MatchEventType
  team: 'home' | 'away'
  playerId: string
  description: string
}

export type MatchResult = 'home_win' | 'away_win' | 'draw'

export interface Match {
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
  result: MatchResult
  coinsAwardedTo: string[]   // array of user IDs who received coins (can be both on draw)
  playedAt: string
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(battle): add battle system types"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/lib/seededRng.ts`

The entire match simulation must be deterministic so both players see the same match. We need a simple seeded PRNG.

- [ ] **Step 1: Create seeded RNG module**

```typescript
/**
 * Mulberry32 seeded PRNG — deterministic random number generator.
 * Given the same seed, always produces the same sequence.
 */
export function createRng(seed: number) {
  let state = seed | 0

  /** Returns a float in [0, 1) */
  function next(): number {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Returns integer in [min, max] inclusive */
  function int(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min
  }

  /** Returns true with given probability (0–1) */
  function chance(probability: number): boolean {
    return next() < probability
  }

  /** Pick a random element from array */
  function pick<T>(arr: T[]): T {
    return arr[Math.floor(next() * arr.length)]
  }

  return { next, int, chance, pick }
}

export type SeededRng = ReturnType<typeof createRng>

/**
 * Convert a string seed to a numeric seed via simple hash.
 * Used to turn matchSeed (string) into a number for the PRNG.
 */
export function hashSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/seededRng.ts
git commit -m "feat(battle): add seeded RNG (mulberry32)"
```

---

### Task 3: Database Migration SQL

**Files:**
- Create: `supabase/migrations/20260315_battle_tables.sql`

- [ ] **Step 1: Check if supabase migrations dir exists**

Run: `ls supabase/migrations/ 2>/dev/null || echo "no migrations dir"`

If it doesn't exist, create it: `mkdir -p supabase/migrations`

- [ ] **Step 2: Write migration file**

```sql
-- Squad Battles: challenges + matches tables

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users,
  challenged_id uuid NOT NULL REFERENCES auth.users,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  challenger_squad jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges,
  challenger_id uuid NOT NULL REFERENCES auth.users,
  challenged_id uuid NOT NULL REFERENCES auth.users,
  challenger_squad jsonb NOT NULL,
  challenged_squad jsonb NOT NULL,
  match_seed text NOT NULL,
  events jsonb NOT NULL,
  score_home int NOT NULL DEFAULT 0,
  score_away int NOT NULL DEFAULT 0,
  result text NOT NULL CHECK (result IN ('home_win', 'away_win', 'draw')),
  coins_awarded_to jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of user ID strings who got coins
  played_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY challenges_select ON challenges FOR SELECT
  USING (auth.uid() IN (challenger_id, challenged_id));

CREATE POLICY challenges_insert ON challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY challenges_update ON challenges FOR UPDATE
  USING (auth.uid() IN (challenger_id, challenged_id));

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select ON matches FOR SELECT
  USING (auth.uid() IN (challenger_id, challenged_id));

CREATE POLICY matches_insert ON matches FOR INSERT
  WITH CHECK (auth.uid() = challenged_id);

-- Indexes for common queries
CREATE INDEX idx_challenges_challenger ON challenges (challenger_id, status);
CREATE INDEX idx_challenges_challenged ON challenges (challenged_id, status);
CREATE INDEX idx_matches_challenger ON matches (challenger_id, played_at DESC);
CREATE INDEX idx_matches_challenged ON matches (challenged_id, played_at DESC);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260315_battle_tables.sql
git commit -m "feat(battle): add challenges and matches table migration"
```

---

## Chunk 2: Match Simulation Engine

### Task 4: Team Strength Calculator

**Files:**
- Create: `src/lib/battleEngine.ts`

This is the core engine. It calculates team strength from a SquadSnapshot and determines match outcome.

- [ ] **Step 1: Create battleEngine.ts with team strength calculation**

```typescript
import type { SquadSnapshot, Footballer, Position } from '../types'
import { footballers } from '../data/footballers'
import { coaches } from '../data/coaches'
import { FORMATIONS } from './formations'
import type { SeededRng } from './seededRng'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_BASE_STATS = 2178   // 11 × 2 stats × 99
const MAX_RARITY = 110        // 11 × 10
const MAX_CHEMISTRY = 440     // C(11,2) × 8
const MAX_COACH = 132         // 11 × 12
const MAX_FORMATION = 5
const MAX_STREAK = 15
const MIN_FORM = -55           // 11 × -5
const MAX_FORM = 110           // 11 × 10

const RARITY_BONUS: Record<string, number> = {
  common: 0, rare: 2, epic: 5, legendary: 10,
}

const FORMATION_CATEGORY: Record<string, 'attacking' | 'balanced' | 'defensive'> = {
  '4-3-3': 'attacking',
  '3-5-2': 'attacking',
  '4-4-2': 'balanced',
  '4-2-3-1': 'balanced',
  '5-3-2': 'defensive',
}

// attacking > defensive > balanced > attacking
function formationMatchupBonus(mine: string, theirs: string): number {
  const my = FORMATION_CATEGORY[mine] ?? 'balanced'
  const their = FORMATION_CATEGORY[theirs] ?? 'balanced'
  if (my === their) return 2
  if (
    (my === 'attacking' && their === 'defensive') ||
    (my === 'defensive' && their === 'balanced') ||
    (my === 'balanced' && their === 'attacking')
  ) return 5
  return 0
}

/** Get relevant stats based on player's NATURAL position (not slot) */
function positionStats(player: Footballer): number {
  const s = player.stats
  switch (player.position) {
    case 'GK':  return s.passing + s.dribbling
    case 'DEF': return s.pace + s.passing
    case 'MID': return s.passing + s.dribbling
    case 'FWD': return s.pace + s.shooting
  }
}

/** Resolve footballer objects from a snapshot */
export function resolveSquad(snap: SquadSnapshot): (Footballer | undefined)[] {
  return snap.squad.map(id => footballers.find(f => f.id === id))
}

/** Calculate all 10 sub-scores and return total team strength (0–100) */
export function calcTeamStrength(
  snap: SquadSnapshot,
  opponentFormation: string,
  isHome: boolean,
  rng: SeededRng,
): { strength: number; formRolls: number[] } {
  const players = resolveSquad(snap)
  const formation = FORMATIONS[snap.formation]
  if (!formation) return { strength: 0, formRolls: [] }

  const coach = coaches.find(c => c.id === snap.coachId)
  const coachLevel = Math.min(snap.coachLevel, 3)

  // ── 1. Base stats (weight: 40) ──
  // Apply coach stat boosts first
  let baseStats = 0
  let positionFitCount = 0

  for (let i = 0; i < 11; i++) {
    const player = players[i]
    if (!player) continue
    const slotPos = formation.slots[i]?.pos ?? 'MID'

    // Coach stat boost
    let boostedStats = { ...player.stats }
    if (coach?.perk.type === 'stat_boost' && coach.perk.stat) {
      const matchesPosition = !coach.perk.position || coach.perk.position === player.position
      const matchesRarity = !coach.perk.rarityFilter || coach.perk.rarityFilter === player.rarity
      if (matchesPosition && matchesRarity) {
        const boostVal = coach.perk.values[coachLevel - 1] ?? 0
        boostedStats = { ...boostedStats, [coach.perk.stat]: boostedStats[coach.perk.stat] + boostVal }
      }
    }

    // Position fit check
    const fits = player.position === slotPos
    if (fits) positionFitCount++

    // Stat contribution with position penalty (stats based on natural position)
    const statPlayer = { ...player, stats: boostedStats } as Footballer
    let contribution = positionStats(statPlayer)
    if (!fits) {
      contribution *= player.position === 'GK' ? 0.5 : 0.8
    }
    baseStats += contribution
  }

  // ── 2. Rarity bonus (weight: 10) ──
  let rarityBonus = 0
  for (const p of players) {
    if (p) rarityBonus += RARITY_BONUS[p.rarity] ?? 0
  }

  // ── 3. Chemistry (weight: 15) — all pairs ──
  let chemistryScore = 0
  for (let i = 0; i < 11; i++) {
    for (let j = i + 1; j < 11; j++) {
      const a = players[i], b = players[j]
      if (!a || !b) continue
      const sameClub = a.club === b.club
      const sameNat = a.nationality === b.nationality
      if (sameClub && sameNat) chemistryScore += 8
      else if (sameClub) chemistryScore += 3
      else if (sameNat) chemistryScore += 3
    }
  }

  // ── 4. Coach bonus (weight: 10) ──
  let coachBonus = 0
  if (coach?.perk.type === 'stat_boost') {
    // Already applied to base stats — calculate total boost points added
    for (const p of players) {
      if (!p) continue
      const matchesPosition = !coach.perk.position || coach.perk.position === p.position
      const matchesRarity = !coach.perk.rarityFilter || coach.perk.rarityFilter === p.rarity
      if (matchesPosition && matchesRarity) {
        coachBonus += coach.perk.values[coachLevel - 1] ?? 0
      }
    }
  } else if (coach) {
    // Non-stat-boost coach: flat bonus per level
    coachBonus = 3 * coachLevel
  }

  // ── 5. Formation matchup (weight: 5) ──
  const formBonus = formationMatchupBonus(snap.formation, opponentFormation)

  // ── 6. Position fit (weight: 5) ──
  const positionFit = positionFitCount / 11

  // ── 7. Squad completeness (weight: 3) — always 1 (enforced by eligibility) ──
  const squadComplete = 1

  // ── 8. Habit streak bonus (weight: 5) ──
  const streakBonus = Math.min(snap.maxHabitStreak * 0.5, MAX_STREAK)

  // ── 9. Home advantage (weight: 2) ──
  const homeBonus = isHome ? 1 : 0

  // ── 10. Form/fatigue — random per player (weight: 5) ──
  const formRolls: number[] = []
  let formTotal = 0
  for (let i = 0; i < 11; i++) {
    // Range: -5 to +10, skewed positive
    const roll = rng.int(-5, 10)
    formRolls.push(roll)
    formTotal += roll
  }

  // ── Weighted sum ──
  const strength =
    (baseStats / MAX_BASE_STATS) * 40 +
    (rarityBonus / MAX_RARITY) * 10 +
    (chemistryScore / MAX_CHEMISTRY) * 15 +
    (coachBonus / MAX_COACH) * 10 +
    (formBonus / MAX_FORMATION) * 5 +
    positionFit * 5 +
    squadComplete * 3 +
    (streakBonus / MAX_STREAK) * 5 +
    homeBonus * 2 +
    ((formTotal - MIN_FORM) / (MAX_FORM - MIN_FORM)) * 5  // normalize [-55,110] to [0,1]

  return { strength, formRolls }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/battleEngine.ts
git commit -m "feat(battle): add team strength calculator"
```

---

### Task 5: Match Event Generator

**Files:**
- Modify: `src/lib/battleEngine.ts`

- [ ] **Step 1: Add event descriptions data**

Append to `src/lib/battleEngine.ts`:

```typescript
// ─── Event Generation ───────────────────────────────────────────────────────

const GOAL_DESCRIPTIONS = [
  'Удар з відстані', 'Гол головою', 'Контратака', 'Сольний прохід',
  'Удар зі штрафного', 'Удар з кутового', 'Далекий постріл',
  'Дриблінг та удар', 'Точний пас та гол', 'Удар з льоту',
  "Гол п'яткою", 'Гол після рикошету',
]

const NEAR_MISS_DESCRIPTIONS = [
  'Удар у штангу!', 'Удар вище воріт', 'М\'яч пролетів поряд',
  'Небезпечний момент!', 'Удар у перекладину!', 'Промах з близької відстані',
]

const GREAT_SAVE_DESCRIPTIONS = [
  'Чудовий сейв!', 'Рятівний кидок воротаря', 'Парад воротаря!',
  'Неймовірна реакція!', 'Рефлекс-сейв!',
]

const YELLOW_CARD_DESCRIPTIONS = [
  'Тактичний фол', 'Грубий підкат', 'Симуляція', 'Зрив атаки',
  'Фол у центрі поля', 'Гра рукою',
]

const RED_CARD_DESCRIPTIONS = [
  'Жорсткий підкат — червона!', 'Друга жовта — вилучення!',
  'Фол останньої надії', 'Удар суперника — пряма червона!',
]

const MOMENTUM_DESCRIPTIONS = [
  'перехоплює контроль над грою!', 'домінує у центрі поля!',
  'тисне на ворота суперника!', 'перехоплює ініціативу!',
]

export interface SimulationResult {
  events: import('../types').MatchEvent[]
  scoreHome: number
  scoreAway: number
  result: import('../types').MatchResult
}

export function simulateMatch(
  homeSnap: SquadSnapshot,
  awaySnap: SquadSnapshot,
  rng: SeededRng,
): SimulationResult {
  const homePlayers = resolveSquad(homeSnap)
  const awayPlayers = resolveSquad(awaySnap)

  const homeStrength = calcTeamStrength(homeSnap, awaySnap.formation, true, rng)
  const awayStrength = calcTeamStrength(awaySnap, homeSnap.formation, false, rng)

  const totalStrength = homeStrength.strength + awayStrength.strength
  const homeRatio = totalStrength > 0 ? homeStrength.strength / totalStrength : 0.5

  const events: import('../types').MatchEvent[] = []
  let scoreHome = 0
  let scoreAway = 0
  let homeGoalDebuff = 0  // accumulated from cards
  let awayGoalDebuff = 0

  // Determine total goals for the match (1-5, weighted toward 2-3)
  const goalBudgetRoll = rng.next()
  let totalGoalBudget: number
  if (goalBudgetRoll < 0.05) totalGoalBudget = 0
  else if (goalBudgetRoll < 0.20) totalGoalBudget = 1
  else if (goalBudgetRoll < 0.50) totalGoalBudget = 2
  else if (goalBudgetRoll < 0.78) totalGoalBudget = 3
  else if (goalBudgetRoll < 0.92) totalGoalBudget = 4
  else totalGoalBudget = 5

  // Pre-determine which minutes have goals
  const goalMinutes: number[] = []
  for (let i = 0; i < totalGoalBudget; i++) {
    goalMinutes.push(rng.int(1, 90))
  }
  goalMinutes.sort((a, b) => a - b)

  // Pre-determine some flavor event minutes
  const flavorMinuteSet = new Set<number>()
  const flavorCount = rng.int(5, 12)
  for (let i = 0; i < flavorCount; i++) {
    flavorMinuteSet.add(rng.int(1, 90))
  }
  // Remove collision with goal minutes
  for (const gm of goalMinutes) flavorMinuteSet.delete(gm)

  let goalIdx = 0

  for (let minute = 1; minute <= 90; minute++) {
    // ── Goal ──
    if (goalIdx < goalMinutes.length && goalMinutes[goalIdx] === minute) {
      const effectiveHomeRatio = Math.max(0.1, Math.min(0.9,
        homeRatio - homeGoalDebuff + awayGoalDebuff
      ))
      const isHomeGoal = rng.chance(effectiveHomeRatio)
      const team = isHomeGoal ? 'home' as const : 'away' as const
      const teamPlayers = isHomeGoal ? homePlayers : awayPlayers
      // Pick a FWD or MID as scorer, fallback to any
      const scorerCandidates = teamPlayers.filter(p => p && (p.position === 'FWD' || p.position === 'MID'))
      const scorer = rng.pick(scorerCandidates.length > 0 ? scorerCandidates : teamPlayers.filter(Boolean))

      if (isHomeGoal) scoreHome++; else scoreAway++

      events.push({
        minute,
        type: 'goal',
        team,
        playerId: scorer?.id ?? '',
        description: rng.pick(GOAL_DESCRIPTIONS),
      })
      goalIdx++
      continue
    }

    // ── Flavor events ──
    if (flavorMinuteSet.has(minute)) {
      const roll = rng.next()
      const team = rng.chance(homeRatio) ? 'home' as const : 'away' as const
      const teamPlayers = team === 'home' ? homePlayers : awayPlayers
      const anyPlayer = rng.pick(teamPlayers.filter(Boolean))

      if (roll < 0.15) {
        // Yellow card
        const defOrMid = teamPlayers.filter(p => p && (p.position === 'DEF' || p.position === 'MID'))
        const carded = rng.pick(defOrMid.length > 0 ? defOrMid : teamPlayers.filter(Boolean))
        if (team === 'home') homeGoalDebuff += 0.03; else awayGoalDebuff += 0.03
        events.push({
          minute, type: 'yellow_card', team,
          playerId: carded?.id ?? '',
          description: rng.pick(YELLOW_CARD_DESCRIPTIONS),
        })
      } else if (roll < 0.18) {
        // Red card (rare)
        const carded = rng.pick(teamPlayers.filter(Boolean))
        if (team === 'home') homeGoalDebuff += 0.10; else awayGoalDebuff += 0.10
        events.push({
          minute, type: 'red_card', team,
          playerId: carded?.id ?? '',
          description: rng.pick(RED_CARD_DESCRIPTIONS),
        })
      } else if (roll < 0.45) {
        // Near miss
        events.push({
          minute, type: 'near_miss', team,
          playerId: anyPlayer?.id ?? '',
          description: rng.pick(NEAR_MISS_DESCRIPTIONS),
        })
      } else if (roll < 0.65) {
        // Great save
        const oppositeTeam = team === 'home' ? 'away' as const : 'home' as const
        const keepers = (oppositeTeam === 'home' ? homePlayers : awayPlayers)
          .filter(p => p?.position === 'GK')
        const keeper = keepers.length > 0 ? rng.pick(keepers) : anyPlayer
        events.push({
          minute, type: 'great_save', team: oppositeTeam,
          playerId: keeper?.id ?? '',
          description: rng.pick(GREAT_SAVE_DESCRIPTIONS),
        })
      } else if (roll < 0.80) {
        // On fire (only if form roll was high)
        const formRolls = team === 'home' ? homeStrength.formRolls : awayStrength.formRolls
        const hotIdx = formRolls.findIndex(r => r >= 8)
        if (hotIdx >= 0) {
          const hotPlayer = teamPlayers[hotIdx]
          events.push({
            minute, type: 'on_fire', team,
            playerId: hotPlayer?.id ?? '',
            description: `${hotPlayer?.name ?? 'Гравець'} у відмінній формі!`,
          })
        } else {
          // Fallback to momentum shift
          events.push({
            minute, type: 'momentum_shift', team,
            playerId: '',
            description: rng.pick(MOMENTUM_DESCRIPTIONS),
          })
        }
      } else {
        // Momentum shift
        events.push({
          minute, type: 'momentum_shift', team,
          playerId: '',
          description: rng.pick(MOMENTUM_DESCRIPTIONS),
        })
      }
    }
  }

  // Sort events by minute (should already be sorted but ensure)
  events.sort((a, b) => a.minute - b.minute)

  const result: import('../types').MatchResult =
    scoreHome > scoreAway ? 'home_win' :
    scoreAway > scoreHome ? 'away_win' : 'draw'

  return { events, scoreHome, scoreAway, result }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/battleEngine.ts
git commit -m "feat(battle): add match event simulation engine"
```

---

## Chunk 3: Supabase API Layer

### Task 6: Challenge & Match CRUD

**Files:**
- Create: `src/lib/battleApi.ts`

All Supabase operations for challenges and matches.

- [ ] **Step 1: Create battleApi.ts**

```typescript
import { supabase } from './supabase'
import type { Challenge, Match, SquadSnapshot, MatchEvent, MatchResult } from '../types'

// ─── Row → Domain Mappers ───────────────────────────────────────────────────

function toChallenge(row: any): Challenge {
  return {
    id: row.id,
    challengerId: row.challenger_id,
    challengedId: row.challenged_id,
    status: row.status,
    challengerSquad: row.challenger_squad,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

function toMatch(row: any): Match {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    challengerId: row.challenger_id,
    challengedId: row.challenged_id,
    challengerSquad: row.challenger_squad,
    challengedSquad: row.challenged_squad,
    matchSeed: row.match_seed,
    events: row.events as MatchEvent[],
    scoreHome: row.score_home,
    scoreAway: row.score_away,
    result: row.result as MatchResult,
    coinsAwardedTo: (row.coins_awarded_to ?? []) as string[],
    playedAt: row.played_at,
  }
}

// ─── Challenges ─────────────────────────────────────────────────────────────

export async function sendChallenge(
  challengerId: string,
  challengedId: string,
  challengerSquad: SquadSnapshot,
): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      challenger_id: challengerId,
      challenged_id: challengedId,
      challenger_squad: challengerSquad,
    })
    .select()
    .single()
  if (error) throw error
  return toChallenge(data)
}

export async function cancelChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', challengeId)
    .eq('status', 'pending')
  if (error) throw error
}

export async function declineChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', challengeId)
    .eq('status', 'pending')
  if (error) throw error
}

export async function acceptChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', challengeId)
    .eq('status', 'pending')
  if (error) throw error
}

/** Fetch all pending challenges involving the current user */
export async function fetchChallenges(userId: string): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('status', 'pending')
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toChallenge)
}

/** Check if there's already a pending challenge between two users */
export async function hasPendingChallenge(
  userId: string,
  friendId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('challenges')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or(
      `and(challenger_id.eq.${userId},challenged_id.eq.${friendId}),` +
      `and(challenger_id.eq.${friendId},challenged_id.eq.${userId})`
    )
  if (error) throw error
  return (count ?? 0) > 0
}

/** Expire old pending challenges */
export async function expireChallenges(userId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .lt('expires_at', new Date().toISOString())
  if (error) throw error
}

// ─── Matches ────────────────────────────────────────────────────────────────

export async function createMatch(params: {
  challengeId: string
  challengerId: string
  challengedId: string
  challengerSquad: SquadSnapshot
  challengedSquad: SquadSnapshot
  matchSeed: string
  events: MatchEvent[]
  scoreHome: number
  scoreAway: number
  result: MatchResult
  coinsAwardedTo: string[]
}): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      challenge_id: params.challengeId,
      challenger_id: params.challengerId,
      challenged_id: params.challengedId,
      challenger_squad: params.challengerSquad,
      challenged_squad: params.challengedSquad,
      match_seed: params.matchSeed,
      events: params.events,
      score_home: params.scoreHome,
      score_away: params.scoreAway,
      result: params.result,
      coins_awarded_to: params.coinsAwardedTo,
    })
    .select()
    .single()
  if (error) throw error
  return toMatch(data)
}

export async function fetchMatchHistory(
  userId: string,
  limit = 50,
): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .order('played_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(toMatch)
}

/** Check if first-match reward has been claimed against a specific opponent */
export async function hasClaimedReward(
  userId: string,
  opponentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('matches')
    .select('coins_awarded_to')
    .or(
      `and(challenger_id.eq.${userId},challenged_id.eq.${opponentId}),` +
      `and(challenger_id.eq.${opponentId},challenged_id.eq.${userId})`
    )
  if (error) throw error
  // coins_awarded_to is a jsonb array of user IDs
  return (data ?? []).some(row =>
    (row.coins_awarded_to as string[]).includes(userId)
  )
}

/** Fetch unwatched matches for the challenger (matches they haven't seen yet) */
export async function fetchUnwatchedMatches(userId: string): Promise<Match[]> {
  // Get all matches where this user is the challenger
  // The "watched" check happens client-side via localStorage
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('challenger_id', userId)
    .order('played_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []).map(toMatch)
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/battleApi.ts
git commit -m "feat(battle): add Supabase CRUD for challenges and matches"
```

---

## Chunk 4: Sound Effects

### Task 7: Battle Sound Effects

**Files:**
- Modify: `src/lib/sounds.ts`

- [ ] **Step 1: Add battle sounds to sounds.ts**

Append to the end of the file (before the final closing, or just at the bottom):

```typescript
// ─── Battle: Goal celebration — crowd roar + whistle ────────────────────────
export function playGoal() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // Crowd roar: filtered noise burst (bandpass 200-800Hz)
    const roar = ac.createBufferSource()
    roar.buffer = noise(ac, 1.5)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8
    const rg = vol(ac)
    roar.connect(bp); bp.connect(rg); rg.connect(ac.destination)
    rg.gain.setValueAtTime(0, t)
    rg.gain.linearRampToValueAtTime(0.35, t + 0.05)
    rg.gain.setValueAtTime(0.35, t + 0.3)
    rg.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
    roar.start(t); roar.stop(t + 1.5)

    // Short whistle
    const whistle = ac.createOscillator()
    const wg = vol(ac)
    whistle.connect(wg); wg.connect(ac.destination)
    whistle.type = 'sine'
    whistle.frequency.value = 3000
    wg.gain.setValueAtTime(0, t)
    wg.gain.linearRampToValueAtTime(0.15, t + 0.01)
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    whistle.start(t); whistle.stop(t + 0.35)
  } catch { /* audio blocked */ }
}

// ─── Battle: Yellow card — sharp whistle ────────────────────────────────────
export function playYellowCard() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const whistle = ac.createOscillator()
    const wg = vol(ac)
    whistle.connect(wg); wg.connect(ac.destination)
    whistle.type = 'sine'
    whistle.frequency.setValueAtTime(3200, t)
    whistle.frequency.linearRampToValueAtTime(2800, t + 0.15)
    wg.gain.setValueAtTime(0, t)
    wg.gain.linearRampToValueAtTime(0.18, t + 0.01)
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    whistle.start(t); whistle.stop(t + 0.25)
  } catch { /* audio blocked */ }
}

// ─── Battle: Red card — long whistle + crowd gasp ───────────────────────────
export function playRedCard() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // Long whistle
    const whistle = ac.createOscillator()
    const wg = vol(ac)
    whistle.connect(wg); wg.connect(ac.destination)
    whistle.type = 'sine'
    whistle.frequency.value = 3000
    wg.gain.setValueAtTime(0, t)
    wg.gain.linearRampToValueAtTime(0.2, t + 0.01)
    wg.gain.setValueAtTime(0.2, t + 0.5)
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
    whistle.start(t); whistle.stop(t + 0.75)

    // Crowd gasp (noise burst through formant ~500Hz)
    const gasp = ac.createBufferSource()
    gasp.buffer = noise(ac, 0.4)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 2
    const gg = vol(ac)
    gasp.connect(bp); bp.connect(gg); gg.connect(ac.destination)
    gg.gain.setValueAtTime(0, t + 0.3)
    gg.gain.linearRampToValueAtTime(0.2, t + 0.35)
    gg.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
    gasp.start(t + 0.3); gasp.stop(t + 0.75)
  } catch { /* audio blocked */ }
}

// ─── Battle: Near miss — crowd "ooh" ────────────────────────────────────────
export function playNearMiss() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const ooh = ac.createBufferSource()
    ooh.buffer = noise(ac, 0.5)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 3
    const g = vol(ac)
    ooh.connect(bp); bp.connect(g); g.connect(ac.destination)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.15, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    ooh.start(t); ooh.stop(t + 0.5)
  } catch { /* audio blocked */ }
}

// ─── Battle: Great save — crowd applause ────────────────────────────────────
export function playGreatSave() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const clap = ac.createBufferSource()
    clap.buffer = noise(ac, 0.8)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 2000
    const g = vol(ac)
    clap.connect(hp); hp.connect(g); g.connect(ac.destination)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12, t + 0.03)
    g.gain.setValueAtTime(0.12, t + 0.2)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
    clap.start(t); clap.stop(t + 0.8)
  } catch { /* audio blocked */ }
}

// ─── Battle: Final whistle — triple blast ───────────────────────────────────
export function playFinalWhistle() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    for (let i = 0; i < 3; i++) {
      const whistle = ac.createOscillator()
      const wg = vol(ac)
      whistle.connect(wg); wg.connect(ac.destination)
      whistle.type = 'sine'
      whistle.frequency.value = 3000
      const s = t + i * 0.2
      wg.gain.setValueAtTime(0, s)
      wg.gain.linearRampToValueAtTime(0.18, s + 0.01)
      wg.gain.exponentialRampToValueAtTime(0.001, s + 0.12)
      whistle.start(s); whistle.stop(s + 0.15)
    }
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/sounds.ts
git commit -m "feat(battle): add match sound effects (goal, cards, whistle, crowd)"
```

---

## Chunk 5: Live Match UI

### Task 8: MatchLive Component

**Files:**
- Create: `src/components/battle/MatchLive.tsx`

The core live match playback component. Takes a Match object and plays through events minute-by-minute.

- [ ] **Step 1: Create MatchLive component**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Match, MatchEvent, MatchResult } from '../../types'
import { footballers } from '../../data/footballers'
import {
  playGoal, playYellowCard, playRedCard,
  playNearMiss, playGreatSave, playFinalWhistle,
} from '../../lib/sounds'

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽', yellow_card: '🟨', red_card: '🟥',
  near_miss: '💨', great_save: '🧤', on_fire: '🔥', momentum_shift: '🔄',
}

const SOUND_MAP: Record<string, (() => void) | undefined> = {
  goal: playGoal,
  yellow_card: playYellowCard,
  red_card: playRedCard,
  near_miss: playNearMiss,
  great_save: playGreatSave,
}

function getPlayerName(id: string): string {
  return footballers.find(f => f.id === id)?.name ?? 'Гравець'
}

interface Props {
  match: Match
  homeName: string
  awayName: string
  onFinish: () => void
}

export function MatchLive({ match, homeName, awayName, onFinish }: Props) {
  const [currentMinute, setCurrentMinute] = useState(0)
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([])
  const [scoreHome, setScoreHome] = useState(0)
  const [scoreAway, setScoreAway] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [isHalfTime, setIsHalfTime] = useState(false)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const tick = useCallback(() => {
    setCurrentMinute(prev => {
      const next = prev + 1
      if (next > 90) {
        playFinalWhistle()
        setIsFinished(true)
        return 90
      }

      // Check for events at this minute
      const minuteEvents = match.events.filter(e => e.minute === next)

      if (minuteEvents.length > 0) {
        setVisibleEvents(ve => [...ve, ...minuteEvents])

        for (const ev of minuteEvents) {
          // Play sound
          SOUND_MAP[ev.type]?.()
          // Update score
          if (ev.type === 'goal') {
            if (ev.team === 'home') setScoreHome(s => s + 1)
            else setScoreAway(s => s + 1)
          }
        }
      }

      // Half-time pause at 45
      if (next === 45) {
        setIsHalfTime(true)
        setTimeout(() => setIsHalfTime(false), 1500)
      }

      return next
    })
  }, [match.events])

  useEffect(() => {
    if (isFinished || isHalfTime) return

    // Variable speed: faster when nothing happens
    const hasEvent = match.events.some(e => e.minute === currentMinute + 1)
    const delay = hasEvent ? 800 : 250  // pause on events, fast otherwise

    timerRef.current = setTimeout(tick, delay)
    return () => clearTimeout(timerRef.current)
  }, [currentMinute, isFinished, isHalfTime, tick, match.events])

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleEvents])

  const resultLabel =
    match.result === 'home_win' ? 'ПЕРЕМОГА' :
    match.result === 'away_win' ? 'ПОРАЗКА' : 'НІЧИЯ'

  const resultColor =
    match.result === 'home_win' ? 'text-[#00E676]' :
    match.result === 'away_win' ? 'text-red-400' : 'text-yellow-400'

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Scoreboard */}
      <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-center gap-5">
          <div className="text-center flex-1">
            <div className="font-oswald text-[10px] tracking-[0.2em] text-[#00E676] uppercase mb-1 truncate">
              {homeName}
            </div>
            <div className="font-oswald text-4xl font-bold text-white">{scoreHome}</div>
          </div>
          <div className="text-center">
            <div className="font-oswald text-sm text-[#5A7090]">{currentMinute}'</div>
            {isHalfTime && (
              <div className="font-oswald text-xs text-yellow-400 mt-1">HT</div>
            )}
          </div>
          <div className="text-center flex-1">
            <div className="font-oswald text-[10px] tracking-[0.2em] text-red-400 uppercase mb-1 truncate">
              {awayName}
            </div>
            <div className="font-oswald text-4xl font-bold text-white">{scoreAway}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-[#1A2336] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#00E676] rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentMinute / 90) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      {/* Event feed */}
      <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-4 max-h-[40vh] overflow-y-auto">
        {visibleEvents.length === 0 && !isFinished && (
          <div className="text-center text-[#5A7090] text-sm py-4 font-oswald tracking-wider">
            МАТЧ РОЗПОЧАВСЯ...
          </div>
        )}
        <AnimatePresence>
          {visibleEvents.map((ev, i) => (
            <motion.div
              key={`${ev.minute}-${ev.type}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2 py-2 text-sm ${
                ev.type === 'goal' ? 'text-white font-bold' : 'text-[#8A9BBF]'
              }`}
            >
              <span className="text-[#5A7090] font-oswald text-xs w-8 shrink-0 pt-0.5">
                {ev.minute}'
              </span>
              <span className="shrink-0">{EVENT_ICONS[ev.type]}</span>
              <span>
                {ev.type === 'momentum_shift' ? (
                  <span className={ev.team === 'home' ? 'text-[#00E676]' : 'text-red-400'}>
                    {ev.team === 'home' ? homeName : awayName} {ev.description}
                  </span>
                ) : (
                  <>
                    <span className={ev.team === 'home' ? 'text-[#00E676]' : 'text-red-400'}>
                      {ev.playerId ? getPlayerName(ev.playerId) : (ev.team === 'home' ? homeName : awayName)}
                    </span>
                    {' — '}
                    {ev.description}
                  </>
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={eventsEndRef} />
      </div>

      {/* Full-time result */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-6 text-center"
          >
            <div className="font-oswald text-xs tracking-[0.3em] text-[#5A7090] uppercase mb-2">
              Фінальний свисток
            </div>
            <div className={`font-oswald text-3xl font-bold ${resultColor} mb-1`}>
              {resultLabel}
            </div>
            <div className="font-oswald text-xl text-white mb-4">
              {scoreHome} — {scoreAway}
            </div>
            {match.coinsAwardedTo.length > 0 && (
              <div className="text-[#00E676] text-sm mb-4">
                +{match.result === 'draw' ? 50 : 100} 🪙
              </div>
            )}
            <button
              onClick={onFinish}
              className="px-6 py-2.5 bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] rounded-xl font-oswald font-bold text-sm tracking-wider hover:bg-[#00E676]/20 transition-colors cursor-pointer"
            >
              ПРОДОВЖИТИ
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/battle/MatchLive.tsx
git commit -m "feat(battle): add live match playback component"
```

---

## Chunk 6: Friends Page Integration

### Task 9: Battle Orchestration Hook

**Files:**
- Create: `src/hooks/useBattle.ts`

Custom hook that orchestrates the full battle flow: fetching challenges, sending/accepting, creating matches.

- [ ] **Step 1: Create useBattle hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import type { Challenge, Match, SquadSnapshot } from '../types'
import {
  sendChallenge as apiSendChallenge,
  cancelChallenge as apiCancelChallenge,
  declineChallenge as apiDeclineChallenge,
  acceptChallenge as apiAcceptChallenge,
  fetchChallenges,
  fetchMatchHistory as apiFetchMatchHistory,
  hasClaimedReward as apiHasClaimedReward,
  hasPendingChallenge as apiHasPendingChallenge,
  createMatch,
  expireChallenges,
  fetchUnwatchedMatches,
} from '../lib/battleApi'
import { fetchUserProfile } from '../lib/profileSync'
import { simulateMatch } from '../lib/battleEngine'
import { createRng, hashSeed } from '../lib/seededRng'

const WATCHED_KEY = 'habitfc_watched_matches'

function getWatchedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function markWatched(matchId: string) {
  const set = getWatchedSet()
  set.add(matchId)
  localStorage.setItem(WATCHED_KEY, JSON.stringify([...set]))
}

export function useBattle() {
  const user = useAuthStore(s => s.user)
  const state = useAppStore.getState

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [matchHistory, setMatchHistory] = useState<Match[]>([])
  const [unwatchedMatches, setUnwatchedMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id ?? ''

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      await expireChallenges(userId)
      const [ch, mh, uw] = await Promise.all([
        fetchChallenges(userId),
        apiFetchMatchHistory(userId),
        fetchUnwatchedMatches(userId),
      ])
      setChallenges(ch)
      setMatchHistory(mh)
      // Filter to truly unwatched
      const watched = getWatchedSet()
      setUnwatchedMatches(uw.filter(m => !watched.has(m.id)))
    } catch { /* silent */ }
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  function buildMySnapshot(): SquadSnapshot {
    const s = state()
    return {
      squad: s.squad.filter((id): id is string => id !== null),
      formation: s.formation,
      coachId: s.assignedCoach ?? '',
      coachLevel: s.assignedCoach ? (s.coachCollection[s.assignedCoach] ?? 1) : 1,
      maxHabitStreak: Math.max(0, ...s.habits.map(h => h.streak)),
    }
  }

  async function sendChallenge(friendId: string) {
    if (!userId) return
    const snap = buildMySnapshot()
    await apiSendChallenge(userId, friendId, snap)
    await refresh()
  }

  async function cancelChallenge(challengeId: string) {
    await apiCancelChallenge(challengeId)
    await refresh()
  }

  async function declineChallenge(challengeId: string) {
    await apiDeclineChallenge(challengeId)
    await refresh()
  }

  async function acceptChallengeAndSimulate(challenge: Challenge): Promise<Match> {
    // 1. Accept the challenge
    await apiAcceptChallenge(challenge.id)

    // 2. Build my squad snapshot
    const mySnap = buildMySnapshot()

    // 3. Generate match seed
    const matchSeed = `${challenge.challengerId}-${userId}-${Date.now()}`

    // 4. Simulate match
    const rng = createRng(hashSeed(matchSeed))
    const sim = simulateMatch(
      challenge.challengerSquad,  // home = challenger
      mySnap,                     // away = challenged (me)
      rng,
    )

    // 5. Determine coin rewards (both players can earn on draw)
    const coinsAwardedTo: string[] = []

    // Acceptor (me = away team)
    const myClaimed = await apiHasClaimedReward(userId, challenge.challengerId)
    if (!myClaimed) {
      if (sim.result === 'away_win') {
        coinsAwardedTo.push(userId)
        useAppStore.getState().addCoins(100)
      } else if (sim.result === 'draw') {
        coinsAwardedTo.push(userId)
        useAppStore.getState().addCoins(50)
      }
    }

    // Challenger (home team) — coins awarded when they watch the replay
    const challengerClaimed = await apiHasClaimedReward(challenge.challengerId, userId)
    if (!challengerClaimed) {
      if (sim.result === 'home_win' || sim.result === 'draw') {
        coinsAwardedTo.push(challenge.challengerId)
      }
    }

    // 6. Store match in DB
    const match = await createMatch({
      challengeId: challenge.id,
      challengerId: challenge.challengerId,
      challengedId: userId,
      challengerSquad: challenge.challengerSquad,
      challengedSquad: mySnap,
      matchSeed,
      events: sim.events,
      scoreHome: sim.scoreHome,
      scoreAway: sim.scoreAway,
      result: sim.result,
      coinsAwardedTo,
    })

    await refresh()
    return match
  }

  function markMatchWatched(matchId: string) {
    markWatched(matchId)

    // Award coins to challenger when they watch for the first time (unwatched only)
    const match = unwatchedMatches.find(m => m.id === matchId)
    if (match && match.coinsAwardedTo.includes(userId)) {
      if (match.result === 'home_win') {
        useAppStore.getState().addCoins(100)
      } else if (match.result === 'draw') {
        useAppStore.getState().addCoins(50)
      }
    }

    setUnwatchedMatches(prev => prev.filter(m => m.id !== matchId))
  }

  async function canChallenge(friendId: string): Promise<{
    canChallenge: boolean
    reason?: string
  }> {
    const s = state()
    const filledSlots = s.squad.filter(id => id !== null).length
    if (filledSlots < 11) return { canChallenge: false, reason: 'Заповніть склад (11/11)' }
    if (!s.assignedCoach) return { canChallenge: false, reason: 'Призначте тренера' }

    // Check friend's squad
    const profile = await fetchUserProfile(friendId)
    if (!profile) return { canChallenge: false, reason: 'Профіль не знайдено' }
    const friendState = profile.state
    const friendFilled = (friendState.squad ?? []).filter(id => id !== null).length
    if (friendFilled < 11) return { canChallenge: false, reason: 'У друга неповний склад' }
    if (!friendState.assignedCoach) return { canChallenge: false, reason: 'У друга немає тренера' }

    // Check pending challenge
    const pending = await apiHasPendingChallenge(userId, friendId)
    if (pending) return { canChallenge: false, reason: 'Виклик вже відправлено' }

    return { canChallenge: true }
  }

  return {
    challenges,
    matchHistory,
    unwatchedMatches,
    loading,
    refresh,
    sendChallenge,
    cancelChallenge,
    declineChallenge,
    acceptChallengeAndSimulate,
    markMatchWatched,
    canChallenge,
    incomingChallenges: challenges.filter(c => c.challengedId === userId),
    outgoingChallenges: challenges.filter(c => c.challengerId === userId),
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBattle.ts
git commit -m "feat(battle): add useBattle orchestration hook"
```

---

### Task 10: Update Friends Page

**Files:**
- Modify: `src/pages/Friends.tsx`

Restructure the Friends page to include: incoming challenges, outgoing challenges, unwatched match notifications, match history, and the existing friends list with Challenge buttons.

- [ ] **Step 1: Rewrite Friends.tsx with battle integration**

This is a full rewrite of `src/pages/Friends.tsx`. The existing search + following list stays, but now wrapped with battle sections.

```typescript
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { searchUsers, fetchFollowingProfiles, type ProfileRow } from '../lib/profileSync'
import { ProfileModal } from '../components/ui/ProfileModal'
import { MatchLive } from '../components/battle/MatchLive'
import { useBattle } from '../hooks/useBattle'
import type { Match, Challenge } from '../types'

function AvatarSmall({ url, emoji }: { url: string | null; emoji: string | null }) {
  if (url) return <img src={url} alt="avatar" className="w-9 h-9 rounded-full object-cover bg-[#0A0F1A]" />
  return (
    <div className="w-9 h-9 rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center text-base">
      {emoji ?? '👤'}
    </div>
  )
}

function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return <span className="text-red-400 text-xs">Закінчився</span>
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return <span className="text-[#5A7090] text-xs">{hours}г {mins}хв</span>
}

export function Friends() {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const following = useAppStore(state => state.following)
  const setFollowing = (ids: string[]) => {
    useAppStore.setState({ following: ids })
  }

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [followingProfiles, setFollowingProfiles] = useState<ProfileRow[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const initialLoadDone = useRef(false)

  // Battle state
  const battle = useBattle()
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [challengeLoading, setChallengeLoading] = useState<string | null>(null)
  const [activeMatchNames, setActiveMatchNames] = useState<{ home: string; away: string }>({
    home: '', away: '',
  })

  // Load following profiles once
  useEffect(() => {
    if (initialLoadDone.current || following.length === 0) return
    initialLoadDone.current = true
    fetchFollowingProfiles(following).then(setFollowingProfiles).catch(() => {})
  }, [following])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      if (!user) return
      setSearchLoading(true)
      try {
        const results = await searchUsers(query, user.id)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query, user])

  function handleToggleFollow(userId: string) {
    const isFollowing = following.includes(userId)
    const updated = isFollowing
      ? following.filter(id => id !== userId)
      : [...following, userId]
    setFollowing(updated)
    if (isFollowing) {
      setFollowingProfiles(prev => prev.filter(p => p.user_id !== userId))
    } else {
      const found = searchResults.find(r => r.user_id === userId)
      if (found) setFollowingProfiles(prev => [...prev, found])
    }
  }

  async function handleSendChallenge(friendId: string) {
    setChallengeLoading(friendId)
    try {
      const check = await battle.canChallenge(friendId)
      if (!check.canChallenge) {
        alert(check.reason)
        return
      }
      await battle.sendChallenge(friendId)
    } catch {
      alert('Помилка відправки виклику')
    } finally {
      setChallengeLoading(null)
    }
  }

  async function handleAccept(challenge: Challenge) {
    setChallengeLoading(challenge.id)
    try {
      const match = await battle.acceptChallengeAndSimulate(challenge)
      // Find names
      const challengerProfile = followingProfiles.find(p => p.user_id === challenge.challengerId)
      setActiveMatchNames({
        home: challengerProfile?.username ?? 'Суперник',
        away: 'Ви',
      })
      setActiveMatch(match)
    } catch {
      alert('Помилка прийняття виклику')
    } finally {
      setChallengeLoading(null)
    }
  }

  function handleWatchUnwatched(match: Match) {
    const opponentId = match.challengerId === user?.id ? match.challengedId : match.challengerId
    const opponentProfile = followingProfiles.find(p => p.user_id === opponentId)
    setActiveMatchNames({
      home: match.challengerId === user?.id ? 'Ви' : (opponentProfile?.username ?? 'Суперник'),
      away: match.challengedId === user?.id ? 'Ви' : (opponentProfile?.username ?? 'Суперник'),
    })
    setActiveMatch(match)
  }

  function handleMatchFinish() {
    if (activeMatch) {
      battle.markMatchWatched(activeMatch.id)
    }
    setActiveMatch(null)
  }

  const followingSet = new Set(following)

  // If watching a match, show only the match
  if (activeMatch) {
    return (
      <MatchLive
        match={activeMatch}
        homeName={activeMatchNames.home}
        awayName={activeMatchNames.away}
        onFinish={handleMatchFinish}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">· МЕРЕЖА ·</div>
          <h1 className="font-oswald text-2xl sm:text-4xl font-bold uppercase tracking-wide text-white">Друзі</h1>
        </div>
        <button
          onClick={() => setProfileOpen(true)}
          className="sm:hidden w-10 h-10 rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center text-[#5A7090] hover:text-[#00E676] hover:border-[#00E676]/40 transition-colors cursor-pointer"
        >
          👤
        </button>
      </div>

      {/* Unwatched matches notification */}
      {battle.unwatchedMatches.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="font-oswald text-xs text-yellow-400 uppercase tracking-widest">
            ⚔️ Матч готовий!
          </div>
          {battle.unwatchedMatches.map(match => {
            const opponentId = match.challengerId === user?.id ? match.challengedId : match.challengerId
            const opponent = followingProfiles.find(p => p.user_id === opponentId)
            return (
              <div
                key={match.id}
                onClick={() => handleWatchUnwatched(match)}
                className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-yellow-400/30 rounded-xl cursor-pointer hover:border-yellow-400/60 transition-colors"
              >
                <span className="text-xl">⚽</span>
                <span className="flex-1 text-sm text-white">
                  vs <span className="font-bold">{opponent?.username ?? 'Суперник'}</span>
                </span>
                <span className="font-oswald text-xs text-yellow-400 tracking-wider">ДИВИТИСЬ</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Incoming challenges */}
      {battle.incomingChallenges.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="font-oswald text-xs text-[#00E676] uppercase tracking-widest">
            📥 Вхідні виклики
          </div>
          {battle.incomingChallenges.map(ch => {
            const challenger = followingProfiles.find(p => p.user_id === ch.challengerId)
            return (
              <div key={ch.id} className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl">
                <AvatarSmall url={challenger?.avatar_url ?? null} emoji={challenger?.avatar_emoji ?? null} />
                <div className="flex-1">
                  <div className="text-sm text-white font-bold">{challenger?.username ?? 'Гравець'}</div>
                  <TimeLeft expiresAt={ch.expiresAt} />
                </div>
                <button
                  onClick={() => handleAccept(ch)}
                  disabled={challengeLoading === ch.id}
                  className="px-3 py-1.5 bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] rounded-lg font-oswald text-xs font-bold hover:bg-[#00E676]/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {challengeLoading === ch.id ? '...' : 'ПРИЙНЯТИ'}
                </button>
                <button
                  onClick={() => battle.declineChallenge(ch.id)}
                  className="px-3 py-1.5 bg-[#1A2336] text-[#5A7090] rounded-lg font-oswald text-xs font-bold hover:text-red-400 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Outgoing challenges */}
      {battle.outgoingChallenges.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest">
            📤 Відправлені виклики
          </div>
          {battle.outgoingChallenges.map(ch => {
            const challenged = followingProfiles.find(p => p.user_id === ch.challengedId)
            return (
              <div key={ch.id} className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl">
                <AvatarSmall url={challenged?.avatar_url ?? null} emoji={challenged?.avatar_emoji ?? null} />
                <div className="flex-1">
                  <div className="text-sm text-white">{challenged?.username ?? 'Гравець'}</div>
                  <TimeLeft expiresAt={ch.expiresAt} />
                </div>
                <button
                  onClick={() => battle.cancelChallenge(ch.id)}
                  className="px-3 py-1.5 bg-[#1A2336] text-[#5A7090] rounded-lg font-oswald text-xs font-bold hover:text-red-400 transition-colors cursor-pointer"
                >
                  СКАСУВАТИ
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Match History */}
      {battle.matchHistory.length > 0 && (
        <div className="mb-6">
          <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-3">
            📋 Історія матчів
          </div>
          <div className="space-y-2">
            {battle.matchHistory.slice(0, 10).map(match => {
              const opponentId = match.challengerId === user?.id ? match.challengedId : match.challengerId
              const opponent = followingProfiles.find(p => p.user_id === opponentId)
              const isHome = match.challengerId === user?.id
              const myScore = isHome ? match.scoreHome : match.scoreAway
              const theirScore = isHome ? match.scoreAway : match.scoreHome
              const myResult = isHome
                ? match.result === 'home_win' ? 'W' : match.result === 'away_win' ? 'L' : 'D'
                : match.result === 'away_win' ? 'W' : match.result === 'home_win' ? 'L' : 'D'
              const resultColor = myResult === 'W' ? 'text-[#00E676] bg-[#00E676]/10' :
                myResult === 'L' ? 'text-red-400 bg-red-400/10' : 'text-yellow-400 bg-yellow-400/10'

              return (
                <div
                  key={match.id}
                  onClick={() => {
                    setActiveMatchNames({
                      home: isHome ? 'Ви' : (opponent?.username ?? 'Суперник'),
                      away: isHome ? (opponent?.username ?? 'Суперник') : 'Ви',
                    })
                    setActiveMatch(match)
                  }}
                  className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl cursor-pointer hover:border-[#00E676]/20 transition-colors"
                >
                  <span className={`font-oswald text-xs font-bold w-6 h-6 rounded flex items-center justify-center ${resultColor}`}>
                    {myResult}
                  </span>
                  <span className="flex-1 text-sm text-white">
                    vs {opponent?.username ?? 'Суперник'}
                  </span>
                  <span className="font-oswald text-sm text-white font-bold">
                    {myScore} — {theirScore}
                  </span>
                  <span className="text-[#5A7090] text-xs">
                    {new Date(match.playedAt).toLocaleDateString('uk-UA')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Пошук за ім'ям..."
          className="w-full bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
        />
        {searchLoading && (
          <p className="text-[#5A7090] text-xs mt-2 font-oswald tracking-wider">ПОШУК...</p>
        )}
        {!searchLoading && query.length >= 2 && searchResults.length === 0 && (
          <p className="text-[#5A7090] text-xs mt-2">Нікого не знайдено</p>
        )}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(row => (
              <div
                key={row.user_id}
                className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl cursor-pointer hover:border-[#00E676]/30 transition-colors"
                onClick={() => navigate(`/profile/${row.user_id}`)}
              >
                <AvatarSmall url={row.avatar_url} emoji={row.avatar_emoji} />
                <span className="flex-1 font-oswald font-bold text-white text-sm">{row.username}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleToggleFollow(row.user_id) }}
                  className={`px-3 py-1 rounded-lg font-oswald text-xs font-bold transition-colors cursor-pointer ${
                    followingSet.has(row.user_id)
                      ? 'bg-[#1A2336] text-[#5A7090] hover:text-red-400'
                      : 'bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] hover:bg-[#00E676]/20'
                  }`}
                >
                  {followingSet.has(row.user_id) ? 'Відписатись' : 'Слідкувати'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Following list with Challenge buttons */}
      <div>
        <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-3">
          Відстежую · {following.length}
        </div>
        {following.length === 0 ? (
          <p className="text-[#5A7090] text-sm">Ви ще нікого не відстежуєте</p>
        ) : (
          <div className="space-y-2">
            {followingProfiles.map(row => (
              <div
                key={row.user_id}
                className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl cursor-pointer hover:border-[#00E676]/30 transition-colors"
                onClick={() => navigate(`/profile/${row.user_id}`)}
              >
                <AvatarSmall url={row.avatar_url} emoji={row.avatar_emoji} />
                <span className="flex-1 font-oswald font-bold text-white text-sm">{row.username}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleSendChallenge(row.user_id) }}
                  disabled={challengeLoading === row.user_id}
                  className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-oswald text-xs font-bold hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50 mr-1"
                >
                  {challengeLoading === row.user_id ? '...' : '⚔️'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleToggleFollow(row.user_id) }}
                  className="px-3 py-1 rounded-lg font-oswald text-xs font-bold transition-colors cursor-pointer bg-[#1A2336] text-[#5A7090] hover:text-red-400"
                >
                  Відписатись
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Friends.tsx
git commit -m "feat(battle): integrate battles into Friends page"
```

---

### Task 11: Nav Badge for Unwatched Matches

**Files:**
- Create: `src/hooks/useUnwatchedCount.ts`
- Modify: `src/App.tsx`

The spec requires a badge/dot on the Friends nav link when there are unwatched matches.

- [ ] **Step 1: Create useUnwatchedCount hook**

```typescript
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { fetchUnwatchedMatches } from '../lib/battleApi'

const WATCHED_KEY = 'habitfc_watched_matches'

function getWatchedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

export function useUnwatchedCount() {
  const user = useAuthStore(s => s.user)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchUnwatchedMatches(user.id).then(matches => {
      const watched = getWatchedSet()
      setCount(matches.filter(m => !watched.has(m.id)).length)
    }).catch(() => {})
  }, [user])

  return count
}
```

- [ ] **Step 2: Add badge to BottomNav and desktop NavLink in App.tsx**

In `App.tsx`, import the hook and add a badge dot:

```typescript
import { useUnwatchedCount } from './hooks/useUnwatchedCount'
```

In `BottomNav`, replace the Friends NavLink with:
```tsx
<NavLink to="/friends" className={tabClass}>
  <div className="relative">
    <FriendsIcon />
    {unwatchedCount > 0 && (
      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full" />
    )}
  </div>
  <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Друзі</span>
</NavLink>
```

And similarly in the desktop NavBar, wrap the Друзі link with a relative container and dot.

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useUnwatchedCount.ts src/App.tsx
git commit -m "feat(battle): add nav badge for unwatched matches"
```

---

### Task 12: Final Build & Commit

- [ ] **Step 1: Create required directories**

Before implementation, ensure new directories exist:
```bash
mkdir -p src/hooks src/components/battle supabase/migrations
```

- [ ] **Step 2: Run final build check**

Run: `npm run build 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Final commit if any remaining changes**

```bash
git add -A
git commit -m "feat(battle): squad battles feature complete"
```

---

## Post-Implementation Checklist

- [ ] Run the Supabase migration SQL against the production database
- [ ] Test challenge flow: send → accept → watch match → check coin reward
- [ ] Test edge cases: expired challenge, cancel, decline, duplicate challenge
- [ ] Test eligibility: incomplete squad, no coach
- [ ] Test match replay from history
- [ ] Test unwatched match notification for challenger
- [ ] Verify sound effects play correctly for each event type
- [ ] Test on mobile viewport
