# Coaches Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 21 collectible football coaches as a new gacha layer — coach pack in Shop, perk system affecting habit coins and player stats, coach slot on Team page, coaches tab in Collection, and 6 new achievements.

**Architecture:** `Coach` is a fully separate entity from `Footballer`. Coach perks are computed at runtime (base data never mutated). PackOpening handles both footballer and coach packs via a discriminated union on location state. Coach habit bonuses are applied in `completeHabit` after the squad bonus calculation.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, Framer Motion, Vite (`npm run build` = type check + bundle)

---

### Task 1: Extend types

**Files:**
- Modify: `src/types.ts`

**Step 1: Add Coach types after existing types**

Append to `src/types.ts` (after `AppState`):

```typescript
export type CoachPerkType =
  | 'all_habit_pct'       // % bonus to all habit coins
  | 'streak_gte_flat'     // flat coins if habit.streak >= minStreak
  | 'streak_range_pct'    // % bonus if habit.streak in [minStreak, maxStreak]
  | 'all_done_flat'       // flat bonus when completing the last habit of the day
  | 'all_done_pct'        // % bonus when completing the last habit of the day
  | 'daily_count_pct'     // % bonus if N+ habits completed today (including this one)
  | 'habit_streak_flat'   // flat bonus if habit.streak >= minStreak (loyalty)
  | 'before_noon_pct'     // % bonus if completing before noon local time
  | 'active_habits_flat'  // flat bonus if total habit count >= minHabits
  | 'squad_full_pct'      // % bonus if squad has all 11 slots filled
  | 'squad_min_pct'       // % bonus if squad has >= minPlayers filled
  | 'stat_boost'          // boost a player stat at render time (no coin effect)

export interface CoachPerk {
  type: CoachPerkType
  values: [number, number, number]   // [level1, level2, level3]
  minStreak?: number
  maxStreak?: number
  minCount?: number
  minHabits?: number
  minPlayers?: number
  stat?: 'pace' | 'shooting' | 'passing' | 'dribbling'
  position?: Position
  rarityFilter?: Rarity
  descUA: [string, string, string]   // Ukrainian description per level
}

export interface Coach {
  id: string
  name: string
  nationality: string
  clubs: string[]     // clubs coached (match against footballer.club for chemistry)
  photoUrl?: string
  emoji: string
  perk: CoachPerk
}

export interface CoachPackDef {
  id: 'coach'
  name: string
  cost: number
  emoji: string
}
```

**Step 2: Add `coachCollection` and `assignedCoach` to `AppState`**

```typescript
export interface AppState {
  // ... existing fields ...
  coachCollection: Record<string, number>   // coachId → copies owned
  assignedCoach: string | null
}
```

**Step 3: Verify**

```bash
npm run build
```
Expected: zero new TypeScript errors.

**Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Coach, CoachPerk, CoachPackDef types and extend AppState"
```

---

### Task 2: Coach perk logic

**Files:**
- Create: `src/lib/coachPerks.ts`

**Step 1: Create the file**

```typescript
import type { Coach, Footballer } from '../types'
import type { AppState } from '../types'
import { isCompletedToday } from './streaks'
import { coaches } from '../data/coaches'

export function getCoachLevel(coachId: string, coachCollection: Record<string, number>): number {
  return Math.min(coachCollection[coachId] ?? 0, 3)
}

export function getAssignedCoach(state: Pick<AppState, 'assignedCoach'>): Coach | null {
  if (!state.assignedCoach) return null
  return coaches.find(c => c.id === state.assignedCoach) ?? null
}

/**
 * Returns extra coins earned from the coach habit perk.
 * Called in completeHabit after baseEarned is computed (streak × squad bonus).
 * state is the state BEFORE this habit is committed to storage.
 */
export function computeCoachHabitBonus(
  state: AppState,
  habitId: string,
  baseEarned: number,
  newStreak: number,
): number {
  if (!state.assignedCoach) return 0
  const coach = getAssignedCoach(state)
  if (!coach) return 0
  const level = getCoachLevel(coach.id, state.coachCollection)
  if (level === 0) return 0

  const perk = coach.perk
  const value = perk.values[level - 1]

  switch (perk.type) {
    case 'all_habit_pct':
      return Math.round(baseEarned * value / 100)

    case 'streak_gte_flat':
    case 'habit_streak_flat':
      return newStreak >= (perk.minStreak ?? 0) ? value : 0

    case 'streak_range_pct':
      return newStreak >= (perk.minStreak ?? 0) && newStreak <= (perk.maxStreak ?? Infinity)
        ? Math.round(baseEarned * value / 100)
        : 0

    case 'all_done_flat': {
      const others = state.habits.filter(h => h.id !== habitId)
      return others.every(h => isCompletedToday(h.lastCompleted)) ? value : 0
    }

    case 'all_done_pct': {
      const others = state.habits.filter(h => h.id !== habitId)
      return others.every(h => isCompletedToday(h.lastCompleted))
        ? Math.round(baseEarned * value / 100)
        : 0
    }

    case 'daily_count_pct': {
      const doneToday = state.habits.filter(h => isCompletedToday(h.lastCompleted)).length + 1
      return doneToday >= (perk.minCount ?? 0) ? Math.round(baseEarned * value / 100) : 0
    }

    case 'before_noon_pct':
      return new Date().getHours() < 12 ? Math.round(baseEarned * value / 100) : 0

    case 'active_habits_flat':
      return state.habits.length >= (perk.minHabits ?? 0) ? value : 0

    case 'squad_full_pct':
      return state.squad.filter(Boolean).length === 11
        ? Math.round(baseEarned * value / 100)
        : 0

    case 'squad_min_pct':
      return state.squad.filter(Boolean).length >= (perk.minPlayers ?? 0)
        ? Math.round(baseEarned * value / 100)
        : 0

    case 'stat_boost':
      return 0

    default:
      return 0
  }
}

/**
 * Apply coach stat boost to a footballer at render time.
 * Returns a new Footballer object — never mutates base data.
 */
export function applyCoachStatBoost(footballer: Footballer, state: AppState): Footballer {
  if (!state.assignedCoach) return footballer
  const coach = getAssignedCoach(state)
  if (!coach || coach.perk.type !== 'stat_boost') return footballer
  const level = getCoachLevel(coach.id, state.coachCollection)
  if (level === 0) return footballer

  const { stat, position, rarityFilter, values } = coach.perk
  if (!stat) return footballer
  if (position && footballer.position !== position) return footballer
  if (rarityFilter && footballer.rarity !== rarityFilter) return footballer

  const boost = values[level - 1]
  return {
    ...footballer,
    stats: { ...footballer.stats, [stat]: Math.min(99, footballer.stats[stat] + boost) },
  }
}

/**
 * Returns the chemistry % bonus from the coach (5% per squad player from coach's clubs).
 */
export function computeCoachChemistryPct(
  coach: Coach,
  squadFootballers: Array<{ club: string }>,
): number {
  return squadFootballers.filter(f => coach.clubs.includes(f.club)).length * 5
}
```

**Step 2: Verify (will fail — `coaches` import doesn't exist yet, that's OK)**

```bash
npm run build 2>&1 | grep "coachPerks"
```
Expected: error about missing `../data/coaches` module — that's expected. Will be fixed in Task 3.

**Step 3: Commit**

```bash
git add src/lib/coachPerks.ts
git commit -m "feat: add coach perk computation logic"
```

---

### Task 3: Coach data + photos

**Files:**
- Create: `src/data/coaches.ts`
- Create: `public/coaches/` (directory + photos)

**Step 1: Create `src/data/coaches.ts` with all 21 coaches**

Club names must exactly match `footballer.club` values from `footballers.ts`:
`'Barcelona'`, `'Bayern Munich'`, `'Man City'`, `'Liverpool'`, `'Real Madrid'`, `'Chelsea'`, `'Paris SG'`, `'Inter Milan'`, `'Atletico Madrid'`, `'Juventus'`, `'AC Milan'`, `'Tottenham'`, `'Arsenal'`, `'Napoli'`, `'Man United'`, `'Aston Villa'`, `'Everton'`, `'Lazio'`

```typescript
import type { Coach } from '../types'

export const coaches: Coach[] = [
  {
    id: 'guardiola',
    name: 'Pep Guardiola',
    nationality: 'Spain',
    clubs: ['Barcelona', 'Bayern Munich', 'Man City'],
    photoUrl: '/coaches/guardiola.png',
    emoji: '🧠',
    perk: {
      type: 'stat_boost',
      stat: 'passing',
      position: 'MID',
      values: [5, 8, 12],
      descUA: [
        '+5 до паса для всіх ПЗА',
        '+8 до паса для всіх ПЗА',
        '+12 до паса для всіх ПЗА',
      ],
    },
  },
  {
    id: 'klopp',
    name: 'Jürgen Klopp',
    nationality: 'Germany',
    clubs: ['Dortmund', 'Liverpool'],
    photoUrl: '/coaches/klopp.png',
    emoji: '😁',
    perk: {
      type: 'stat_boost',
      stat: 'pace',
      values: [4, 6, 10],
      descUA: [
        '+4 до швидкості для всіх гравців',
        '+6 до швидкості для всіх гравців',
        '+10 до швидкості для всіх гравців',
      ],
    },
  },
  {
    id: 'ancelotti',
    name: 'Carlo Ancelotti',
    nationality: 'Italy',
    clubs: ['AC Milan', 'Chelsea', 'Real Madrid', 'Bayern Munich', 'Napoli', 'Everton'],
    photoUrl: '/coaches/ancelotti.png',
    emoji: '😌',
    perk: {
      type: 'all_habit_pct',
      values: [8, 15, 25],
      descUA: [
        '+8% до всіх монет за звички',
        '+15% до всіх монет за звички',
        '+25% до всіх монет за звички',
      ],
    },
  },
  {
    id: 'ferguson',
    name: 'Sir Alex Ferguson',
    nationality: 'Scotland',
    clubs: ['Man United'],
    photoUrl: '/coaches/ferguson.png',
    emoji: '🏆',
    perk: {
      type: 'streak_gte_flat',
      minStreak: 7,
      values: [10, 20, 35],
      descUA: [
        '+10 монет за звичку із серією ≥7 днів',
        '+20 монет за звичку із серією ≥7 днів',
        '+35 монет за звичку із серією ≥7 днів',
      ],
    },
  },
  {
    id: 'mourinho',
    name: 'José Mourinho',
    nationality: 'Portugal',
    clubs: ['Porto', 'Chelsea', 'Inter Milan', 'Real Madrid', 'Man United', 'Tottenham', 'Roma'],
    photoUrl: '/coaches/mourinho.png',
    emoji: '😏',
    perk: {
      type: 'all_done_flat',
      values: [25, 45, 70],
      descUA: [
        '+25 монет коли виконав ВСІ звички за день',
        '+45 монет коли виконав ВСІ звички за день',
        '+70 монет коли виконав ВСІ звички за день',
      ],
    },
  },
  {
    id: 'simeone',
    name: 'Diego Simeone',
    nationality: 'Argentina',
    clubs: ['Atletico Madrid'],
    photoUrl: '/coaches/simeone.png',
    emoji: '😤',
    perk: {
      type: 'streak_range_pct',
      minStreak: 1,
      maxStreak: 3,
      values: [10, 18, 28],
      descUA: [
        '+10% монет за звичку із серією 1–3 дні',
        '+18% монет за звичку із серією 1–3 дні',
        '+28% монет за звичку із серією 1–3 дні',
      ],
    },
  },
  {
    id: 'conte',
    name: 'Antonio Conte',
    nationality: 'Italy',
    clubs: ['Juventus', 'Chelsea', 'Inter Milan', 'Tottenham', 'Napoli'],
    photoUrl: '/coaches/conte.png',
    emoji: '😠',
    perk: {
      type: 'streak_gte_flat',
      minStreak: 3,
      values: [8, 15, 25],
      descUA: [
        '+8 монет за звичку із серією ≥3 дні',
        '+15 монет за звичку із серією ≥3 дні',
        '+25 монет за звичку із серією ≥3 дні',
      ],
    },
  },
  {
    id: 'tuchel',
    name: 'Thomas Tuchel',
    nationality: 'Germany',
    clubs: ['Dortmund', 'Paris SG', 'Chelsea', 'Bayern Munich'],
    photoUrl: '/coaches/tuchel.png',
    emoji: '🤔',
    perk: {
      type: 'daily_count_pct',
      minCount: 3,
      values: [10, 18, 28],
      descUA: [
        '+10% монет якщо виконав 3+ звички сьогодні',
        '+18% монет якщо виконав 3+ звички сьогодні',
        '+28% монет якщо виконав 3+ звички сьогодні',
      ],
    },
  },
  {
    id: 'zidane',
    name: 'Zinedine Zidane',
    nationality: 'France',
    clubs: ['Real Madrid'],
    photoUrl: '/coaches/zidane.png',
    emoji: '⭐',
    perk: {
      type: 'stat_boost',
      stat: 'dribbling',
      rarityFilter: 'legendary',
      values: [5, 8, 12],
      descUA: [
        '+5 до дриблінгу для легендарних гравців',
        '+8 до дриблінгу для легендарних гравців',
        '+12 до дриблінгу для легендарних гравців',
      ],
    },
  },
  {
    id: 'luisenrique',
    name: 'Luis Enrique',
    nationality: 'Spain',
    clubs: ['Barcelona', 'Paris SG'],
    photoUrl: '/coaches/luisenrique.png',
    emoji: '⚡',
    perk: {
      type: 'all_done_pct',
      values: [12, 22, 35],
      descUA: [
        '+12% монет якщо виконав ВСІ звички за день',
        '+22% монет якщо виконав ВСІ звички за день',
        '+35% монет якщо виконав ВСІ звички за день',
      ],
    },
  },
  {
    id: 'xavi',
    name: 'Xavi Hernandez',
    nationality: 'Spain',
    clubs: ['Barcelona'],
    photoUrl: '/coaches/xavi.png',
    emoji: '🔵',
    perk: {
      type: 'stat_boost',
      stat: 'passing',
      position: 'MID',
      values: [6, 10, 15],
      descUA: [
        '+6 до паса для всіх ПЗА',
        '+10 до паса для всіх ПЗА',
        '+15 до паса для всіх ПЗА',
      ],
    },
  },
  {
    id: 'arteta',
    name: 'Mikel Arteta',
    nationality: 'Spain',
    clubs: ['Arsenal'],
    photoUrl: '/coaches/arteta.png',
    emoji: '🎯',
    perk: {
      type: 'streak_gte_flat',
      minStreak: 2,
      values: [8, 15, 25],
      descUA: [
        '+8 монет за звичку із серією ≥2 дні',
        '+15 монет за звичку із серією ≥2 дні',
        '+25 монет за звичку із серією ≥2 дні',
      ],
    },
  },
  {
    id: 'wenger',
    name: 'Arsène Wenger',
    nationality: 'France',
    clubs: ['Arsenal'],
    photoUrl: '/coaches/wenger.png',
    emoji: '📚',
    perk: {
      type: 'habit_streak_flat',
      minStreak: 7,
      values: [10, 18, 30],
      descUA: [
        '+10 монет за звичку із серією ≥7 днів (вірність)',
        '+18 монет за звичку із серією ≥7 днів (вірність)',
        '+30 монет за звичку із серією ≥7 днів (вірність)',
      ],
    },
  },
  {
    id: 'flick',
    name: 'Hansi Flick',
    nationality: 'Germany',
    clubs: ['Bayern Munich', 'Barcelona'],
    photoUrl: '/coaches/flick.png',
    emoji: '🌅',
    perk: {
      type: 'before_noon_pct',
      values: [10, 18, 28],
      descUA: [
        '+10% монет якщо виконав до 12:00',
        '+18% монет якщо виконав до 12:00',
        '+28% монет якщо виконав до 12:00',
      ],
    },
  },
  {
    id: 'emery',
    name: 'Unai Emery',
    nationality: 'Spain',
    clubs: ['Sevilla', 'Paris SG', 'Arsenal', 'Villarreal', 'Aston Villa'],
    photoUrl: '/coaches/emery.png',
    emoji: '🗺️',
    perk: {
      type: 'all_done_flat',
      values: [30, 50, 80],
      descUA: [
        '+30 монет коли виконав ВСІ звички за день',
        '+50 монет коли виконав ВСІ звички за день',
        '+80 монет коли виконав ВСІ звички за день',
      ],
    },
  },
  {
    id: 'pochettino',
    name: 'Mauricio Pochettino',
    nationality: 'Argentina',
    clubs: ['Tottenham', 'Paris SG', 'Chelsea'],
    photoUrl: '/coaches/pochettino.png',
    emoji: '📐',
    perk: {
      type: 'stat_boost',
      stat: 'pace',
      position: 'DEF',
      values: [5, 8, 12],
      descUA: [
        '+5 до швидкості для всіх ЗАХ',
        '+8 до швидкості для всіх ЗАХ',
        '+12 до швидкості для всіх ЗАХ',
      ],
    },
  },
  {
    id: 'allegri',
    name: 'Massimiliano Allegri',
    nationality: 'Italy',
    clubs: ['Juventus', 'AC Milan'],
    photoUrl: '/coaches/allegri.png',
    emoji: '🛡️',
    perk: {
      type: 'squad_full_pct',
      values: [8, 15, 25],
      descUA: [
        '+8% монет якщо склад заповнений (11/11)',
        '+15% монет якщо склад заповнений (11/11)',
        '+25% монет якщо склад заповнений (11/11)',
      ],
    },
  },
  {
    id: 'inzaghi',
    name: 'Simone Inzaghi',
    nationality: 'Italy',
    clubs: ['Lazio', 'Inter Milan'],
    photoUrl: '/coaches/inzaghi.png',
    emoji: '⚫',
    perk: {
      type: 'squad_min_pct',
      minPlayers: 5,
      values: [8, 15, 22],
      descUA: [
        '+8% монет якщо у складі 5+ гравців',
        '+15% монет якщо у складі 5+ гравців',
        '+22% монет якщо у складі 5+ гравців',
      ],
    },
  },
  {
    id: 'deschamps',
    name: 'Didier Deschamps',
    nationality: 'France',
    clubs: ['Monaco'],
    photoUrl: '/coaches/deschamps.png',
    emoji: '🇫🇷',
    perk: {
      type: 'streak_gte_flat',
      minStreak: 3,
      values: [6, 12, 20],
      descUA: [
        '+6 монет за звичку із серією ≥3 дні',
        '+12 монет за звичку із серією ≥3 дні',
        '+20 монет за звичку із серією ≥3 дні',
      ],
    },
  },
  {
    id: 'southgate',
    name: 'Gareth Southgate',
    nationality: 'England',
    clubs: [],
    photoUrl: '/coaches/southgate.png',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    perk: {
      type: 'stat_boost',
      stat: 'passing',
      position: 'GK',
      values: [5, 8, 12],
      descUA: [
        '+5 до паса для всіх ВОР',
        '+8 до паса для всіх ВОР',
        '+12 до паса для всіх ВОР',
      ],
    },
  },
  {
    id: 'tenhag',
    name: 'Erik ten Hag',
    nationality: 'Netherlands',
    clubs: ['Ajax', 'Man United'],
    photoUrl: '/coaches/tenhag.png',
    emoji: '🌷',
    perk: {
      type: 'streak_gte_flat',
      minStreak: 1,
      values: [6, 10, 18],
      descUA: [
        '+6 монет за кожну звичку із будь-якою серією',
        '+10 монет за кожну звичку із будь-якою серією',
        '+18 монет за кожну звичку із будь-якою серією',
      ],
    },
  },
]
```

**Step 2: Create `public/coaches/` directory and download photos**

Create the directory:
```bash
mkdir -p public/coaches
```

Download photos from TheSportsDB using this Node.js script (run once, save as `scripts/download-coach-photos.mjs`):

```javascript
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const SEARCH_URL = 'https://www.thesportsdb.com/api/v1/json/3/searchpersons.php?p='
const OUT_DIR = 'public/coaches'
mkdirSync(OUT_DIR, { recursive: true })

const coaches = [
  { id: 'guardiola',   query: 'Pep Guardiola' },
  { id: 'klopp',       query: 'Jurgen Klopp' },
  { id: 'ancelotti',   query: 'Carlo Ancelotti' },
  { id: 'ferguson',    query: 'Alex Ferguson' },
  { id: 'mourinho',    query: 'Jose Mourinho' },
  { id: 'simeone',     query: 'Diego Simeone' },
  { id: 'conte',       query: 'Antonio Conte' },
  { id: 'tuchel',      query: 'Thomas Tuchel' },
  { id: 'zidane',      query: 'Zinedine Zidane' },
  { id: 'luisenrique', query: 'Luis Enrique' },
  { id: 'xavi',        query: 'Xavi Hernandez' },
  { id: 'arteta',      query: 'Mikel Arteta' },
  { id: 'wenger',      query: 'Arsene Wenger' },
  { id: 'flick',       query: 'Hansi Flick' },
  { id: 'emery',       query: 'Unai Emery' },
  { id: 'pochettino',  query: 'Mauricio Pochettino' },
  { id: 'allegri',     query: 'Massimiliano Allegri' },
  { id: 'inzaghi',     query: 'Simone Inzaghi' },
  { id: 'deschamps',   query: 'Didier Deschamps' },
  { id: 'southgate',   query: 'Gareth Southgate' },
  { id: 'tenhag',      query: 'Erik ten Hag' },
]

for (const { id, query } of coaches) {
  try {
    const res = await fetch(SEARCH_URL + encodeURIComponent(query))
    const data = await res.json()
    const person = data.person?.[0]
    const thumbUrl = person?.strThumb || person?.strCutout || person?.strRender
    if (!thumbUrl) { console.warn(`No photo for ${id}`); continue }
    const imgRes = await fetch(thumbUrl)
    const buf = Buffer.from(await imgRes.arrayBuffer())
    writeFileSync(join(OUT_DIR, `${id}.png`), buf)
    console.log(`✓ ${id}`)
    await new Promise(r => setTimeout(r, 400))  // be polite to the API
  } catch (e) {
    console.error(`✗ ${id}:`, e.message)
  }
}
```

Run it:
```bash
node scripts/download-coach-photos.mjs
```

For any coach with no TheSportsDB photo, create a placeholder (or use the emoji). The `CoachCard` component already handles missing photos gracefully (falls back to emoji).

**Step 3: Verify**

```bash
npm run build
```
Expected: Build succeeds. The `coachPerks.ts` import error from Task 2 should now be resolved.

**Step 4: Commit**

```bash
git add src/data/coaches.ts scripts/download-coach-photos.mjs public/coaches/
git commit -m "feat: add 21 coach data definitions and photos"
```

---

### Task 4: Coach pack definition

**Files:**
- Create: `src/data/coachPack.ts`

**Step 1: Create the file**

```typescript
import type { CoachPackDef } from '../types'

export const coachPack: CoachPackDef = {
  id: 'coach',
  name: 'Тренерський Пакет',
  cost: 350,
  emoji: '📋',
}
```

**Step 2: Verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/data/coachPack.ts
git commit -m "feat: add coach pack definition (350 coins, 1 card)"
```

---

### Task 5: Update store

**Files:**
- Modify: `src/store/useAppStore.ts`

**Step 1: Add imports**

Add to the top imports:
```typescript
import { computeCoachHabitBonus } from '../lib/coachPerks'
```

**Step 2: Add store interface actions**

In the `AppStore` interface, add:
```typescript
  assignCoach: (coachId: string | null) => void
  buyCoachPack: (coachId: string, cost: number) => { isLevelUp: boolean; newLevel: number; refundCoins: number; newUnlockIds: string[] }
```

**Step 3: Add initial state values**

In the `create` call initial state, add:
```typescript
      coachCollection: {},
      assignedCoach: null,
```

**Step 4: Wire coach bonus into `completeHabit`**

In `completeHabit`, after the `const earned = Math.round(baseCoin * (1 + bonusPct / 100))` line, add:

```typescript
          const coachBonus = computeCoachHabitBonus(state, id, earned, newStreak)
          const total = earned + coachBonus
```

Then change `coins: state.coins + earned` to `coins: state.coins + total`.

**Step 5: Add `assignCoach` action**

```typescript
      assignCoach: (coachId) => {
        set({ assignedCoach: coachId })
        const newUnlocks = checkAchievements(get())
        for (const achievementId of newUnlocks) {
          get().unlockAchievement(achievementId)
        }
      },
```

**Step 6: Add `buyCoachPack` action**

```typescript
      buyCoachPack: (coachId, cost) => {
        const state = get()
        const current = state.coachCollection[coachId] ?? 0
        const newCount = current + 1
        const newLevel = Math.min(newCount, 3)
        const isLevelUp = current > 0 && newLevel <= 3
        const alreadyMaxed = current >= 3
        const refundCoins = alreadyMaxed ? 50 : 0

        set({
          coins: state.coins - cost + refundCoins,
          coachCollection: { ...state.coachCollection, [coachId]: newCount },
        })

        const newUnlockIds = checkAchievements(get())
        if (newUnlockIds.length > 0) {
          const unlockedAt = new Date().toISOString()
          set(s => ({
            achievements: Object.fromEntries([
              ...Object.entries(s.achievements),
              ...newUnlockIds.map(id => [id, { unlockedAt }]),
            ]),
          }))
        }

        return { isLevelUp, newLevel, refundCoins, newUnlockIds }
      },
```

**Step 7: Add `coachCollection` and `assignedCoach` to `resetAll`**

In `resetAll`, add:
```typescript
          coachCollection: {},
          assignedCoach: null,
```

**Step 8: Verify**

```bash
npm run build
```
Expected: zero errors.

**Step 9: Commit**

```bash
git add src/store/useAppStore.ts
git commit -m "feat: add coach store actions (buyCoachPack, assignCoach) and wire perk into completeHabit"
```

---

### Task 6: CoachCard component

**Files:**
- Create: `src/components/cards/CoachCard.tsx`

**Step 1: Create the component**

```tsx
import type { Coach } from '../../types'

const LEVEL_STARS = ['☆☆☆', '★☆☆', '★★☆', '★★★']

interface CoachCardProps {
  coach: Coach
  level?: number           // 0–3, default 0
  mini?: boolean           // compact grid card
  showPerk?: boolean       // show perk description (default true)
}

function CoachPhoto({ coach }: { coach: Coach }) {
  return coach.photoUrl ? (
    <img
      src={`${import.meta.env.BASE_URL}${coach.photoUrl.replace(/^\//, '')}`}
      alt={coach.name}
      className="w-full h-full object-cover object-top"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-3xl">{coach.emoji}</div>
  )
}

export function CoachCard({ coach, level = 0, mini = false, showPerk = true }: CoachCardProps) {
  const perkDesc = level > 0 ? coach.perk.descUA[level - 1] : coach.perk.descUA[0]

  if (mini) {
    return (
      <div className="border-2 border-[#FBBF24]/40 bg-[#0D0A00] rounded-xl p-2 flex flex-col items-center gap-1 select-none">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 ring-1 ring-[#FBBF24]/50">
          <CoachPhoto coach={coach} />
        </div>
        <div className="font-oswald text-[10px] font-bold text-white text-center leading-tight truncate w-full">
          {coach.name.split(' ').slice(-1)[0]}
        </div>
        <div className="text-[9px] font-oswald text-[#FBBF24] font-bold">
          {level > 0 ? LEVEL_STARS[level] : '🔒'}
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative rounded-2xl border-2 overflow-hidden flex flex-col select-none"
      style={{
        borderColor: '#FBBF24',
        background: 'linear-gradient(155deg, #1a1200 0%, #0D0900 60%, #050300 100%)',
        boxShadow: '0 0 30px rgba(251,191,36,0.25), 0 8px 24px rgba(0,0,0,0.5)',
        width: '100%',
        minHeight: '280px',
      }}
    >
      {/* Header band */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#FBBF24]/20 bg-black/30">
        <span className="font-oswald text-[10px] tracking-widest text-white/50 uppercase">⚽ HABITFC</span>
        <span className="font-oswald text-[10px] tracking-widest text-[#FBBF24] uppercase">ТРЕНЕР</span>
      </div>

      {/* Photo */}
      <div className="relative w-full" style={{ height: '140px' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0D0900]" style={{ zIndex: 1 }} />
        <div className="w-full h-full bg-black/20">
          <CoachPhoto coach={coach} />
        </div>
      </div>

      {/* Name + clubs */}
      <div className="px-3 pt-1 pb-2 flex-1 flex flex-col gap-1.5">
        <div>
          <div className="font-oswald font-bold text-white text-lg leading-tight uppercase tracking-wide">
            {coach.name}
          </div>
          <div className="text-[10px] text-[#5A7090] truncate">
            {coach.clubs.slice(0, 3).join(' · ') || coach.nationality}
          </div>
        </div>

        {showPerk && (
          <div className="mt-auto bg-[#FBBF24]/8 border border-[#FBBF24]/20 rounded-lg px-2.5 py-2">
            <div className="text-[9px] text-[#FBBF24]/60 uppercase tracking-wider font-oswald mb-0.5">Перк</div>
            <div className="text-[11px] text-white/90 leading-tight">{perkDesc}</div>
          </div>
        )}

        {/* Level stars */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[#FBBF24] text-sm tracking-widest">{LEVEL_STARS[level]}</span>
          {level > 0 && (
            <span className="font-oswald text-[10px] text-[#FBBF24]/60 uppercase">Рів. {level}</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/cards/CoachCard.tsx
git commit -m "feat: add CoachCard component with amber theme and level stars"
```

---

### Task 7: Update Shop page

**Files:**
- Modify: `src/pages/Shop.tsx`

**Step 1: Add imports**

```typescript
import { coaches } from '../data/coaches'
import { coachPack } from '../data/coachPack'
```

**Step 2: Add coach pack buy handler**

In the `Shop` function, add:
```typescript
  const coachCollection = useAppStore(state => state.coachCollection)

  function handleBuyCoachPack() {
    if (coins < coachPack.cost) return
    const coach = coaches[Math.floor(Math.random() * coaches.length)]
    navigate('/open', { state: { type: 'coach', coach } })
  }
```

**Step 3: Add coach pack section in JSX**

After the existing packs grid, add a new section:

```tsx
      {/* Coach pack section */}
      <div className="mt-8 sm:mt-10">
        <div className="font-oswald text-xs tracking-[0.25em] text-[#FBBF24] uppercase mb-3">
          · Тренери ·
        </div>
        <div className="flex justify-center">
          <div
            className="relative rounded-2xl border-2 overflow-hidden p-5 flex flex-col items-center gap-4 max-w-xs w-full"
            style={{
              borderColor: '#FBBF24',
              background: 'linear-gradient(155deg, #1a1200 0%, #0D0900 70%, #050300 100%)',
              boxShadow: '0 0 40px rgba(251,191,36,0.2)',
            }}
          >
            {/* Shimmer */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
              <div
                className="absolute top-0 bottom-0 w-8 -skew-x-12 animate-[shimmer_3s_linear_infinite]"
                style={{ background: 'linear-gradient(to right, transparent, rgba(251,191,36,0.15), transparent)' }}
              />
            </div>

            <div className="text-6xl" style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.6))' }}>
              {coachPack.emoji}
            </div>
            <div className="text-center">
              <div className="font-oswald text-xl font-bold text-white uppercase tracking-wide">
                {coachPack.name}
              </div>
              <div className="text-[#FBBF24]/70 text-sm mt-1">1 тренер · унікальний перк</div>
              <div className="text-xs text-[#5A7090] mt-0.5">Дублікат = підвищення рівня перку</div>
            </div>
            <div className="flex items-center gap-1.5 text-lg font-oswald font-bold text-[#FBBF24]">
              <CoinIcon size={20} />
              {coachPack.cost}
            </div>
            <button
              onClick={handleBuyCoachPack}
              disabled={coins < coachPack.cost}
              className={`w-full py-3 rounded-xl font-oswald font-bold uppercase tracking-wider text-sm transition-all ${
                coins >= coachPack.cost
                  ? 'cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(135deg, #FBBF24, #D97706)',
                color: '#0D0900',
              }}
            >
              {coins >= coachPack.cost ? 'Купити тренера' : 'Недостатньо монет'}
            </button>
          </div>
        </div>
      </div>
```

**Step 4: Verify**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/pages/Shop.tsx
git commit -m "feat: add coach pack section to Shop page"
```

---

### Task 8: Update PackOpening for coach packs

**Files:**
- Modify: `src/pages/PackOpening.tsx`

**Step 1: Update imports and location state types**

Add imports:
```typescript
import type { Coach } from '../types'
import { CoachCard } from '../components/cards/CoachCard'
import { getCoachLevel } from '../lib/coachPerks'
```

Replace the `LocationState` type with a discriminated union:
```typescript
type LocationState =
  | { type: 'footballer'; pack: Pack; cards: Footballer[]; nextPityCounter: number }
  | { type: 'coach'; coach: Coach }
```

For backwards compatibility with old navigation calls (no `type` field), add a helper at the top of `PackOpening`:
```typescript
function normalizeState(raw: unknown): LocationState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (s.type === 'coach' && s.coach) return s as LocationState
  if (s.pack && s.cards) return { type: 'footballer', ...(s as object) } as LocationState
  return null
}
```

**Step 2: Split component logic at the top of `PackOpening`**

After normalizing state, add an early branch:
```typescript
  const locationState = normalizeState(location.state)

  if (!locationState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-400">Пакет не обрано.</p>
        <button onClick={() => navigate('/shop')} className="px-6 py-3 bg-blue-600 rounded-xl font-bold cursor-pointer">
          До магазину
        </button>
      </div>
    )
  }

  if (locationState.type === 'coach') {
    return <CoachPackOpening coach={locationState.coach} />
  }

  // ... existing footballer pack logic continues unchanged
  const { pack, cards, nextPityCounter } = locationState
```

**Step 3: Add `CoachPackOpening` sub-component** (inside the same file, above `PackOpening`):

```tsx
function CoachPackOpening({ coach }: { coach: Coach }) {
  const navigate = useNavigate()
  const buyCoachPack = useAppStore(state => state.buyCoachPack)
  const coachCollection = useAppStore(state => state.coachCollection)
  const pushPendingUnlock = useAppStore(state => state.pushPendingUnlock)

  const [phase, setPhase] = useState<'confirm' | 'opening' | 'revealed'>('confirm')
  const [result, setResult] = useState<{ isLevelUp: boolean; newLevel: number; refundCoins: number } | null>(null)

  const previewLevel = Math.min((coachCollection[coach.id] ?? 0) + 1, 3)

  function handleOpen() {
    setPhase('opening')
    playPackOpen()
    setTimeout(() => {
      const res = buyCoachPack(coach.id, 350)
      setResult(res)
      // drain achievement unlocks
      for (const id of res.newUnlockIds) pushPendingUnlock(id)
      setTimeout(() => setPhase('revealed'), 300)
    }, 1000)
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-10 gap-6">
      <AnimatePresence mode="wait">
        {phase !== 'revealed' && (
          <motion.div
            key="confirm"
            className="flex flex-col items-center gap-6"
            exit={{ scale: 1.4, opacity: 0, y: -60, transition: { duration: 0.4 } }}
          >
            {/* Coach pack visual */}
            <motion.div
              animate={
                phase === 'opening'
                  ? { x: [0, -14, 14, -10, 10, -6, 6, 0], transition: { duration: 0.55 } }
                  : { y: [0, -8, 0], transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } }
              }
            >
              <div
                className="w-44 min-h-[17rem] rounded-2xl border-2 flex flex-col items-center justify-center gap-4 relative overflow-hidden"
                style={{
                  borderColor: '#FBBF24',
                  background: 'linear-gradient(155deg, #1a1200 0%, #0D0900 60%, #050300 100%)',
                  boxShadow: '0 0 60px rgba(251,191,36,0.4)',
                }}
              >
                <div className="text-7xl" style={{ filter: 'drop-shadow(0 0 28px #FBBF24)' }}>📋</div>
                <div className="text-center px-3">
                  <div className="font-oswald text-lg text-white uppercase tracking-wide">Тренерський Пакет</div>
                  <div className="font-oswald text-sm text-[#FBBF24] mt-1">1 тренер</div>
                </div>
              </div>
            </motion.div>

            {phase === 'confirm' && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-gray-400 text-sm flex items-center gap-2">
                  1 тренер за <span className="font-bold text-[#FBBF24] flex items-center gap-1"><CoinIcon size={16} />350</span>
                </p>
                <div className="flex gap-3">
                  <button onClick={() => navigate('/shop')} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer text-sm">
                    Скасувати
                  </button>
                  <button
                    onClick={handleOpen}
                    className="px-7 py-2.5 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer text-sm"
                    style={{ background: 'linear-gradient(135deg, #FBBF24, #D97706)', color: '#0D0900' }}
                  >
                    Відкрити! ✨
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {phase === 'revealed' && result && (
          <motion.div
            key="revealed"
            className="flex flex-col items-center gap-6 w-full max-w-xs"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center">
              <div className="font-oswald text-xs tracking-[0.25em] text-[#FBBF24] uppercase mb-1">
                {result.isLevelUp ? '· Підвищення рівня! ·' : '· Новий тренер! ·'}
              </div>
              <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-white">
                {coach.name}
              </h1>
            </div>

            <div style={{ width: '180px' }}>
              <CoachCard coach={coach} level={result.newLevel} />
            </div>

            {result.isLevelUp && (
              <div className="text-[#FBBF24] font-semibold text-sm bg-[#FBBF24]/10 border border-[#FBBF24]/30 px-4 py-2 rounded-xl">
                Перк підвищено до рівня {result.newLevel}!
              </div>
            )}
            {result.refundCoins > 0 && (
              <div className="text-yellow-400 font-semibold text-sm flex items-center gap-1">
                +{result.refundCoins} <CoinIcon size={16} /> (максимальний рівень)
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button onClick={() => navigate('/shop')} className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer">
                Магазин
              </button>
              <button onClick={() => navigate('/team')} className="flex-1 px-6 py-3 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer" style={{ background: 'linear-gradient(135deg, #FBBF24, #D97706)', color: '#0D0900' }}>
                До команди
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

**Step 4: Fix existing `PackOpening` state parsing**

Remove the old guard block:
```typescript
  if (!state?.pack || !state?.cards || state.nextPityCounter === undefined) { ... }
```
It's now replaced by `normalizeState` above.

**Step 5: Verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/pages/PackOpening.tsx
git commit -m "feat: add coach pack opening flow to PackOpening"
```

---

### Task 9: Team page — coach slot

**Files:**
- Modify: `src/pages/Team.tsx`

**Step 1: Add imports**

```typescript
import { coaches } from '../data/footballers'  // existing
import { coaches as allCoaches } from '../data/coaches'
import { getAssignedCoach, computeCoachChemistryPct, getCoachLevel, applyCoachStatBoost } from '../lib/coachPerks'
import { CoachCard } from '../components/cards/CoachCard'
```

**Step 2: Add coach state from store**

```typescript
  const coachCollection = useAppStore(state => state.coachCollection)
  const assignedCoach = useAppStore(state => state.assignedCoach)
  const assignCoach = useAppStore(state => state.assignCoach)
  const [coachPickerOpen, setCoachPickerOpen] = useState(false)
```

**Step 3: Compute assigned coach object and chemistry**

```typescript
  const assignedCoachObj = useMemo(
    () => assignedCoach ? allCoaches.find(c => c.id === assignedCoach) ?? null : null,
    [assignedCoach]
  )

  const coachChemPct = useMemo(() => {
    if (!assignedCoachObj) return 0
    return computeCoachChemistryPct(assignedCoachObj, filledPlayers)
  }, [assignedCoachObj, filledPlayers])

  const coachLevel = assignedCoach ? getCoachLevel(assignedCoach, coachCollection) : 0
```

**Step 4: Apply stat boost to player display**

Where `playerOverall(footballer)` is called in the pitch rendering, wrap the footballer with `applyCoachStatBoost`. Add a helper:

```typescript
  const appState = useAppStore(state => state)  // for applyCoachStatBoost

  function boostedFootballer(f: typeof footballers[0]) {
    return applyCoachStatBoost(f, appState)
  }
```

Then in `playerOverall` calls for the pitch and stats panel, use `playerOverall(boostedFootballer(footballer))`.

**Step 5: Add coach slot above the pitch**

In the JSX, before the `<div className="flex flex-col lg:flex-row ...">` (the pitch+panel container), add:

```tsx
      {/* Coach slot */}
      <div className="mb-4">
        {assignedCoachObj ? (
          <div
            className="flex items-center gap-3 bg-[#0A0F1A] border border-[#FBBF24]/30 rounded-2xl px-4 py-3 cursor-pointer hover:border-[#FBBF24]/60 transition-colors"
            onClick={() => setCoachPickerOpen(true)}
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 ring-2 ring-[#FBBF24]/50 shrink-0">
              {assignedCoachObj.photoUrl ? (
                <img
                  src={`${import.meta.env.BASE_URL}${assignedCoachObj.photoUrl.replace(/^\//, '')}`}
                  alt={assignedCoachObj.name}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">{assignedCoachObj.emoji}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-oswald font-bold text-white text-sm truncate">{assignedCoachObj.name}</div>
              <div className="text-[10px] text-[#FBBF24]/70 truncate">
                {assignedCoachObj.perk.descUA[coachLevel - 1]}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="text-[#FBBF24] text-xs">{'★'.repeat(coachLevel)}{'☆'.repeat(3 - coachLevel)}</div>
              {coachChemPct > 0 && (
                <div className="text-[10px] font-oswald font-bold text-[#FBBF24]">+{coachChemPct}% хімія</div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCoachPickerOpen(true)}
            className="w-full py-3 border-2 border-dashed border-[#FBBF24]/30 rounded-2xl font-oswald text-sm text-[#FBBF24]/50 hover:border-[#FBBF24]/60 hover:text-[#FBBF24]/70 transition-colors cursor-pointer"
          >
            + Призначити тренера
          </button>
        )}
      </div>
```

**Step 6: Add coach picker bottom sheet**

After the main content, add:

```tsx
      {/* Coach picker */}
      {coachPickerOpen && (
        <div
          className="fixed left-0 right-0 z-50 bg-[#0A0F1A] border border-b-0 border-[#FBBF24]/20 rounded-t-2xl overflow-hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
            <div className="w-8 h-1 bg-[#2A3A50] rounded-full" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-oswald text-lg font-bold text-white">Вибери тренера</div>
              <button onClick={() => setCoachPickerOpen(false)} className="w-8 h-8 flex items-center justify-center text-[#5A7090] hover:text-white hover:bg-[#1A2336] rounded-lg text-xl cursor-pointer">×</button>
            </div>

            {assignedCoach && (
              <button
                onClick={() => { assignCoach(null); setCoachPickerOpen(false) }}
                className="w-full mb-3 py-2 border border-red-500/30 text-red-400 text-xs font-oswald font-bold uppercase tracking-wider hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
              >
                Зняти тренера
              </button>
            )}

            {(() => {
              const ownedCoaches = allCoaches.filter(c => (coachCollection[c.id] ?? 0) > 0)
              if (ownedCoaches.length === 0) {
                return (
                  <div className="text-center py-8 text-[#5A7090]">
                    <div className="text-4xl mb-3">📋</div>
                    <div className="font-oswald text-sm text-white">Немає тренерів</div>
                    <div className="text-xs mt-1">Купи Тренерський Пакет у магазині</div>
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ownedCoaches.map(c => {
                    const lvl = getCoachLevel(c.id, coachCollection)
                    const isActive = assignedCoach === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => { assignCoach(c.id); setCoachPickerOpen(false) }}
                        className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isActive ? 'border-[#FBBF24]' : 'border-[#FBBF24]/20 hover:border-[#FBBF24]/50'}`}
                      >
                        <CoachCard coach={c} level={lvl} mini={false} showPerk />
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}
```

**Step 7: Add coach chemistry to the stats bar**

In the chemistry/bonus bar section, add a coach chemistry row if coachChemPct > 0:

```tsx
        {coachChemPct > 0 && assignedCoachObj && (
          <div className="mb-4 bg-[#0A0F1A] border border-[#FBBF24]/20 rounded-xl px-4 py-3">
            <div className="text-[10px] text-[#5A7090] uppercase tracking-wider mb-2 font-oswald">Хімія тренера</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#5A7090]">{assignedCoachObj.name}</span>
              <span className="text-[10px] font-oswald font-bold text-[#FBBF24]">+{coachChemPct}%</span>
            </div>
          </div>
        )}
```

**Step 8: Verify**

```bash
npm run build
```

**Step 9: Commit**

```bash
git add src/pages/Team.tsx
git commit -m "feat: add coach slot, picker, chemistry and stat boost to Team page"
```

---

### Task 10: Collection page — coaches tab

**Files:**
- Modify: `src/pages/Collection.tsx`

**Step 1: Add imports**

```typescript
import { coaches } from '../data/coaches'
import { CoachCard } from '../components/cards/CoachCard'
import { getCoachLevel } from '../lib/coachPerks'
```

**Step 2: Add tab state and coach store data**

```typescript
  const [tab, setTab] = useState<'players' | 'coaches'>('players')
  const coachCollection = useAppStore(state => state.coachCollection)
  const ownedCoachCount = Object.keys(coachCollection).filter(id => (coachCollection[id] ?? 0) > 0).length
```

**Step 3: Add tab switcher**

At the top of the return, after the header section and before the progress bar, add:

```tsx
      {/* Tab switcher */}
      <div className="flex gap-2 mb-5 bg-[#0A0F1A] border border-[#1A2336] rounded-xl p-1">
        <button
          onClick={() => setTab('players')}
          className={`flex-1 py-2 rounded-lg font-oswald font-bold text-xs tracking-wider transition-all cursor-pointer ${tab === 'players' ? 'bg-[#00E676] text-[#04060A]' : 'text-[#5A7090] hover:text-white'}`}
        >
          Гравці ({Object.keys(collection).length}/{footballers.length})
        </button>
        <button
          onClick={() => setTab('coaches')}
          className={`flex-1 py-2 rounded-lg font-oswald font-bold text-xs tracking-wider transition-all cursor-pointer ${tab === 'coaches' ? 'bg-[#FBBF24] text-[#0D0900]' : 'text-[#5A7090] hover:text-white'}`}
        >
          Тренери ({ownedCoachCount}/{coaches.length})
        </button>
      </div>
```

**Step 4: Wrap the existing players grid in a conditional**

Wrap `{/* rarity filters */}` and the grid in `{tab === 'players' && (...)}`.

**Step 5: Add coaches grid**

After the players section, add:

```tsx
      {tab === 'coaches' && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {coaches.map(c => {
              const owned = (coachCollection[c.id] ?? 0) > 0
              const level = getCoachLevel(c.id, coachCollection)
              return owned ? (
                <div key={c.id}>
                  <CoachCard coach={c} level={level} showPerk />
                </div>
              ) : (
                <div key={c.id} className="border-2 border-[#FBBF24]/15 bg-[#0A0800] rounded-xl p-2 flex flex-col items-center gap-1 select-none min-h-[120px] justify-center">
                  <div className="text-3xl opacity-20">📋</div>
                  <div className="font-oswald text-xs font-bold text-[#2A3441]">???</div>
                  <div className="font-oswald text-[10px] font-bold tracking-wider text-[#FBBF24]/30">ТРЕНЕР</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
```

**Step 6: Verify**

```bash
npm run build
```

**Step 7: Commit**

```bash
git add src/pages/Collection.tsx
git commit -m "feat: add coaches tab to Collection page"
```

---

### Task 11: Achievements

**Files:**
- Modify: `src/lib/achievements.ts`

**Step 1: Update `AchievementDef` condition signature**

The `condition` function already receives full `AppState`. `coachCollection` and `assignedCoach` are now on that type — no changes to `AchievementDef` interface needed.

**Step 2: Add 6 new achievements to `ACHIEVEMENTS` array**

Add at the end, before the closing `]`:

```typescript
  // ── Coaches — Memes ───────────────────────────────────────────────────────────
  {
    id: 'special_one',
    titleUA: 'Особливий',
    descUA: 'Призначив Моурінью. Він вже проводить прес-конференцію.',
    category: 'memes',
    icon: '😏',
    condition: s => s.assignedCoach === 'mourinho',
  },
  {
    id: 'pep_or_pep',
    titleUA: 'Тіктака чи Тіктака?',
    descUA: 'Маєш і Гвардіолу, і Хаві. Обидва хочуть, щоб усі пасували. Постійно.',
    category: 'memes',
    icon: '🧠',
    condition: s => (s.coachCollection['guardiola'] ?? 0) > 0 && (s.coachCollection['xavi'] ?? 0) > 0,
  },
  {
    id: 'the_klopp',
    titleUA: 'ЙЄЄЄС!',
    descUA: 'Призначив Клоппа. Тепер твоя команда пресингує суперника навіть у нього вдома.',
    category: 'memes',
    icon: '😁',
    condition: s => s.assignedCoach === 'klopp',
  },
  {
    id: 'invincible_process',
    titleUA: 'Процес',
    descUA: 'Маєш Артету і Венгера одночасно. Арсенал живе у твоєму серці.',
    category: 'memes',
    icon: '🔴',
    condition: s => (s.coachCollection['arteta'] ?? 0) > 0 && (s.coachCollection['wenger'] ?? 0) > 0,
  },

  // ── Coaches — Collection ──────────────────────────────────────────────────────
  {
    id: 'tactics_nerd',
    titleUA: 'Тактичний Геній',
    descUA: 'Зібрав 5 тренерів. Ти вже малюєш схеми на серветках.',
    category: 'collection',
    icon: '📋',
    progressFn: s => ({
      current: Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length,
      total: 5,
    }),
    condition: s =>
      Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length >= 5,
  },
  {
    id: 'full_dugout',
    titleUA: 'Повна лавка',
    descUA: 'Зібрав усіх 21 тренера. Хто взагалі тренує команду?',
    category: 'collection',
    icon: '🏟️',
    progressFn: s => ({
      current: Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length,
      total: 21,
    }),
    condition: s =>
      Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length >= 21,
  },
```

**Step 3: Verify**

```bash
npm run build
```
Expected: clean build, no errors.

**Step 4: Commit**

```bash
git add src/lib/achievements.ts
git commit -m "feat: add 6 coach achievements (4 meme + 2 collection)"
```

---

### Task 12: Final verification

**Step 1: Full build + type check**

```bash
npm run build
```
Expected: zero errors, bundle generated.

**Step 2: Manual smoke test checklist**

Open the app (`npm run dev`) and verify:
- [ ] Shop page shows coach pack section below footballer packs
- [ ] Buying a coach pack navigates to pack opening with amber theme
- [ ] Coach card reveals correctly with name, perk, level stars
- [ ] Second pull of same coach shows "Підвищення рівня!" message
- [ ] Third pull shows level 3; fourth pull shows 50-coin refund
- [ ] Team page shows "Призначити тренера" slot above pitch
- [ ] Clicking slot opens coach picker bottom sheet
- [ ] Assigning a coach shows the coach banner with perk + chemistry %
- [ ] Stat boost coaches show boosted overall on pitch (e.g. Guardiola → MID passing +5)
- [ ] Habit perk coaches give extra coins (verify in console/coin counter)
- [ ] Collection page has "Гравці / Тренери" tab switcher
- [ ] Owned coaches show as cards, unowned show as locked silhouettes
- [ ] Achievements `special_one` and `the_klopp` trigger on correct coach assignment
- [ ] Achievement `pep_or_pep` triggers when both Guardiola + Xavi are owned
- [ ] `tactics_nerd` triggers at 5 coaches, `full_dugout` at 21

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete coaches feature — packs, cards, perks, team slot, collection, achievements"
```
