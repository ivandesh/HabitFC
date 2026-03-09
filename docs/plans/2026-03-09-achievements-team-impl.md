# Achievements + Team Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full achievements system (17 achievements, toast notifications, dedicated page) and enhance the Team page with a formation switcher, player stat overlay, and real chemistry bonuses that affect coin earnings.

**Architecture:** Zustand store extended with `achievements`, `totalCompletions`, `formation`, and `pendingUnlocks` (not persisted). Achievement conditions are pure functions in `src/lib/achievements.ts`. Chemistry bonuses computed on-the-fly in `src/lib/bonuses.ts`. Checking runs after `completeHabit`, `buyPack`, `setSquadSlot`.

**Tech Stack:** React + TypeScript + Vite, Zustand with persist middleware, Framer Motion, Tailwind CSS, Web Audio API (no external files), React Router

---

## Phase 1 — Achievements

---

### Task 1: Extend types and store — achievements + totalCompletions

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store/useAppStore.ts`

**Step 1: Extend AppState in types.ts**

Add these fields to the `AppState` interface:

```ts
export interface AppState {
  coins: number
  habits: Habit[]
  collection: Record<string, number>
  pullHistory: { footballerId: string; pulledAt: string }[]
  squad: (string | null)[]
  // NEW:
  achievements: Record<string, { unlockedAt: string }>
  totalCompletions: number
  formation: string
  pendingUnlocks: string[]  // not persisted — UI drain queue
}
```

**Step 2: Update AppStore interface in useAppStore.ts**

Add action signatures after existing ones:

```ts
unlockAchievement: (id: string) => void
drainPendingUnlock: () => string | undefined
```

**Step 3: Add initial state + actions + persist partialize**

Replace the `create<AppStore>()( persist( (set, get) => ({` section. Add new fields to initial state:

```ts
achievements: {},
totalCompletions: 0,
formation: '4-3-3',
pendingUnlocks: [],
```

Add new actions:

```ts
unlockAchievement: (id) => {
  set(state => ({
    achievements: {
      ...state.achievements,
      [id]: { unlockedAt: new Date().toISOString() },
    },
    pendingUnlocks: [...state.pendingUnlocks, id],
  }))
},

drainPendingUnlock: () => {
  const state = get()
  if (state.pendingUnlocks.length === 0) return undefined
  const [next, ...rest] = state.pendingUnlocks
  set({ pendingUnlocks: rest })
  return next
},
```

Update `completeHabit` to increment `totalCompletions`:

```ts
completeHabit: (id) => {
  set(state => {
    const habit = state.habits.find(h => h.id === id)
    if (!habit || isCompletedToday(habit.lastCompleted)) return state

    const newStreak = calculateNewStreak(habit.streak, habit.lastCompleted)
    const multiplier = streakMultiplier(newStreak)
    const earned = Math.round(habit.coinValue * multiplier)

    return {
      coins: state.coins + earned,
      totalCompletions: state.totalCompletions + 1,
      habits: state.habits.map(h =>
        h.id === id
          ? { ...h, streak: newStreak, lastCompleted: getToday() }
          : h
      ),
    }
  })
},
```

Update `resetAll` to reset new fields:

```ts
resetAll: () => {
  set({
    coins: 200,
    habits: [],
    collection: {},
    pullHistory: [],
    squad: Array(11).fill(null),
    achievements: {},
    totalCompletions: 0,
    formation: '4-3-3',
    pendingUnlocks: [],
  })
},
```

Add `partialize` to the persist options to exclude `pendingUnlocks`:

```ts
persist(
  (set, get) => ({ ... }),
  {
    name: 'habit-tracker-store',
    partialize: (state) => {
      const { pendingUnlocks, ...rest } = state
      return rest
    },
  }
)
```

**Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: no type errors

**Step 5: Commit**

```bash
git add src/types.ts src/store/useAppStore.ts
git commit -m "feat: extend store with achievements, totalCompletions, formation, pendingUnlocks"
```

---

### Task 2: Create achievement definitions and checker

**Files:**
- Create: `src/lib/achievements.ts`

**Step 1: Create the file with all achievement definitions**

```ts
import { footballers } from '../data/footballers'
import type { AppState } from '../types'

export interface AchievementDef {
  id: string
  titleUA: string
  descUA: string
  category: 'habits' | 'collection' | 'team'
  icon: string
  progressFn?: (state: AppState) => { current: number; total: number }
  condition: (state: AppState) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Habits ──────────────────────────────────────────────────────────────────
  {
    id: 'first_step',
    titleUA: 'Перший крок',
    descUA: 'Виконай 1 звичку',
    category: 'habits',
    icon: '👟',
    condition: s => s.totalCompletions >= 1,
  },
  {
    id: 'on_a_roll',
    titleUA: 'В ударі',
    descUA: 'Досягни серії 3 дні підряд',
    category: 'habits',
    icon: '🔥',
    condition: s => s.habits.some(h => h.streak >= 3),
  },
  {
    id: 'week_warrior',
    titleUA: 'Воїн тижня',
    descUA: 'Досягни серії 7 днів підряд',
    category: 'habits',
    icon: '⚔️',
    condition: s => s.habits.some(h => h.streak >= 7),
  },
  {
    id: 'centurion',
    titleUA: 'Центуріон',
    descUA: 'Виконай 100 звичок',
    category: 'habits',
    icon: '💯',
    progressFn: s => ({ current: s.totalCompletions, total: 100 }),
    condition: s => s.totalCompletions >= 100,
  },
  {
    id: 'iron_will',
    titleUA: 'Залізна воля',
    descUA: 'Досягни серії 30 днів підряд',
    category: 'habits',
    icon: '🏆',
    condition: s => s.habits.some(h => h.streak >= 30),
  },

  // ── Collection ───────────────────────────────────────────────────────────────
  {
    id: 'rookie_collector',
    titleUA: 'Новачок',
    descUA: 'Зібри 10 карток',
    category: 'collection',
    icon: '📦',
    progressFn: s => ({
      current: Object.keys(s.collection).filter(id => (s.collection[id] ?? 0) > 0).length,
      total: 10,
    }),
    condition: s =>
      Object.keys(s.collection).filter(id => (s.collection[id] ?? 0) > 0).length >= 10,
  },
  {
    id: 'legend_hunter',
    titleUA: 'Мисливець за легендами',
    descUA: 'Отримай хоча б одну легендарну картку',
    category: 'collection',
    icon: '⭐',
    condition: s =>
      footballers
        .filter(f => f.rarity === 'legendary')
        .some(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'legend_master',
    titleUA: 'Майстер легенд',
    descUA: 'Зібри всіх легендарних гравців',
    category: 'collection',
    icon: '👑',
    progressFn: s => {
      const legendaries = footballers.filter(f => f.rarity === 'legendary')
      return {
        current: legendaries.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: legendaries.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.rarity === 'legendary')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'real_madrid_fan',
    titleUA: 'Фанат Реалу',
    descUA: 'Зібри всіх гравців Реал Мадрид',
    category: 'collection',
    icon: '⚪',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Real Madrid')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Real Madrid')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'barcelona_fan',
    titleUA: 'Фанат Барси',
    descUA: 'Зібри всіх гравців Барселони',
    category: 'collection',
    icon: '🔵',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Barcelona')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Barcelona')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'man_city_fan',
    titleUA: 'Фанат Сіті',
    descUA: 'Зібри всіх гравців Ман Сіті',
    category: 'collection',
    icon: '🔷',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Man City')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Man City')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'liverpool_fan',
    titleUA: 'Фанат Ліверпуля',
    descUA: 'Зібри всіх гравців Ліверпуля',
    category: 'collection',
    icon: '🔴',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Liverpool')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Liverpool')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'goalkeeper_club',
    titleUA: 'Клуб воротарів',
    descUA: 'Зібри всіх воротарів',
    category: 'collection',
    icon: '🧤',
    progressFn: s => {
      const gks = footballers.filter(f => f.position === 'GK')
      return {
        current: gks.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: gks.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.position === 'GK')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'full_attack',
    titleUA: 'Повна атака',
    descUA: 'Зібри всіх нападників',
    category: 'collection',
    icon: '⚡',
    progressFn: s => {
      const fwds = footballers.filter(f => f.position === 'FWD')
      return {
        current: fwds.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: fwds.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.position === 'FWD')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },

  // ── Team ─────────────────────────────────────────────────────────────────────
  {
    id: 'first_squad',
    titleUA: 'Перший склад',
    descUA: 'Заповни всі 11 позицій у складі',
    category: 'team',
    icon: '⚽',
    progressFn: s => ({
      current: s.squad.filter(Boolean).length,
      total: 11,
    }),
    condition: s => s.squad.filter(Boolean).length === 11,
  },
  {
    id: 'dream_chemistry',
    titleUA: 'Хімія мрії',
    descUA: 'Досягни 15 хімічних зв\'язків',
    category: 'team',
    icon: '🧪',
    condition: s => {
      const players = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballers.find(f => f.id === id)!)
        .filter(Boolean)
      let links = 0
      for (let i = 0; i < players.length; i++)
        for (let j = i + 1; j < players.length; j++)
          if (players[i].club === players[j].club || players[i].nationality === players[j].nationality)
            links++
      return links >= 15
    },
  },
  {
    id: 'elite_team',
    titleUA: 'Еліта',
    descUA: 'Досягни загального рейтингу складу 85+',
    category: 'team',
    icon: '🌟',
    condition: s => {
      const players = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballers.find(f => f.id === id)!)
        .filter(Boolean)
      if (players.length === 0) return false
      const overall = Math.round(
        players.reduce((sum, f) =>
          sum + Math.round((f.stats.pace + f.stats.shooting + f.stats.passing + f.stats.dribbling) / 4), 0
        ) / players.length
      )
      return overall >= 85
    },
  },
  {
    id: 'all_positions',
    titleUA: 'Повний склад',
    descUA: 'Постав хоча б одного гравця на кожну позицію',
    category: 'team',
    icon: '🗺️',
    condition: s => {
      const positionsInSquad = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballers.find(f => f.id === id)?.position)
        .filter(Boolean)
      return ['GK', 'DEF', 'MID', 'FWD'].every(pos => positionsInSquad.includes(pos as any))
    },
  },
]

/** Returns IDs of achievements that are now unlocked but not yet recorded. */
export function checkAchievements(state: AppState): string[] {
  return ACHIEVEMENTS
    .filter(a => !state.achievements[a.id] && a.condition(state))
    .map(a => a.id)
}
```

**Step 2: Wire checkAchievements into store actions**

In `src/store/useAppStore.ts`, import `checkAchievements`:

```ts
import { checkAchievements } from '../lib/achievements'
```

At the end of `completeHabit`, after the `set(...)` call, add a check. Change `completeHabit` to:

```ts
completeHabit: (id) => {
  set(state => {
    const habit = state.habits.find(h => h.id === id)
    if (!habit || isCompletedToday(habit.lastCompleted)) return state

    const newStreak = calculateNewStreak(habit.streak, habit.lastCompleted)
    const multiplier = streakMultiplier(newStreak)
    const earned = Math.round(habit.coinValue * multiplier)

    return {
      coins: state.coins + earned,
      totalCompletions: state.totalCompletions + 1,
      habits: state.habits.map(h =>
        h.id === id
          ? { ...h, streak: newStreak, lastCompleted: getToday() }
          : h
      ),
    }
  })
  // Check achievements after state settles
  const newUnlocks = checkAchievements(get())
  for (const achievementId of newUnlocks) {
    get().unlockAchievement(achievementId)
  }
},
```

Do the same pattern for `buyPack` — append after the `set({...})` call:

```ts
const newUnlocks = checkAchievements(get())
for (const achievementId of newUnlocks) {
  get().unlockAchievement(achievementId)
}
return { refund, newCards }
```

And for `setSquadSlot`:

```ts
setSquadSlot: (slotIndex, footballerId) => {
  set(state => {
    const squad = [...(state.squad ?? Array(11).fill(null))]
    squad[slotIndex] = footballerId
    return { squad }
  })
  const newUnlocks = checkAchievements(get())
  for (const achievementId of newUnlocks) {
    get().unlockAchievement(achievementId)
  }
},
```

**Step 3: Build and verify no TypeScript errors**

Run: `npm run build`
Expected: clean build

**Step 4: Commit**

```bash
git add src/lib/achievements.ts src/store/useAppStore.ts
git commit -m "feat: add achievement definitions and checker wired into store"
```

---

### Task 3: Add achievement unlock sound

**Files:**
- Modify: `src/lib/sounds.ts`

**Step 1: Add playAchievementUnlock() after the existing exports**

Triumphant fanfare: rising three-note arpeggio (C5→E5→G5) on sine, then a warm chord bloom, then a short sparkle. Should feel distinct from card sounds — more "reward unlocked" than "got a card".

```ts
// ─── Achievement unlock: triumphant fanfare ───────────────────────────────────
// Rising arpeggio C5→E5→G5, then a warm chord bloom + sparkle.
export function playAchievementUnlock() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // Rising arpeggio
    const arpeggioFreqs = [523.25, 659.26, 783.99] // C5, E5, G5
    arpeggioFreqs.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const og = vol(ac)
      osc.connect(og); og.connect(ac.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const s = t + i * 0.1
      og.gain.setValueAtTime(0, s)
      og.gain.linearRampToValueAtTime(0.2, s + 0.01)
      og.gain.exponentialRampToValueAtTime(0.001, s + 0.35)
      osc.start(s); osc.stop(s + 0.4)
    })

    // Warm chord bloom at the end of the arpeggio
    const chordFreqs = [523.25, 659.26, 783.99, 1046.5] // C5 E5 G5 C6
    chordFreqs.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const og = vol(ac)
      osc.connect(og); og.connect(ac.destination)
      osc.type = i < 2 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      const s = t + 0.28
      og.gain.setValueAtTime(0, s)
      og.gain.linearRampToValueAtTime(0.12 - i * 0.02, s + 0.02)
      og.gain.exponentialRampToValueAtTime(0.001, s + 0.8)
      osc.start(s); osc.stop(s + 0.85)
    })

    // Short sparkle
    const sparkFreqs = [2093, 2637, 3136]
    sparkFreqs.forEach((f, i) => {
      const osc = ac.createOscillator()
      const og = vol(ac)
      osc.connect(og); og.connect(ac.destination)
      osc.type = 'sine'
      osc.frequency.value = f
      const s = t + 0.3 + i * 0.04
      og.gain.setValueAtTime(0, s)
      og.gain.linearRampToValueAtTime(0.07, s + 0.008)
      og.gain.exponentialRampToValueAtTime(0.001, s + 0.3)
      osc.start(s); osc.stop(s + 0.35)
    })
  } catch (_) { /* audio blocked */ }
}
```

**Step 2: Commit**

```bash
git add src/lib/sounds.ts
git commit -m "feat: add playAchievementUnlock sound effect"
```

---

### Task 4: Create AchievementToast component + global manager

**Files:**
- Create: `src/components/ui/AchievementToast.tsx`

**Step 1: Create the toast component**

This component lives in `App.tsx` and polls `pendingUnlocks` from the store on an interval, displaying one toast at a time.

```tsx
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { ACHIEVEMENTS } from '../../lib/achievements'
import { playAchievementUnlock } from '../../lib/sounds'

export function AchievementToastManager() {
  const drainPendingUnlock = useAppStore(state => state.drainPendingUnlock)
  const [current, setCurrent] = useState<{ id: string; titleUA: string; icon: string } | null>(null)
  const [queue, setQueue] = useState<string[]>([])

  // Drain store into local queue
  useEffect(() => {
    const interval = setInterval(() => {
      const id = drainPendingUnlock()
      if (id) setQueue(q => [...q, id])
    }, 300)
    return () => clearInterval(interval)
  }, [drainPendingUnlock])

  // Show next from queue when idle
  useEffect(() => {
    if (current || queue.length === 0) return
    const [next, ...rest] = queue
    setQueue(rest)
    const def = ACHIEVEMENTS.find(a => a.id === next)
    if (!def) return
    setCurrent({ id: next, titleUA: def.titleUA, icon: def.icon })
    playAchievementUnlock()
    setTimeout(() => setCurrent(null), 4000)
  }, [current, queue])

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -60, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-[#0D1520] border border-[#00E676]/40 rounded-2xl px-4 py-3 shadow-2xl max-w-xs"
        >
          <div className="text-2xl shrink-0">{current.icon}</div>
          <div>
            <div className="text-[10px] text-[#00E676] uppercase tracking-widest font-oswald">
              Досягнення розблоковано!
            </div>
            <div className="font-oswald font-bold text-white text-sm">{current.titleUA}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Step 2: Add AchievementToastManager to App.tsx**

In `src/App.tsx`, import and render inside the root div, before `<NavBar />`:

```tsx
import { AchievementToastManager } from './components/ui/AchievementToast'

// Inside App():
<div className="min-h-screen bg-[#04060A] stadium-lines">
  <AchievementToastManager />
  <NavBar />
  <Routes>
    ...
  </Routes>
</div>
```

**Step 3: Build verify**

Run: `npm run build`
Expected: clean

**Step 4: Commit**

```bash
git add src/components/ui/AchievementToast.tsx src/App.tsx
git commit -m "feat: add achievement toast notification with sound"
```

---

### Task 5: Create Achievements page

**Files:**
- Create: `src/pages/Achievements.tsx`

**Step 1: Create the page**

```tsx
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ACHIEVEMENTS } from '../lib/achievements'
import { CoinDisplay } from '../components/ui/CoinDisplay'
import type { AppState } from '../types'

type Category = 'habits' | 'collection' | 'team' | 'all'

const TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'habits', label: 'Звички' },
  { key: 'collection', label: 'Колекція' },
  { key: 'team', label: 'Команда' },
]

const categoryColors: Record<string, string> = {
  habits: 'text-[#00E676] border-[#00E676]',
  collection: 'text-yellow-400 border-yellow-400',
  team: 'text-blue-400 border-blue-400',
}

export function Achievements() {
  const state = useAppStore(s => s) as AppState & { achievements: Record<string, { unlockedAt: string }> }
  const [tab, setTab] = useState<Category>('all')

  const filtered = ACHIEVEMENTS.filter(a => tab === 'all' || a.category === tab)
  const totalUnlocked = Object.keys(state.achievements).length
  const total = ACHIEVEMENTS.length

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · Досягнення ·
          </div>
          <h1 className="font-oswald text-3xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Трофеї
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">
            {totalUnlocked} / {total} розблоковано
          </p>
        </div>
        <CoinDisplay />
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#1A2336] rounded-full overflow-hidden mb-6">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.round((totalUnlocked / total) * 100)}%`,
            background: 'linear-gradient(90deg, #0EA5E9, #00E676)',
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0A0F1A] border border-[#1A2336] rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg font-oswald font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-[#00E676] text-[#04060A]'
                : 'text-[#5A7090] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(a => {
          const unlocked = !!state.achievements[a.id]
          const progress = a.progressFn?.(state as any)

          return (
            <div
              key={a.id}
              className={`flex items-center gap-4 rounded-2xl border px-4 py-4 transition-all ${
                unlocked
                  ? 'bg-[#0A1A12] border-[#00E676]/30'
                  : 'bg-[#0A0F1A] border-[#1A2336] opacity-60'
              }`}
            >
              <div className={`text-3xl shrink-0 ${!unlocked && 'grayscale opacity-40'}`}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-oswald font-bold text-sm ${unlocked ? 'text-white' : 'text-[#3A4A5A]'}`}>
                  {a.titleUA}
                </div>
                <div className="text-xs text-[#5A7090] mt-0.5">
                  {unlocked ? a.descUA : '???'}
                </div>
                {progress && !unlocked && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-[#5A7090] mb-1">
                      <span>{progress.current} / {progress.total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1A2336] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#00E676]/60"
                        style={{ width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
                {unlocked && state.achievements[a.id] && (
                  <div className="text-[10px] text-[#00E676]/60 mt-1">
                    {new Date(state.achievements[a.id].unlockedAt).toLocaleDateString('uk-UA')}
                  </div>
                )}
              </div>
              {unlocked && (
                <div className="shrink-0 w-6 h-6 rounded-full bg-[#00E676]/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#00E676]" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Add route and nav link in App.tsx**

Import the page:
```ts
import { Achievements } from './pages/Achievements'
```

Add route inside `<Routes>`:
```tsx
<Route path="/achievements" element={<Achievements />} />
```

Add nav link in `NavBar` after the Team link:
```tsx
<NavLink to="/achievements" className={linkClass}>Досягнення</NavLink>
```

**Step 3: Run dev and verify manually**

Run: `npm run dev`
- Navigate to `/achievements` — should show all achievements, mostly locked
- Complete a habit on Dashboard — should unlock "Перший крок" and show toast
- Check Achievements page shows it unlocked with date

**Step 4: Commit**

```bash
git add src/pages/Achievements.tsx src/App.tsx
git commit -m "feat: add Achievements page with progress tracking and nav link"
```

---

## Phase 2 — Team Page

---

### Task 6: Create formation definitions

**Files:**
- Create: `src/lib/formations.ts`

**Step 1: Create the file**

```ts
import type { Position } from '../types'

export interface FormationSlot {
  pos: Position
  x: number  // % from left
  y: number  // % from top
}

export interface FormationDef {
  label: string
  slots: FormationSlot[]
}

export const FORMATIONS: Record<string, FormationDef> = {
  '4-3-3': {
    label: '4–3–3',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 17, y: 70 }, { pos: 'DEF', x: 37, y: 70 },
      { pos: 'DEF', x: 63, y: 70 }, { pos: 'DEF', x: 83, y: 70 },
      { pos: 'MID', x: 22, y: 51 }, { pos: 'MID', x: 50, y: 46 }, { pos: 'MID', x: 78, y: 51 },
      { pos: 'FWD', x: 18, y: 27 }, { pos: 'FWD', x: 50, y: 18 }, { pos: 'FWD', x: 82, y: 27 },
    ],
  },
  '4-4-2': {
    label: '4–4–2',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 17, y: 70 }, { pos: 'DEF', x: 37, y: 70 },
      { pos: 'DEF', x: 63, y: 70 }, { pos: 'DEF', x: 83, y: 70 },
      { pos: 'MID', x: 15, y: 50 }, { pos: 'MID', x: 38, y: 50 },
      { pos: 'MID', x: 62, y: 50 }, { pos: 'MID', x: 85, y: 50 },
      { pos: 'FWD', x: 35, y: 22 }, { pos: 'FWD', x: 65, y: 22 },
    ],
  },
  '3-5-2': {
    label: '3–5–2',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 25, y: 70 }, { pos: 'DEF', x: 50, y: 70 }, { pos: 'DEF', x: 75, y: 70 },
      { pos: 'MID', x: 10, y: 50 }, { pos: 'MID', x: 28, y: 50 },
      { pos: 'MID', x: 50, y: 46 },
      { pos: 'MID', x: 72, y: 50 }, { pos: 'MID', x: 90, y: 50 },
      { pos: 'FWD', x: 35, y: 22 }, { pos: 'FWD', x: 65, y: 22 },
    ],
  },
  '4-2-3-1': {
    label: '4–2–3–1',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 17, y: 70 }, { pos: 'DEF', x: 37, y: 70 },
      { pos: 'DEF', x: 63, y: 70 }, { pos: 'DEF', x: 83, y: 70 },
      { pos: 'MID', x: 35, y: 57 }, { pos: 'MID', x: 65, y: 57 },
      { pos: 'MID', x: 18, y: 40 }, { pos: 'MID', x: 50, y: 38 }, { pos: 'MID', x: 82, y: 40 },
      { pos: 'FWD', x: 50, y: 20 },
    ],
  },
  '5-3-2': {
    label: '5–3–2',
    slots: [
      { pos: 'GK',  x: 50, y: 86 },
      { pos: 'DEF', x: 10, y: 72 }, { pos: 'DEF', x: 28, y: 70 },
      { pos: 'DEF', x: 50, y: 70 },
      { pos: 'DEF', x: 72, y: 70 }, { pos: 'DEF', x: 90, y: 72 },
      { pos: 'MID', x: 22, y: 51 }, { pos: 'MID', x: 50, y: 46 }, { pos: 'MID', x: 78, y: 51 },
      { pos: 'FWD', x: 35, y: 22 }, { pos: 'FWD', x: 65, y: 22 },
    ],
  },
}

export const FORMATION_KEYS = Object.keys(FORMATIONS)
```

**Step 2: Commit**

```bash
git add src/lib/formations.ts
git commit -m "feat: add formation definitions (4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 5-3-2)"
```

---

### Task 7: Create chemistry bonuses lib

**Files:**
- Create: `src/lib/bonuses.ts`

**Step 1: Create the file**

```ts
import { footballers } from '../data/footballers'
import type { AppState } from '../types'

export interface BonusEntry {
  label: string
  percent: number
}

export function computeActiveBonuses(state: AppState): BonusEntry[] {
  const squadPlayers = (state.squad ?? [])
    .filter((id): id is string => id !== null)
    .map(id => footballers.find(f => f.id === id))
    .filter(Boolean) as typeof footballers

  if (squadPlayers.length === 0) return []

  const bonuses: BonusEntry[] = []

  // Count by club
  const clubCounts = new Map<string, number>()
  for (const p of squadPlayers) {
    clubCounts.set(p.club, (clubCounts.get(p.club) ?? 0) + 1)
  }
  for (const [club, count] of clubCounts) {
    if (count >= 3) {
      const pct = count >= 5 ? 10 : 6
      bonuses.push({ label: `${count}× ${club}`, percent: pct })
    } else if (count === 2) {
      bonuses.push({ label: `2× ${club}`, percent: 3 })
    }
  }

  // Count by nationality
  const natCounts = new Map<string, number>()
  for (const p of squadPlayers) {
    natCounts.set(p.nationality, (natCounts.get(p.nationality) ?? 0) + 1)
  }
  for (const [nat, count] of natCounts) {
    if (count >= 3) {
      const pct = count >= 5 ? 8 : 5
      bonuses.push({ label: `${count}× ${nat}`, percent: pct })
    } else if (count === 2) {
      bonuses.push({ label: `2× ${nat}`, percent: 2 })
    }
  }

  return bonuses
}

export function totalBonusPercent(bonuses: BonusEntry[]): number {
  const total = bonuses.reduce((sum, b) => sum + b.percent, 0)
  return Math.min(total, 40) // cap at 40%
}
```

**Step 2: Wire bonuses into completeHabit in useAppStore.ts**

Import at top:
```ts
import { computeActiveBonuses, totalBonusPercent } from '../lib/bonuses'
```

Update `completeHabit` to apply bonus:

```ts
completeHabit: (id) => {
  set(state => {
    const habit = state.habits.find(h => h.id === id)
    if (!habit || isCompletedToday(habit.lastCompleted)) return state

    const newStreak = calculateNewStreak(habit.streak, habit.lastCompleted)
    const multiplier = streakMultiplier(newStreak)
    const baseCoin = Math.round(habit.coinValue * multiplier)

    const bonuses = computeActiveBonuses(state)
    const bonusPct = totalBonusPercent(bonuses)
    const earned = Math.round(baseCoin * (1 + bonusPct / 100))

    return {
      coins: state.coins + earned,
      totalCompletions: state.totalCompletions + 1,
      habits: state.habits.map(h =>
        h.id === id
          ? { ...h, streak: newStreak, lastCompleted: getToday() }
          : h
      ),
    }
  })
  const newUnlocks = checkAchievements(get())
  for (const achievementId of newUnlocks) {
    get().unlockAchievement(achievementId)
  }
},
```

**Step 3: Build verify**

Run: `npm run build`
Expected: clean

**Step 4: Commit**

```bash
git add src/lib/bonuses.ts src/store/useAppStore.ts
git commit -m "feat: add chemistry bonuses lib and wire into habit completion coin calc"
```

---

### Task 8: Rewrite Team page with all improvements

**Files:**
- Modify: `src/pages/Team.tsx`

This is a full rewrite of Team.tsx. The new version adds:
1. Formation switcher with confirm dialog on switch
2. Player stat overlay (click filled slot → show stats panel instead of picker)
3. Chemistry bonuses panel showing active bonuses and total %

**Step 1: Rewrite src/pages/Team.tsx**

Replace the entire file content:

```tsx
import { useState, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { footballers } from '../data/footballers'
import { CoinDisplay } from '../components/ui/CoinDisplay'
import { FORMATIONS, FORMATION_KEYS } from '../lib/formations'
import { computeActiveBonuses, totalBonusPercent } from '../lib/bonuses'
import type { Position } from '../types'

const POS_UA: Record<Position, string> = { GK: 'ВОР', DEF: 'ЗАХ', MID: 'ПЗА', FWD: 'НАП' }

const rarityRing: Record<string, string> = {
  common:    'ring-gray-400/70',
  rare:      'ring-blue-400/80',
  epic:      'ring-pink-500/80',
  legendary: 'ring-yellow-400/90',
}

const emptyBorder: Record<Position, string> = {
  GK:  'border-yellow-400/50 text-yellow-400/70',
  DEF: 'border-blue-400/50 text-blue-400/70',
  MID: 'border-green-400/50 text-green-400/70',
  FWD: 'border-red-400/50 text-red-400/70',
}

function playerOverall(f: typeof footballers[0]) {
  return Math.round((f.stats.pace + f.stats.shooting + f.stats.passing + f.stats.dribbling) / 4)
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#5A7090] w-16 shrink-0 font-oswald uppercase">{label}</span>
      <div className="flex-1 h-1.5 bg-[#1A2336] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[#00E676]"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-white w-6 text-right">{value}</span>
    </div>
  )
}

function PitchSVG() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {[0,1,2,3,4,5,6,7].map(i => (
        <rect key={i} x="0" y={i * 50} width="300" height="50"
          fill={i % 2 === 0 ? 'transparent' : 'black'} fillOpacity="0.06" />
      ))}
      <rect x="12" y="12" width="276" height="376" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
      <line x1="12" y1="200" x2="288" y2="200" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="150" cy="200" r="46" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="150" cy="200" r="2.5" fill="white" fillOpacity="0.3" />
      <rect x="72" y="12" width="156" height="64" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="108" y="12" width="84" height="26" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      <rect x="126" y="6" width="48" height="12" stroke="white" strokeOpacity="0.18" strokeWidth="1" />
      <rect x="72" y="324" width="156" height="64" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="108" y="362" width="84" height="26" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      <rect x="126" y="382" width="48" height="12" stroke="white" strokeOpacity="0.18" strokeWidth="1" />
      <circle cx="150" cy="88" r="2.5" fill="white" fillOpacity="0.3" />
      <circle cx="150" cy="312" r="2.5" fill="white" fillOpacity="0.3" />
      <path d="M 100 76 A 50 50 0 0 0 200 76" stroke="white" strokeOpacity="0.12" strokeWidth="1" fill="none" />
      <path d="M 100 324 A 50 50 0 0 1 200 324" stroke="white" strokeOpacity="0.12" strokeWidth="1" fill="none" />
    </svg>
  )
}

function PlayerPhoto({ footballer }: { footballer: typeof footballers[0] }) {
  return footballer.photoUrl ? (
    <img
      src={`${import.meta.env.BASE_URL}${footballer.photoUrl.replace(/^\//, '')}`}
      alt={footballer.name}
      className="w-full h-full object-contain"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-lg">{footballer.emoji}</div>
  )
}

type PanelMode = 'idle' | 'pick' | 'stats'

export function Team() {
  const squad = useAppStore(state => state.squad ?? Array(11).fill(null))
  const formation = useAppStore(state => state.formation ?? '4-3-3')
  const setSquadSlot = useAppStore(state => state.setSquadSlot)
  const setFormation = useAppStore(state => state.setFormation)
  const collection = useAppStore(state => state.collection)
  const state = useAppStore(s => s)

  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>('idle')

  const formationDef = FORMATIONS[formation] ?? FORMATIONS['4-3-3']
  const SLOTS = formationDef.slots

  const ownedIds = useMemo(
    () => new Set(Object.keys(collection).filter(id => (collection[id] ?? 0) > 0)),
    [collection]
  )

  const filledPlayers = useMemo(() =>
    squad
      .filter((id): id is string => id !== null)
      .map(id => footballers.find(f => f.id === id)!)
      .filter(Boolean),
    [squad]
  )

  const teamOverall = useMemo(() => {
    if (filledPlayers.length === 0) return 0
    return Math.round(filledPlayers.reduce((s, f) => s + playerOverall(f), 0) / filledPlayers.length)
  }, [filledPlayers])

  const activeBonuses = useMemo(() => computeActiveBonuses(state as any), [state])
  const bonusPct = totalBonusPercent(activeBonuses)

  const activeSlotDef = activeSlot !== null ? SLOTS[activeSlot] : null

  const pickerPlayers = useMemo(() => {
    if (!activeSlotDef) return []
    return footballers
      .filter(f => f.position === activeSlotDef.pos && ownedIds.has(f.id))
      .sort((a, b) => playerOverall(b) - playerOverall(a))
  }, [activeSlotDef, ownedIds])

  function handleSlotClick(idx: number) {
    const footballerId = squad[idx] ?? null
    if (footballerId) {
      setActiveSlot(idx)
      setPanelMode('stats')
    } else {
      setActiveSlot(prev => prev === idx ? null : idx)
      setPanelMode(activeSlot === idx ? 'idle' : 'pick')
    }
  }

  function handleSelectPlayer(footballerId: string) {
    if (activeSlot === null) return
    setSquadSlot(activeSlot, footballerId)
    setActiveSlot(null)
    setPanelMode('idle')
  }

  function handleRemovePlayer(idx: number, e: React.MouseEvent) {
    e.stopPropagation()
    setSquadSlot(idx, null)
    if (activeSlot === idx) { setActiveSlot(null); setPanelMode('idle') }
  }

  function handleFormationChange(newFormation: string) {
    if (newFormation === formation) return
    const hasPlayers = squad.some(Boolean)
    if (hasPlayers && !window.confirm('Зміна схеми скине склад. Продовжити?')) return
    setFormation(newFormation)
    setActiveSlot(null)
    setPanelMode('idle')
  }

  const activePlayer = activeSlot !== null && panelMode === 'stats'
    ? footballers.find(f => f.id === squad[activeSlot]) ?? null
    : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · {FORMATIONS[formation]?.label ?? formation} ·
          </div>
          <h1 className="font-oswald text-3xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Склад
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">{filledPlayers.length} / 11 гравців</p>
        </div>
        <CoinDisplay />
      </div>

      {/* Formation switcher */}
      <div className="flex gap-1 mb-4 bg-[#0A0F1A] border border-[#1A2336] rounded-xl p-1 overflow-x-auto">
        {FORMATION_KEYS.map(key => (
          <button
            key={key}
            onClick={() => handleFormationChange(key)}
            className={`flex-1 min-w-fit py-1.5 px-2 rounded-lg font-oswald font-bold text-xs tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              formation === key
                ? 'bg-[#00E676] text-[#04060A]'
                : 'text-[#5A7090] hover:text-white'
            }`}
          >
            {FORMATIONS[key].label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="font-oswald text-3xl font-bold text-[#00E676]">
            {teamOverall || '—'}
          </div>
          <div>
            <div className="text-[10px] text-[#5A7090] uppercase tracking-wider">Загальний</div>
            <div className="text-xs text-white font-semibold">рейтинг</div>
          </div>
        </div>
        <div className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="font-oswald text-3xl font-bold text-[#FBBF24]">
            {bonusPct > 0 ? `+${bonusPct}%` : '—'}
          </div>
          <div>
            <div className="text-[10px] text-[#5A7090] uppercase tracking-wider">Хімія</div>
            <div className="text-xs text-white font-semibold">бонус монет</div>
          </div>
        </div>
        <div className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="font-oswald text-3xl font-bold text-[#A78BFA]">
            {filledPlayers.length}
          </div>
          <div>
            <div className="text-[10px] text-[#5A7090] uppercase tracking-wider">Складено</div>
            <div className="text-xs text-white font-semibold">гравців</div>
          </div>
        </div>
      </div>

      {/* Active bonuses panel */}
      {activeBonuses.length > 0 && (
        <div className="mb-4 bg-[#0A0F1A] border border-[#FBBF24]/20 rounded-xl px-4 py-3">
          <div className="text-[10px] text-[#5A7090] uppercase tracking-wider mb-2 font-oswald">Активні бонуси</div>
          <div className="flex flex-wrap gap-2">
            {activeBonuses.map((b, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-lg px-2 py-1">
                <span className="text-[10px] text-[#5A7090]">{b.label}</span>
                <span className="text-[10px] font-oswald font-bold text-[#FBBF24]">+{b.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Pitch */}
        <div className="w-full lg:w-1/2 max-w-[480px] mx-auto lg:mx-0 shrink-0">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{
              aspectRatio: '3/4',
              background: 'linear-gradient(180deg, #1b6133 0%, #1e6b38 45%, #1a5c30 55%, #196030 100%)',
            }}
          >
            <PitchSVG />
            {SLOTS.map((slot, idx) => {
              const footballerId = squad[idx] ?? null
              const footballer = footballerId ? footballers.find(f => f.id === footballerId) ?? null : null
              const isActive = activeSlot === idx

              return (
                <div
                  key={idx}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 cursor-pointer z-10"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  onClick={() => handleSlotClick(idx)}
                >
                  {footballer ? (
                    <div className="flex flex-col items-center gap-0.5 group">
                      <div
                        className={`relative w-16 h-16 rounded-full ring-2 overflow-hidden bg-[#0A0F1A] transition-all ${rarityRing[footballer.rarity]} ${isActive ? '!ring-[#00E676] scale-110' : 'hover:scale-105'}`}
                      >
                        <PlayerPhoto footballer={footballer} />
                        <button
                          onClick={(e) => handleRemovePlayer(idx, e)}
                          className="absolute inset-0 bg-red-900/85 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-base cursor-pointer"
                        >×</button>
                      </div>
                      <div className="text-[11px] text-white/85 font-bold leading-none max-w-[4.5rem] text-center truncate drop-shadow">
                        {footballer.name.split(' ').slice(-1)[0]}
                      </div>
                      <div className="text-[11px] font-oswald font-bold text-[#00E676] leading-none drop-shadow">
                        {playerOverall(footballer)}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${emptyBorder[slot.pos]} ${isActive ? 'bg-white/20 scale-110' : 'bg-black/25 hover:bg-white/10 hover:scale-105'}`}
                    >
                      <span className="text-xs font-oswald font-bold">{POS_UA[slot.pos]}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Formation legend */}
          <div className="flex justify-center gap-4 mt-3 text-[10px]">
            {(['GK','DEF','MID','FWD'] as Position[]).map(pos => {
              const colors = {
                GK:  'bg-yellow-400/20 text-yellow-300',
                DEF: 'bg-blue-400/20 text-blue-300',
                MID: 'bg-green-400/20 text-green-300',
                FWD: 'bg-red-400/20 text-red-300',
              }
              return (
                <div key={pos} className={`px-2 py-0.5 rounded font-oswald font-bold ${colors[pos]}`}>
                  {POS_UA[pos]}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-1/2">
          {/* Stats overlay */}
          {panelMode === 'stats' && activePlayer && (
            <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-[#5A7090] uppercase tracking-wider">Гравець</div>
                <button
                  onClick={() => { setActiveSlot(null); setPanelMode('idle') }}
                  className="w-8 h-8 flex items-center justify-center text-[#5A7090] hover:text-white hover:bg-[#1A2336] rounded-lg transition-colors text-xl cursor-pointer"
                >×</button>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-16 h-16 rounded-full ring-2 overflow-hidden bg-black/40 shrink-0 ${rarityRing[activePlayer.rarity]}`}>
                  <PlayerPhoto footballer={activePlayer} />
                </div>
                <div>
                  <div className="font-oswald font-bold text-white text-lg leading-tight">{activePlayer.name}</div>
                  <div className="text-xs text-[#5A7090]">{activePlayer.club} · {activePlayer.nationality}</div>
                  <div className="font-oswald font-bold text-[#00E676] text-xl mt-1">{playerOverall(activePlayer)}</div>
                </div>
              </div>
              <div className="space-y-2">
                <StatBar label="Швидкість" value={activePlayer.stats.pace} />
                <StatBar label="Удар" value={activePlayer.stats.shooting} />
                <StatBar label="Пас" value={activePlayer.stats.passing} />
                <StatBar label="Дриблінг" value={activePlayer.stats.dribbling} />
              </div>
              <button
                onClick={() => { if (activeSlot !== null) { setSquadSlot(activeSlot, null); setActiveSlot(null); setPanelMode('idle') } }}
                className="mt-4 w-full py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-oswald font-bold uppercase tracking-wider hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                Видалити зі складу
              </button>
            </div>
          )}

          {/* Player picker */}
          {panelMode === 'pick' && activeSlot !== null && (
            <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-[#5A7090] uppercase tracking-wider">Вибери гравця</div>
                  <div className="font-oswald text-lg font-bold text-white">
                    {POS_UA[SLOTS[activeSlot].pos]}
                    <span className="text-[#5A7090] font-normal text-base ml-2">— позиція {activeSlot + 1}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveSlot(null); setPanelMode('idle') }}
                  className="w-8 h-8 flex items-center justify-center text-[#5A7090] hover:text-white hover:bg-[#1A2336] rounded-lg transition-colors text-xl cursor-pointer"
                >×</button>
              </div>

              {pickerPlayers.length === 0 ? (
                <div className="text-center py-10 text-[#5A7090]">
                  <div className="text-4xl mb-3">🔒</div>
                  <div className="font-oswald text-sm text-white">Немає карток на цю позицію</div>
                  <div className="text-xs mt-1">Купи пакети, щоб отримати гравців</div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {pickerPlayers.map(f => {
                    const inSquad = squad.includes(f.id)
                    const overall = playerOverall(f)
                    return (
                      <button
                        key={f.id}
                        disabled={inSquad}
                        onClick={() => handleSelectPlayer(f.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-left ${
                          inSquad
                            ? 'border-[#1A2336] opacity-35 cursor-not-allowed'
                            : 'border-[#1A2336] hover:border-[#00E676]/60 hover:bg-[#00E676]/5 cursor-pointer active:scale-95'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-full overflow-hidden bg-black/40 ring-1 ${rarityRing[f.rarity]}`}>
                          <PlayerPhoto footballer={f} />
                        </div>
                        <div className="text-[10px] font-bold text-center leading-tight text-white/90 w-full truncate">
                          {f.name.split(' ').slice(-1)[0]}
                        </div>
                        <div className="text-[10px] font-oswald font-bold text-[#00E676]">{overall}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Idle: squad summary */}
          {panelMode === 'idle' && (
            <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">⚽</div>
              <div className="font-oswald text-lg font-bold text-white mb-1">Вибери позицію</div>
              <div className="text-sm text-[#5A7090]">Натисни на порожній слот щоб додати гравця, або на гравця щоб побачити статистику</div>

              {filledPlayers.length > 0 && (
                <div className="mt-6 space-y-2 text-left">
                  <div className="text-xs text-[#5A7090] uppercase tracking-wider mb-3 font-oswald">Склад</div>
                  {SLOTS.map((slot, idx) => {
                    const id = squad[idx] ?? null
                    const f = id ? footballers.find(p => p.id === id) ?? null : null
                    if (!f) return null
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-[#0D1520] rounded-xl px-3 py-2">
                        <div className={`w-8 h-8 rounded-full ring-1 overflow-hidden bg-black/40 shrink-0 ${rarityRing[f.rarity]}`}>
                          <PlayerPhoto footballer={f} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{f.name}</div>
                          <div className="text-[10px] text-[#5A7090]">{f.club}</div>
                        </div>
                        <div className="font-oswald font-bold text-sm text-[#00E676]">{playerOverall(f)}</div>
                        <div className="text-[10px] font-bold text-[#5A7090] font-oswald">{POS_UA[slot.pos]}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Add setFormation action to the store**

In `src/store/useAppStore.ts`, add to the interface:
```ts
setFormation: (formation: string) => void
```

Add the implementation:
```ts
setFormation: (formation) => {
  set({ formation, squad: Array(11).fill(null) })
},
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: clean build

**Step 4: Run dev and manually test**

Run: `npm run dev`
- Switch formations — squad should reset, pitch layout changes
- Click a filled slot → stats panel shows with bars
- Click "Видалити зі складу" → player removed, panel closes
- Click empty slot → picker opens as before
- Build squad with same-club players → chemistry bonus panel appears
- Complete habit → verify bonus % applies (check coin delta)

**Step 5: Commit**

```bash
git add src/pages/Team.tsx src/store/useAppStore.ts src/lib/formations.ts src/lib/bonuses.ts
git commit -m "feat: formation switcher, player stat overlay, and chemistry bonuses panel on Team page"
```

---

## Final verification

Run: `npm run build`

Manually test the full loop:
1. Complete a habit → "Перший крок" toast fires with sound
2. Open Achievements page → see it unlocked with date
3. Buy packs → collection achievements unlock
4. Go to Team, switch formation → squad resets
5. Fill squad with same-club players → chemistry bonuses show
6. Complete habit → see increased coins from bonus

---

## Done

All changes are backward-compatible with existing persisted store data. Old saves missing `achievements`, `totalCompletions`, `formation` will just get the defaults on next load.
