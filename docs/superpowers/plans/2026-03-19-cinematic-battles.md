# Cinematic Match Battles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cinematic multi-phase events (penalties, free kicks, corners, counterattacks, VAR), auto-bench with substitutions, and phase-driven match pacing to make battles dramatic and engaging.

**Architecture:** Layered on existing `simulateMatch()` engine — new event types with `phases` arrays drive a phase machine in `MatchLive`. Cinematic events are lead-ins that precede canonical outcome events (goal/save/miss). A new `CinematicOverlay` component renders animated sequences on the pitch. Player rating logic is extracted to a shared module for use in both engine (halftime subs) and UI (post-match display).

**Tech Stack:** React 19, TypeScript 5.9, Framer Motion 12, Web Audio API, Zustand 5, Supabase (JSONB — no migration needed)

**Spec:** `docs/superpowers/specs/2026-03-19-cinematic-battles-design.md`

**Verification:** No test framework in this project. Verify each task with `npm run build` (TypeScript + Vite build). Visual verification via `npm run dev`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types.ts` | Modify | Add new event types, optional fields to `MatchEvent`, `bench` to `SquadSnapshot` |
| `src/lib/playerRating.ts` | Create | Shared `buildPlayerStats()` + `calcRating()` extracted from MatchLive |
| `src/lib/battleEngine.ts` | Modify | Cinematic goal rolling, corners, VAR, phase generation, auto-bench, halftime/red-card subs |
| `src/lib/sounds.ts` | Modify | 8 new synthesized sounds for cinematic phases |
| `src/hooks/useBattle.ts` | Modify | Compute bench in `buildMySnapshot()` |
| `src/components/battle/CinematicOverlay.tsx` | Create | Animated overlays for penalty/free kick/corner/counterattack/VAR |
| `src/components/battle/MatchLive.tsx` | Modify | Phase machine, cinematic event queuing, sub display, PostMatchLineup bench section |

---

### Task 1: Update type definitions

**Files:**
- Modify: `src/types.ts:100-135`

- [ ] **Step 1: Add new event types and fields to `MatchEvent`**

In `src/types.ts`, update `MatchEventType` union and `MatchEvent` interface:

```typescript
export type MatchEventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'near_miss'
  | 'great_save'
  | 'on_fire'
  | 'momentum_shift'
  | 'penalty'
  | 'free_kick'
  | 'corner'
  | 'counterattack'
  | 'var_review'
  | 'substitution'

export interface MatchEventPhase {
  phase: string
  duration: number  // seconds
}

export interface MatchEvent {
  minute: number
  type: MatchEventType
  team: 'home' | 'away'
  playerId: string
  description: string
  phases?: MatchEventPhase[]           // cinematic sequence
  varOutcome?: 'confirmed' | 'disallowed'  // only on var_review
  subInPlayerId?: string               // only on substitution (playerId = leaving, subInPlayerId = entering)
}
```

- [ ] **Step 2: Add `bench` to `SquadSnapshot`**

```typescript
export interface SquadSnapshot {
  squad: string[]           // 11 footballer IDs
  formation: string
  coachId: string
  coachLevel: number
  maxHabitStreak: number
  bench: string[]           // 0-3 auto-picked player IDs
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors. Existing code that reads `SquadSnapshot` will need `bench` added at construction sites — these will show as errors to fix in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(battle): add cinematic event types, phases, and bench to type definitions"
```

---

### Task 2: Extract player rating to shared module

**Files:**
- Create: `src/lib/playerRating.ts`
- Modify: `src/components/battle/MatchLive.tsx:38-83`

- [ ] **Step 1: Create `src/lib/playerRating.ts`**

Extract `PlayerMatchStats`, `buildPlayerStats`, and `calcRating` from `MatchLive.tsx`. Add `formRoll` as a tiebreaker input to `calcRating`:

```typescript
import type { MatchEvent } from '../types'

export interface PlayerMatchStats {
  goals: number
  yellowCards: number
  redCards: number
  nearMisses: number
  greatSaves: number
  onFire: boolean
}

export function buildPlayerStats(events: MatchEvent[]): Record<string, PlayerMatchStats> {
  const stats: Record<string, PlayerMatchStats> = {}
  const ensure = (id: string) => {
    if (!id) return
    if (!stats[id]) stats[id] = { goals: 0, yellowCards: 0, redCards: 0, nearMisses: 0, greatSaves: 0, onFire: false }
  }
  for (const ev of events) {
    if (!ev.playerId) continue
    ensure(ev.playerId)
    const s = stats[ev.playerId]
    if (!s) continue
    switch (ev.type) {
      case 'goal': s.goals++; break
      case 'yellow_card': s.yellowCards++; break
      case 'red_card': s.redCards++; break
      case 'near_miss': s.nearMisses++; break
      case 'great_save': s.greatSaves++; break
      case 'on_fire': s.onFire = true; break
    }
  }
  return stats
}

/** Rating 5.0-10.0 based on match contributions. formRoll (optional) breaks ties for players with no events. */
export function calcRating(playerId: string, stats: Record<string, PlayerMatchStats>, formRoll?: number): number {
  const s = stats[playerId]
  let rating = 6.5
  if (s) {
    rating += s.goals * 1.0
    rating += s.greatSaves * 0.6
    rating += s.nearMisses * 0.2
    rating -= s.yellowCards * 0.3
    rating -= s.redCards * 1.0
    if (s.onFire) rating += 0.4
  }
  // formRoll tiebreaker: map [-5, 10] to [-0.3, 0.3] so it nudges but doesn't override real events
  if (formRoll !== undefined) {
    rating += (formRoll / 15) * 0.3
  }
  return Math.max(5.0, Math.min(10.0, Math.round(rating * 10) / 10))
}
```

- [ ] **Step 2: Update `MatchLive.tsx` to import from shared module**

Remove the `PlayerMatchStats` interface, `buildPlayerStats` function, and `calcRating` function from `MatchLive.tsx`. Replace with imports:

```typescript
import { buildPlayerStats, calcRating } from '../../lib/playerRating'
import type { PlayerMatchStats } from '../../lib/playerRating'
```

Keep all usages of these functions in `MatchLive.tsx` as-is (no `formRoll` argument needed for UI display — it's optional).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS — no behavior change, just extraction.

- [ ] **Step 4: Commit**

```bash
git add src/lib/playerRating.ts src/components/battle/MatchLive.tsx
git commit -m "refactor(battle): extract playerRating to shared module for engine + UI use"
```

---

### Task 3: Add cinematic sounds

**Files:**
- Modify: `src/lib/sounds.ts`

Add 6 new exported functions at the end of `sounds.ts`, before the closing. Each follows the existing pattern (try/catch, `getCtx()`, fire-and-forget oscillators/noise):

- [ ] **Step 1: Add `playWhistleShort()`**

Sharp single whistle blast for foul calls (penalty/free kick triggers). Sine at 3200Hz, quick attack, 0.15s duration.

```typescript
// ─── Battle: Short whistle — foul call ──────────────────────────────────────
export function playWhistleShort() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const osc = ac.createOscillator()
    const g = vol(ac)
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(3200, t)
    osc.frequency.linearRampToValueAtTime(2600, t + 0.12)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.start(t); osc.stop(t + 0.18)
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 2: Add `playTensionBuild()`**

Low rumble building tension for setup phases. Filtered noise with rising bandpass frequency.

```typescript
// ─── Battle: Tension build — rising rumble for cinematic setup ──────────────
export function playTensionBuild() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const src = ac.createBufferSource()
    src.buffer = noise(ac, 2.0)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 1.5
    bp.frequency.setValueAtTime(80, t)
    bp.frequency.exponentialRampToValueAtTime(400, t + 1.8)
    const g = vol(ac)
    src.connect(bp); bp.connect(g); g.connect(ac.destination)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12, t + 0.5)
    g.gain.linearRampToValueAtTime(0.25, t + 1.5)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.9)
    src.start(t); src.stop(t + 2.0)
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 3: Add `playKickImpact()`**

Short thud for the kick phase. Low-frequency sine burst.

```typescript
// ─── Battle: Kick impact — ball strike thud ─────────────────────────────────
export function playKickImpact() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const osc = ac.createOscillator()
    const g = vol(ac)
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.1)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.4, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.start(t); osc.stop(t + 0.18)
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 4: Add `playVarBeep()`**

Electronic beep sequence for VAR check. Three quick tones ascending.

```typescript
// ─── Battle: VAR beep — electronic check sequence ──────────────────────────
export function playVarBeep() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const freqs = [800, 1000, 1200]
    freqs.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const g = vol(ac)
      osc.connect(g); g.connect(ac.destination)
      osc.type = 'square'
      osc.frequency.value = freq
      const s = t + i * 0.15
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.08, s + 0.005)
      g.gain.setValueAtTime(0.08, s + 0.08)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.12)
      osc.start(s); osc.stop(s + 0.13)
    })
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 5: Add `playCrowdGroan()`**

Crowd disappointment for VAR disallowed. Low-pitched noise burst descending.

```typescript
// ─── Battle: Crowd groan — VAR disallowed / disappointment ─────────────────
export function playCrowdGroan() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const src = ac.createBufferSource()
    src.buffer = noise(ac, 0.8)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(600, t)
    bp.frequency.exponentialRampToValueAtTime(200, t + 0.6)
    bp.Q.value = 1.2
    const g = vol(ac)
    src.connect(bp); bp.connect(g); g.connect(ac.destination)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.25, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
    src.start(t); src.stop(t + 0.8)
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 6: Add `playSubstitution()`**

Short whistle + light applause for player swap.

```typescript
// ─── Battle: Substitution — whistle + applause ─────────────────────────────
export function playSubstitution() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // Quick whistle
    const osc = ac.createOscillator()
    const wg = vol(ac)
    osc.connect(wg); wg.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.value = 2800
    wg.gain.setValueAtTime(0, t)
    wg.gain.linearRampToValueAtTime(0.12, t + 0.01)
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.start(t); osc.stop(t + 0.12)

    // Light applause (high-passed noise)
    const clap = ac.createBufferSource()
    clap.buffer = noise(ac, 0.6)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 2500
    const cg = vol(ac)
    clap.connect(hp); hp.connect(cg); cg.connect(ac.destination)
    cg.gain.setValueAtTime(0, t + 0.1)
    cg.gain.linearRampToValueAtTime(0.08, t + 0.15)
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    clap.start(t + 0.1); clap.stop(t + 0.65)
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 7: Add `playCounterattackBuild()`**

Rising tempo percussion for fast break. Rapid filtered clicks accelerating.

```typescript
// ─── Battle: Counterattack — rising tempo clicks ────────────────────────────
export function playCounterattackBuild() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    // 6 clicks accelerating (intervals: 0.15, 0.12, 0.10, 0.08, 0.06)
    const offsets = [0, 0.15, 0.27, 0.37, 0.45, 0.51]
    offsets.forEach((off, i) => {
      const osc = ac.createOscillator()
      const g = vol(ac)
      osc.connect(g); g.connect(ac.destination)
      osc.type = 'sine'
      osc.frequency.value = 400 + i * 80
      const s = t + off
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.06 + i * 0.02, s + 0.003)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.06)
      osc.start(s); osc.stop(s + 0.07)
    })
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 8: Add `playCrowdRoar()`**

Crowd roar for VAR confirmed decisions. Similar to `playGoal()` crowd noise but without the whistle — pure celebration.

```typescript
// ─── Battle: Crowd roar — VAR confirmed / celebration ──────────────────────
export function playCrowdRoar() {
  try {
    const ac = getCtx()
    const t = ac.currentTime
    const src = ac.createBufferSource()
    src.buffer = noise(ac, 1.2)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8
    const g = vol(ac)
    src.connect(bp); bp.connect(g); g.connect(ac.destination)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.3, t + 0.05)
    g.gain.setValueAtTime(0.3, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1)
    src.start(t); src.stop(t + 1.2)
  } catch { /* audio blocked */ }
}
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/sounds.ts
git commit -m "feat(battle): add 8 cinematic sound effects for penalties, VAR, subs, etc."
```

---

### Task 4: Add auto-bench picker and engine cinematic events

**Files:**
- Modify: `src/lib/battleEngine.ts`

This is the largest task. It modifies `simulateMatch()` to generate cinematic lead-in events, corner events, VAR reviews, and handle substitutions.

- [ ] **Step 1: Add imports and phase data constants**

At the top of `battleEngine.ts`, add imports for `playerRating` and `MatchEventPhase`. Add phase template constants:

```typescript
import { buildPlayerStats, calcRating } from './playerRating'
import type { MatchEventPhase } from '../types'

// ─── Cinematic phase templates ──────────────────────────────────────────────

const PENALTY_PHASES: MatchEventPhase[] = [
  { phase: 'foul', duration: 0.8 },
  { phase: 'whistle', duration: 0.5 },
  { phase: 'player_walks_to_spot', duration: 1.5 },
  { phase: 'keeper_ready', duration: 0.8 },
  { phase: 'kick', duration: 0.5 },
  { phase: 'outcome', duration: 1.0 },
]

const FREE_KICK_PHASES: MatchEventPhase[] = [
  { phase: 'foul', duration: 0.8 },
  { phase: 'wall_lines_up', duration: 1.2 },
  { phase: 'run_up', duration: 1.0 },
  { phase: 'kick', duration: 0.5 },
  { phase: 'outcome', duration: 1.0 },
]

const CORNER_PHASES: MatchEventPhase[] = [
  { phase: 'ball_out', duration: 0.5 },
  { phase: 'corner_setup', duration: 1.0 },
  { phase: 'cross', duration: 0.8 },
  { phase: 'header', duration: 0.5 },
  { phase: 'outcome', duration: 1.0 },
]

const COUNTERATTACK_PHASES: MatchEventPhase[] = [
  { phase: 'interception', duration: 0.5 },
  { phase: 'pass_1', duration: 0.8 },
  { phase: 'pass_2', duration: 0.8 },
  { phase: 'shot', duration: 0.5 },
  { phase: 'outcome', duration: 1.0 },
]

const VAR_REVIEW_PHASES: MatchEventPhase[] = [
  { phase: 'celebration_pause', duration: 1.5 },
  { phase: 'var_check', duration: 2.0 },
  { phase: 'decision', duration: 1.5 },
]
```

- [ ] **Step 2: Add cinematic goal description arrays**

Below the existing description arrays, add:

```typescript
const PENALTY_DESCRIPTIONS = [
  'Фол у штрафному!', 'Пенальті! Контакт у штрафному!',
  'Суддя показує на точку!', 'Пенальті після перегляду!',
]

const FREE_KICK_DESCRIPTIONS = [
  'Небезпечний штрафний!', 'Штрафний з гарної позиції!',
  'Штрафний біля штрафного!', 'Фол на підступах!',
]

const CORNER_DESCRIPTIONS = [
  'Кутовий удар!', 'Подача з кутового!',
  'Небезпечний кутовий!', 'Кутовий, м\'яч летить у штрафну!',
]

const COUNTERATTACK_DESCRIPTIONS = [
  'Контратака!', 'Швидкий вихід!',
  'Перехоплення та контратака!', 'Небезпечний вихід 3 на 2!',
]

const VAR_CONFIRMED_DESCRIPTIONS = [
  'VAR підтверджує — ГОЛ!', 'Після перегляду — гол зараховано!',
]

const VAR_DISALLOWED_DESCRIPTIONS = [
  'VAR скасовує гол! Офсайд!', 'Гол не зараховано після перегляду!',
  'VAR: фол в атаці, гол скасовано!',
]
```

- [ ] **Step 3: Add `pickAutoBench()` function**

Add before `simulateMatch()`. This picks up to 3 bench players from a collection:

```typescript
import { playerOverall, footballerMap } from '../data/footballers'
import type { Footballer } from '../types'

/** Auto-pick up to 3 bench players from collection, excluding starting 11 and GKs */
export function pickAutoBench(
  collection: string[],
  startingSquad: string[],
): string[] {
  const startingSet = new Set(startingSquad)
  const available = collection
    .filter(id => !startingSet.has(id))
    .map(id => footballerMap.get(id))
    .filter((p): p is Footballer => !!p && p.position !== 'GK')
    .sort((a, b) => playerOverall(b) - playerOverall(a))

  const bench: string[] = []
  const positions: Array<'DEF' | 'MID' | 'FWD'> = ['DEF', 'MID', 'FWD']

  // One per position category
  for (const pos of positions) {
    const pick = available.find(p => p.position === pos && !bench.includes(p.id))
    if (pick) bench.push(pick.id)
  }

  // If we couldn't fill all 3, fill from remaining best
  if (bench.length < 3) {
    for (const p of available) {
      if (bench.length >= 3) break
      if (!bench.includes(p.id)) bench.push(p.id)
    }
  }

  return bench.slice(0, 3)
}
```

- [ ] **Step 4: Modify goal generation to roll cinematic type**

Inside `simulateMatch()`, where the current goal event is created (the `// ── Goal ──` block), wrap it with cinematic type selection. When a goal minute is reached:

1. Roll `rng.next()` to pick: regular (0-0.50), penalty (0.50-0.65), free_kick (0.65-0.85), counterattack (0.85-1.0).
2. For cinematic types, emit a lead-in event (with `phases`) first, then the canonical `goal` event.
3. For regular goals, keep current behavior unchanged.

The lead-in event uses the same `minute`, `team`, and `playerId` as the goal that follows.

- [ ] **Step 5: Add corner events to flavor pool**

Pre-roll 2-3 corner minutes using `rng.int(2, 3)` and add them to `flavorMinuteSet` (remove any that collide with goal minutes). In the flavor event processing block, add a probability band: if `roll < 0.10` → corner event.

Corner scoring algorithm:

```typescript
// Inside the flavor event block, when roll < 0.10 (corner):
const canScore = rng.chance(0.15)
const nextGoalIdx = goalMinutes.findIndex((gm, i) => i >= goalIdx && gm > minute)

if (canScore && nextGoalIdx >= 0) {
  // Corner scores — replace the nearest future budgeted goal
  goalMinutes.splice(nextGoalIdx, 1)  // remove that goal from budget
  // Pick a header scorer — DEF or FWD preferred for headers
  const headerCandidates = onField.filter(p => p.position === 'DEF' || p.position === 'FWD')
  const scorer = rng.pick(headerCandidates.length > 0 ? headerCandidates : onField)
  // Emit corner lead-in
  events.push({
    minute, type: 'corner', team, playerId: scorer?.id ?? '',
    description: rng.pick(CORNER_DESCRIPTIONS),
    phases: CORNER_PHASES,
  })
  // Emit canonical goal
  events.push({
    minute, type: 'goal', team, playerId: scorer?.id ?? '',
    description: 'Гол головою з кутового!',
  })
  if (team === 'home') scoreHome++; else scoreAway++
} else {
  // Corner doesn't score — save or cleared
  const outcomeRoll = rng.next()
  const outcomeType = outcomeRoll < 0.5 ? 'great_save' : 'near_miss'
  events.push({
    minute, type: 'corner', team, playerId: anyPlayer.id,
    description: rng.pick(CORNER_DESCRIPTIONS),
    phases: CORNER_PHASES,
  })
  events.push({
    minute, type: outcomeType, team,
    playerId: outcomeType === 'great_save' ? /* opponent GK */ : anyPlayer.id,
    description: outcomeType === 'great_save' ? rng.pick(GREAT_SAVE_DESCRIPTIONS) : rng.pick(NEAR_MISS_DESCRIPTIONS),
  })
}
```

Note: Since `goalMinutes.splice()` modifies the array in place, and `goalIdx` tracks the current position via sequential checking (`goalMinutes[goalIdx] === minute`), removing a future element won't affect past or current indexing.

- [ ] **Step 6: Add VAR review post-goal**

After every goal event is emitted (including cinematic goals), roll `rng.chance(0.10)`. If true:
- Roll `rng.chance(0.7)` for confirmed vs disallowed.
- Emit a `var_review` event on the same minute with `phases: VAR_REVIEW_PHASES`.
- If disallowed: decrement the appropriate score variable (`scoreHome` or `scoreAway`).

- [ ] **Step 7: Add halftime substitution logic**

After minute 45 events are processed, before continuing to minute 46:

1. For each team (home, away): collect events from minutes 1-45, call `buildPlayerStats()`. Build a form-roll lookup: `const formMap = new Map(players.map((p, i) => [p?.id ?? '', formRolls[i]]))`. Then call `calcRating(playerId, stats, formMap.get(playerId))` for each player.
2. Find the 2 lowest-rated outfield players (not GK). If still tied after formRoll inclusion, broken by `rng.pick()`.
3. For each, find a bench player matching their position. If no match, pick best available.
4. Emit `substitution` events: `playerId` = leaving player, `subInPlayerId` = entering player, minute = 46. (Subs are announced at halftime but take effect from minute 46 — the start of the second half.)
5. Update internal tracking: remove subbed-out from eligible players, add subbed-in.
6. Consume used bench players so they can't be used again.

Note: Post-match UI ratings in `MatchLive.tsx` don't have access to `formRolls`, so players with no events will display the base 6.5 rating. This is acceptable — the formRoll tiebreaker is only needed for halftime sub decisions in the engine.

- [ ] **Step 8: Add red card substitution logic**

When a red card event is generated (in the flavor events section):

1. After emitting the red card, check if bench has available players.
2. If yes, pick a bench player matching the sent-off player's position.
3. Emit a `substitution` event on `minute + 1` (next minute the sub arrives).
4. Track consumed bench slots.
5. **Important**: The sub-in player must NOT be added to the eligible player pool until `minute + 1`. Maintain a `pendingSubs` map: `Map<number, { team, playerId }>` keyed by the minute the sub arrives. At the start of each minute's processing, check `pendingSubs` for arrivals and add those players to the eligible set. This ensures the team plays with 10 for the remainder of the red card minute.

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: PASS (may show errors in `useBattle.ts` where `bench` isn't provided yet — that's Task 5).

- [ ] **Step 10: Commit**

```bash
git add src/lib/battleEngine.ts
git commit -m "feat(battle): add cinematic goal types, corners, VAR, auto-bench, and substitutions to engine"
```

---

### Task 5: Update `useBattle.ts` to compute bench

**Files:**
- Modify: `src/hooks/useBattle.ts:72-81`

- [ ] **Step 1: Update `buildMySnapshot()` to include bench**

Import `pickAutoBench` from `battleEngine.ts`. In `buildMySnapshot()`, compute bench from the user's collection:

```typescript
import { pickAutoBench } from '../lib/battleEngine'

function buildMySnapshot(): SquadSnapshot {
  const s = state()
  const squadIds = s.squad.filter((id): id is string => id !== null)
  return {
    squad: squadIds,
    formation: s.formation,
    coachId: s.assignedCoach ?? '',
    coachLevel: s.assignedCoach ? (s.coachCollection[s.assignedCoach] ?? 1) : 1,
    maxHabitStreak: Math.max(0, ...s.habits.map(h => h.streak)),
    bench: pickAutoBench(Object.keys(s.collection), squadIds),
  }
}
```

- [ ] **Step 2: Update opponent snapshot resolution in `acceptChallengeAndSimulate`**

The challenger's snapshot already has `bench` (computed at challenge-send time). For the opponent (the one accepting), `buildMySnapshot()` now includes `bench`. No additional changes needed here — just verify that the challenger's stored snapshot from Supabase will have `bench: undefined` for old challenges, and the engine handles `snap.bench ?? []`.

- [ ] **Step 3: Add defensive `bench` fallback in engine**

In `battleEngine.ts`, anywhere bench is accessed, use `snap.bench ?? []` to handle old snapshots without bench data.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS — all `SquadSnapshot` construction sites now provide `bench`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBattle.ts src/lib/battleEngine.ts
git commit -m "feat(battle): compute auto-bench in squad snapshot and handle backwards compat"
```

---

### Task 6: Create `CinematicOverlay` component

**Files:**
- Create: `src/components/battle/CinematicOverlay.tsx`

- [ ] **Step 1: Create the component file**

The overlay receives the current cinematic event, current phase index, and renders the appropriate animation on top of the pitch. It controls ball position during cinematics.

```typescript
import { motion, AnimatePresence } from 'framer-motion'
import type { MatchEvent } from '../../types'
import { footballerMap } from '../../data/footballers'

interface Props {
  event: MatchEvent | null       // the cinematic lead-in event currently playing
  phaseIndex: number              // which phase we're on (0-based)
  onPhaseComplete: () => void     // called when current phase duration expires
}
```

Component structure:
- Renders `null` when `event` is `null`.
- Switches on `event.type` to render the correct overlay variant.
- Each variant is a Framer Motion `AnimatePresence` sequence.
- Uses `useEffect` with a timer based on `event.phases[phaseIndex].duration` to call `onPhaseComplete`.

- [ ] **Step 2: Implement penalty overlay**

- **foul phase**: Red flash at bottom, text "ПЕНАЛЬТІ!" centered.
- **whistle phase**: Whistle icon pulses.
- **player_walks_to_spot phase**: Pitch CSS zoom toward penalty area (right or left depending on `event.team`). Scale up to 1.5x with transform-origin at the penalty spot.
- **keeper_ready phase**: Keeper area highlighted with pulsing border.
- **kick phase**: Ball trajectory line drawn from spot to corner.
- **outcome phase**: Net ripple (green flash) or diving save (red flash).

All implemented as Framer Motion `motion.div` overlays with absolute positioning inside the pitch container.

- [ ] **Step 3: Implement free kick overlay**

- **foul phase**: Yellow flash, "ШТРАФНИЙ!" text.
- **wall_lines_up phase**: 3-4 dots appear in a line near the goal.
- **run_up phase**: Dotted arc path starts drawing from ball position.
- **kick phase**: Ball follows the arc path quickly.
- **outcome phase**: Same as penalty outcome.

- [ ] **Step 4: Implement corner overlay**

- **ball_out phase**: Ball icon moves to corner flag position.
- **corner_setup phase**: Arc path from corner to box area.
- **cross phase**: Ball follows arc.
- **header phase**: Impact indicator at near/far post.
- **outcome phase**: Goal flash or clearance.

- [ ] **Step 5: Implement counterattack overlay**

- **interception phase**: Flash at midfield.
- **pass_1 / pass_2 phases**: Dashed lines drawn between player positions rapidly.
- **shot phase**: Ball moves to goal area.
- **outcome phase**: Goal flash or save.

- [ ] **Step 6: Implement VAR overlay**

- **celebration_pause phase**: Blue tint overlay appears over the pitch, "VAR" text with monitor icon.
- **var_check phase**: Horizontal lines scan effect (like a screen). "ПЕРЕВІРКА..." text pulses.
- **decision phase**: Green banner "ГОЛ ЗАРАХОВАНО!" or red banner "ГОЛ СКАСОВАНО!" depending on `event.varOutcome`.

- [ ] **Step 7: Add sound triggers per phase**

Import sounds and trigger them at phase transitions:
- `foul` / `whistle` phases → `playWhistleShort()`
- `player_walks_to_spot` / `wall_lines_up` / `corner_setup` → `playTensionBuild()`
- `kick` / `shot` / `header` → `playKickImpact()`
- `var_check` → `playVarBeep()`
- `decision` (confirmed) → `playCrowdRoar()`
- `decision` (disallowed) → `playCrowdGroan()`
- `interception` → `playCounterattackBuild()`
- `cross` → (no sound, visual only)

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/battle/CinematicOverlay.tsx
git commit -m "feat(battle): add CinematicOverlay component with penalty, free kick, corner, counterattack, VAR animations"
```

---

### Task 7: Integrate phase machine into `MatchLive.tsx`

**Files:**
- Modify: `src/components/battle/MatchLive.tsx`

This is the UI integration task — connecting the cinematic engine events to the phase machine and overlay.

- [ ] **Step 1: Add cinematic state tracking**

Add state variables to `MatchLive`:

```typescript
const [cinematicEvent, setCinematicEvent] = useState<MatchEvent | null>(null)
const [cinematicPhaseIndex, setCinematicPhaseIndex] = useState(0)
const [cinematicQueue, setCinematicQueue] = useState<MatchEvent[]>([])
```

Define which event types are cinematic:

```typescript
const CINEMATIC_TYPES = new Set(['penalty', 'free_kick', 'corner', 'counterattack', 'var_review'])
```

- [ ] **Step 2: Modify event processing to queue cinematics**

In the `useEffect` that processes `currentMinute` events, split events into cinematic and non-cinematic:

- Non-cinematic events (goal, yellow_card, etc.) process immediately as before.
- Cinematic events get added to `cinematicQueue`.
- When cinematicQueue has items and no cinematic is currently playing, pop the first and set it as `cinematicEvent`.

- [ ] **Step 3: Freeze timer during cinematics**

In the `useEffect` that advances the timer, add a guard:

```typescript
if (cinematicEvent) return  // don't advance time during cinematic
```

- [ ] **Step 4: Handle phase advancement**

When `CinematicOverlay` calls `onPhaseComplete`:

1. Increment `cinematicPhaseIndex`.
2. If we've reached the end of `cinematicEvent.phases`, clear `cinematicEvent` and check the queue for the next cinematic.
3. If queue is empty, resume normal timer.

- [ ] **Step 5: Handle VAR score decrement**

When processing a `var_review` event with `varOutcome === 'disallowed'`:

```typescript
if (ev.team === 'home') setScoreHome(s => s - 1)
else setScoreAway(s => s - 1)
```

- [ ] **Step 6: Add phase-by-phase commentary**

During cinematic events, append commentary lines per phase. Use phase descriptions in Ukrainian:

```typescript
const PHASE_COMMENTARY: Record<string, Record<string, string>> = {
  penalty: {
    foul: '🔴 Фол у штрафному! Пенальті!',
    player_walks_to_spot: '⏳ {player} підходить до м\'яча...',
    keeper_ready: '🧤 Воротар готується...',
    kick: '⚡ Удар!',
  },
  free_kick: {
    foul: '🔴 Фол! Штрафний удар!',
    wall_lines_up: '🧱 Стінка шикується...',
    run_up: '⏳ {player} розбігається...',
    kick: '⚡ Удар!',
  },
  corner: {
    ball_out: '🚩 М\'яч за лінією! Кутовий!',
    corner_setup: '⏳ Подача з кутового...',
    cross: '↗️ Навіс у штрафну!',
    header: '💥 Удар головою!',
  },
  counterattack: {
    interception: '⚡ Перехоплення!',
    pass_1: '➡️ Пас вперед!',
    pass_2: '➡️ Ще один пас! Вихід на ворота!',
    shot: '💥 Удар!',
  },
  var_review: {
    celebration_pause: '📺 Зачекайте... VAR перевіряє момент!',
    var_check: '🔍 Перегляд відеоповтору...',
    // decision phase uses varOutcome to pick text dynamically
  },
}
```

Replace `{player}` with the actual player name. Append to `visibleEvents` as commentary-only entries (or add to a separate commentary state for phase-level lines).

- [ ] **Step 7: Add substitution event rendering in event feed**

Add substitution to `EVENT_ICONS`:

```typescript
substitution: '🔄',
```

In the event feed rendering, handle `substitution` type:

```typescript
case 'substitution':
  return (
    <>
      <span className="text-red-400">↓ {getPlayerName(ev.playerId)}</span>
      {' '}
      <span className="text-[#00E676]">↑ {getPlayerName(ev.subInPlayerId ?? '')}</span>
    </>
  )
```

- [ ] **Step 8: Render `CinematicOverlay` on the pitch**

Add import at top of `MatchLive.tsx`:

```typescript
import { CinematicOverlay } from './CinematicOverlay'
```

Render inside the `MatchPitch` component (or as a sibling overlay):

```tsx
<CinematicOverlay
  event={cinematicEvent}
  phaseIndex={cinematicPhaseIndex}
  onPhaseComplete={handlePhaseComplete}
/>
```

During cinematics, hide the normal ball (already hidden when `cinematicEvent` is set).

- [ ] **Step 9: Update `PostMatchLineup` with bench section**

Update `PostMatchLineup` props to include bench and events:

```typescript
function PostMatchLineup({
  title, titleColor, squadIds, formation, playerStats,
  bench,       // NEW — string[] of bench player IDs (may be undefined for old matches)
  matchEvents, // NEW — MatchEvent[] for parsing substitution events
}: {
  title: string
  titleColor: string
  squadIds: string[]
  formation: string
  playerStats: Record<string, PlayerMatchStats>
  bench?: string[]
  matchEvents?: MatchEvent[]
})
```

After the starting 11 list, add a "Лава" (Bench) section:

- Parse `substitution` events from `matchEvents` to build a map: `subOutMap: Map<playerId, minute>` and `subInMap: Map<playerId, minute>`.
- Starting players who were subbed out: show dimmed with "↓ {minute}'".
- Bench players who entered: show with "↑ {minute}'" and green "SUB" tag.
- Bench players who never entered: show greyed out with `opacity-40`.
- If `bench` is undefined (old match), skip the bench section entirely.

Access bench from `match.challengerSquad.bench` and `match.challengedSquad.bench`.

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 11: Visual verification**

Run: `npm run dev`
- Navigate to Friends → accept a challenge (or create a test match).
- Verify: cinematic events play with overlay animations and paused timer.
- Verify: commentary updates phase-by-phase.
- Verify: substitution events appear at halftime and after red cards.
- Verify: VAR reviews show with correct outcome (confirmed/disallowed + score adjustment).
- Verify: post-match lineups show bench section with sub indicators.
- Verify: old matches without cinematic data still render correctly.

- [ ] **Step 12: Commit**

```bash
git add src/components/battle/MatchLive.tsx
git commit -m "feat(battle): integrate phase machine, cinematic overlay, subs, and VAR into MatchLive"
```

---

### Task 8: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, no errors or warnings.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: End-to-end manual test**

Run: `npm run dev` and test:

1. **New match**: Send and accept a challenge. Watch the full match. Verify:
   - At least some goals have cinematic lead-ins (penalty/free kick/counterattack).
   - Corners appear as flavor events.
   - ~10% of goals trigger VAR review.
   - Halftime shows substitution summary.
   - Post-match lineup shows bench with sub indicators.
   - All sounds play correctly.
   - Match timer freezes during cinematics and resumes after.

2. **Old match replay**: View an existing match from history. Verify it renders without errors (backwards compat — no phases, no bench).

3. **Edge cases**:
   - Match with 0 goals (no cinematics expected, no VAR).
   - Match with a red card → verify substitution fires.
   - Match where VAR disallows a goal → score decrements correctly.

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(battle): polish cinematic battles integration"
```
