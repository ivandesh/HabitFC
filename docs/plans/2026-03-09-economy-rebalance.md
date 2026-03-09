# Economy Rebalance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebalance pack costs, rarity weights, card counts, duplicate refunds, and add a soft pity mechanic per pack type.

**Architecture:** Three small file changes — data constants in `packs.ts`, pity logic in `gacha.ts`, and pity counter state in `useAppStore.ts`. No UI changes needed; the Shop page reads pack data dynamically.

**Tech Stack:** React, TypeScript, Zustand (persist middleware)

---

### Task 1: Update pack definitions

**Files:**
- Modify: `src/data/packs.ts`

**Step 1: Replace the entire file contents**

```ts
import type { Pack } from '../types'

export const packs: Pack[] = [
  {
    id: 'basic',
    name: 'Базовий Пакет',
    cost: 200,
    cardCount: 3,
    weights: { common: 70, rare: 22, epic: 7, legendary: 1 },
  },
  {
    id: 'premium',
    name: 'Преміум Пакет',
    cost: 400,
    cardCount: 3,
    weights: { common: 50, rare: 33, epic: 14, legendary: 3 },
  },
  {
    id: 'elite',
    name: 'Еліт Пакет',
    cost: 750,
    cardCount: 3,
    weights: { common: 0, rare: 45, epic: 45, legendary: 10 },
  },
]
```

**Step 2: Verify in browser**

Run `npm run dev`. Open the Shop page. Confirm:
- Pack costs show 200 / 400 / 750
- All packs show "3 карти" (or however card count is displayed)

**Step 3: Commit**

```bash
git add src/data/packs.ts
git commit -m "feat: update pack costs and rarity weights"
```

---

### Task 2: Update duplicate refunds and add soft pity logic

**Files:**
- Modify: `src/lib/gacha.ts`

**Step 1: Replace the entire file contents**

```ts
import type { Footballer, Pack, Rarity } from '../types'
import { footballers } from '../data/footballers'

const PITY_THRESHOLD = 10   // packs without legendary before pity starts
const PITY_INCREMENT = 2    // % added per pack beyond threshold
const PITY_CAP = 50         // max legendary weight

function pickRarity(weights: Record<Rarity, number>, pityCounter: number): Rarity {
  const legendaryWeight = Math.min(
    weights.legendary + Math.max(0, pityCounter - PITY_THRESHOLD) * PITY_INCREMENT,
    PITY_CAP,
  )

  const entries: [Rarity, number][] = [
    ['common', weights.common],
    ['rare', weights.rare],
    ['epic', weights.epic],
    ['legendary', legendaryWeight],
  ]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = Math.random() * total
  for (const [rarity, weight] of entries) {
    roll -= weight
    if (roll <= 0) return rarity
  }
  return 'common'
}

function pickCard(rarity: Rarity): Footballer {
  const pool = footballers.filter(f => f.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Opens a pack and returns the cards plus the updated pity counter for this pack type. */
export function openPack(pack: Pack, pityCounter: number): { cards: Footballer[]; nextPityCounter: number } {
  const cards: Footballer[] = []
  let gotLegendary = false

  for (let i = 0; i < pack.cardCount; i++) {
    const rarity = pickRarity(pack.weights, pityCounter)
    if (rarity === 'legendary') gotLegendary = true
    cards.push(pickCard(rarity))
  }

  const nextPityCounter = gotLegendary ? 0 : pityCounter + 1
  return { cards, nextPityCounter }
}

export function duplicateRefund(rarity: Rarity): number {
  switch (rarity) {
    case 'common': return 10
    case 'rare': return 30
    case 'epic': return 80
    case 'legendary': return 200
  }
}
```

**Step 2: Fix the call site in PackOpening.tsx**

Search `src/pages/PackOpening.tsx` for where `openPack` is called. The signature changed from `openPack(pack)` to `openPack(pack, pityCounter)` returning `{ cards, nextPityCounter }`.

Find the call and update it to pass `0` as a temporary placeholder for pityCounter — this will be properly wired in Task 3.

Before (approximate):
```ts
const cards = openPack(pack)
```

After:
```ts
const { cards } = openPack(pack, 0)
```

**Step 3: Run dev server, check for TypeScript errors**

```bash
npm run dev
```

Expected: no red errors in the terminal. Open Pack Opening page and confirm a pack can still be opened.

**Step 4: Commit**

```bash
git add src/lib/gacha.ts src/pages/PackOpening.tsx
git commit -m "feat: add soft pity logic and update duplicate refunds"
```

---

### Task 3: Add pityCounters to store and wire into buyPack

**Files:**
- Modify: `src/store/useAppStore.ts`
- Modify: `src/types.ts`
- Modify: `src/pages/PackOpening.tsx`

**Step 1: Add pityCounters to the AppState type**

In `src/types.ts`, add one field to the `AppState` interface:

```ts
pityCounters: Record<string, number>  // keyed by pack id
```

Full updated interface (only showing the new line — add it after `pendingUnlocks`):
```ts
export interface AppState {
  coins: number
  habits: Habit[]
  collection: Record<string, number>
  pullHistory: { footballerId: string; pulledAt: string }[]
  squad: (string | null)[]
  achievements: Record<string, { unlockedAt: string }>
  totalCompletions: number
  formation: string
  pendingUnlocks: string[]
  pityCounters: Record<string, number>
}
```

**Step 2: Initialize pityCounters in the store**

In `src/store/useAppStore.ts`, add `pityCounters: {}` to the initial state (next to `pendingUnlocks: []`):

```ts
pendingUnlocks: [],
pityCounters: {},
```

Also add it to the `resetAll` call:
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
    pityCounters: {},
  })
},
```

**Step 3: Update buyPack signature and body**

Change the `buyPack` action signature in the interface and implementation to accept a `packId` and `nextPityCounter`:

Interface change (in `AppStore`):
```ts
buyPack: (cost: number, cards: Footballer[], packId: string, nextPityCounter: number) => { refund: number; newCards: string[]; newUnlockIds: string[] }
```

Implementation — add two lines inside the `set({...})` call in `buyPack`:
```ts
set({
  coins: state.coins - cost + refund,
  collection: newCollection,
  pullHistory,
  pityCounters: { ...state.pityCounters, [packId]: nextPityCounter },
})
```

**Step 4: Wire pityCounters in Shop.tsx**

NOTE: `openPack` is called in `src/pages/Shop.tsx`, NOT in PackOpening.tsx. PackOpening.tsx receives pre-rolled cards via router state. The wiring must happen in Shop.tsx, with nextPityCounter forwarded through router state to PackOpening.tsx.

In `src/pages/Shop.tsx`:

1. Read pityCounters from the store (add selector near other store reads):
```ts
const pityCounters = useAppStore(state => state.pityCounters)
```

2. Replace the current `openPack` call (which has a TODO comment) with:
```ts
const pityCounter = pityCounters[pack.id] ?? 0
const { cards, nextPityCounter } = openPack(pack, pityCounter)
```

3. Forward `nextPityCounter` and `pack.id` through the router state to PackOpening. Find the `navigate` call and add them:
```ts
navigate('/open', { state: { pack, cards, nextPityCounter } })
```

In `src/pages/PackOpening.tsx`:

4. Read `nextPityCounter` from router location state (next to where `pack` and `cards` are read):
```ts
const { pack, cards: initialCards, nextPityCounter } = location.state as {
  pack: Pack
  cards: Footballer[]
  nextPityCounter: number
}
```

5. Pass `pack.id` and `nextPityCounter` to `buyPack` (find the existing `buyPack(...)` call and update it):
```ts
buyPack(pack.cost, cards, pack.id, nextPityCounter)
```

**Step 5: Run dev server and full smoke test**

```bash
npm run dev
```

Check all of the following:
- Open a Basic pack — coins deduct 200, 3 cards appear
- Open a Premium pack — coins deduct 400
- Open an Elite pack — coins deduct 750
- Duplicate cards show a refund (check coin balance increases by refund amount)
- No TypeScript errors in terminal

**Step 6: Commit**

```bash
git add src/types.ts src/store/useAppStore.ts src/pages/Shop.tsx src/pages/PackOpening.tsx
git commit -m "feat: wire pity counters per pack type into store"
```

---

### Task 4: Final verification

**Step 1: Build check**

```bash
npm run build
```

Expected: build completes with no errors.

**Step 2: Commit if any lint fixes were needed, otherwise done**

```bash
git add -A
git commit -m "fix: resolve any build warnings from economy rebalance"
```

Only commit if there were actual changes. Skip if build was clean.
