# Multi-Team System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to create up to 5 named teams, each with its own squad/formation/coach, with one "active" team driving gameplay bonuses and battles.

**Architecture:** Add a `Team` interface and replace top-level `squad`/`formation`/`assignedCoach` in `AppState` with a `teams` array + `activeTeamId`. A `getActiveTeam()` helper centralizes resolution. All consumers migrate from `state.squad` to `getActiveTeam(state).squad`. Old single-team state is auto-migrated in `importState`.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-24-multi-team-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types.ts` | Modify | Add `Team` interface, update `AppState` |
| `src/lib/teamHelpers.ts` | Create | `getActiveTeam()`, `migrateOldState()`, `createDefaultTeam()` |
| `src/store/useAppStore.ts` | Modify | New team actions, update existing actions, migration |
| `src/lib/bonuses.ts` | Modify | Resolve squad from active team |
| `src/lib/coachPerks.ts` | Modify | Resolve coach + squad from active team |
| `src/lib/achievements.ts` | Modify | Update lambdas to use `getActiveTeam()` |
| `src/components/habits/HabitCard.tsx` | Modify | Resolve squad/coach from active team |
| `src/hooks/useBattle.ts` | Modify | Build snapshot from active team, handle friend migration |
| `src/pages/Achievements.tsx` | Modify | Pass `teams`/`activeTeamId` instead of old fields |
| `src/pages/FriendProfile.tsx` | Modify | Handle old/new state format |
| `src/pages/Team.tsx` | Modify | Add team tabs, CRUD, scoped to viewed team |

---

### Task 1: Add Team type and update AppState

**Files:**
- Modify: `src/types.ts:34-51`

- [ ] **Step 1: Add Team interface and update AppState**

In `src/types.ts`, add the `Team` interface before `AppState` and replace the three removed fields:

```typescript
export interface Team {
  id: string
  name: string
  squad: (string | null)[]
  formation: string
  assignedCoach: string | null
}
```

In `AppState`, remove `squad`, `formation`, `assignedCoach` and add:

```typescript
  teams: Team[]
  activeTeamId: string
```

- [ ] **Step 2: Create teamHelpers.ts**

```typescript
import type { Team, AppState } from '../types'

export function getActiveTeam(state: Pick<AppState, 'teams' | 'activeTeamId'>): Team {
  return state.teams.find(t => t.id === state.activeTeamId) ?? state.teams[0]
}

export function createDefaultTeam(name = 'Команда 1'): Team {
  return {
    id: crypto.randomUUID(),
    name,
    squad: Array(11).fill(null),
    formation: '4-3-3',
    assignedCoach: null,
  }
}

/**
 * Migrate old single-team state format to multi-team.
 * Returns { teams, activeTeamId } if migration needed, null otherwise.
 */
export function migrateOldState(data: Record<string, unknown>): { teams: Team[]; activeTeamId: string } | null {
  if (Array.isArray(data.teams) && data.teams.length > 0) return null

  const squad = (data.squad as (string | null)[] | undefined) ?? Array(11).fill(null)
  const formation = (data.formation as string | undefined) ?? '4-3-3'
  const assignedCoach = (data.assignedCoach as string | null | undefined) ?? null

  const team: Team = {
    id: crypto.randomUUID(),
    name: 'Команда 1',
    squad,
    formation,
    assignedCoach,
  }

  return { teams: [team], activeTeamId: team.id }
}

export function findTeam(teams: Team[], teamId: string): Team | undefined {
  return teams.find(t => t.id === teamId)
}

export function updateTeamInArray(teams: Team[], teamId: string, patch: Partial<Team>): Team[] {
  return teams.map(t => t.id === teamId ? { ...t, ...patch } : t)
}
```

- [ ] **Step 3: Update bonuses.ts — change computeActiveBonuses to accept a squad array directly**

The function currently takes `AppState` and reads `state.squad`. Change it to accept the squad directly — this is simpler and decouples it from state shape:

```typescript
import { footballerMap } from '../data/footballers'
import type { Footballer } from '../types'

export interface BonusEntry {
  label: string
  percent: number
}

export function computeActiveBonuses(squad: (string | null)[]): BonusEntry[] {
  const squadPlayers = squad
    .filter((id): id is string => id !== null)
    .map(id => footballerMap.get(id))
    .filter((f): f is Footballer => f !== undefined)

  if (squadPlayers.length === 0) return []

  // ... rest unchanged ...
}
```

- [ ] **Step 4: Update coachPerks.ts — change getAssignedCoach to accept a coach ID string**

Change from:

```typescript
export function getAssignedCoach(state: Pick<AppState, 'assignedCoach'>): Coach | null {
  if (!state.assignedCoach) return null
  return coaches.find((c: Coach) => c.id === state.assignedCoach) ?? null
}
```

To:

```typescript
export function getAssignedCoach(assignedCoachId: string | null): Coach | null {
  if (!assignedCoachId) return null
  return coaches.find((c: Coach) => c.id === assignedCoachId) ?? null
}
```

- [ ] **Step 5: Update coachPerks.ts — change computeCoachHabitBonus to accept active team**

Change the signature to also take the active team's squad and coach:

```typescript
export function computeCoachHabitBonus(
  state: Pick<AppState, 'habits' | 'coachCollection'>,
  activeTeam: { squad: (string | null)[]; assignedCoach: string | null },
  habitId: string,
  baseEarned: number,
  newStreak: number,
): number {
  if (!activeTeam.assignedCoach) return 0
  const coach = getAssignedCoach(activeTeam.assignedCoach)
  if (!coach) return 0
  const level = getCoachLevel(coach.id, state.coachCollection)
  if (level === 0) return 0

  // ... perk switch unchanged except two cases:

  case 'squad_full_pct':
    return activeTeam.squad.filter(Boolean).length === 11
      ? Math.round(baseEarned * value / 100)
      : 0

  case 'squad_min_pct':
    return activeTeam.squad.filter(Boolean).length >= (perk.minPlayers ?? 0)
      ? Math.round(baseEarned * value / 100)
      : 0
```

- [ ] **Step 6: Update coachPerks.ts — change applyCoachStatBoost**

Change from reading `state.assignedCoach` to accepting the coach ID:

```typescript
export function applyCoachStatBoost(
  footballer: Footballer,
  assignedCoachId: string | null,
  coachCollection: Record<string, number>,
): Footballer {
  if (!assignedCoachId) return footballer
  const coach = getAssignedCoach(assignedCoachId)
  if (!coach || coach.perk.type !== 'stat_boost') return footballer
  const level = getCoachLevel(coach.id, coachCollection)
  // ... rest unchanged
}
```

- [ ] **Step 7: Update achievements.ts — import getActiveTeam and update squad/coach lambdas**

Import:
```typescript
import { getActiveTeam } from './teamHelpers'
```

Update `first_squad`:
```typescript
progressFn: s => ({ current: getActiveTeam(s).squad.filter(Boolean).length, total: 11 }),
condition: s => getActiveTeam(s).squad.filter(Boolean).length === 11,
```

Update `dream_chemistry` and `elite_team` — change `s.squad` to `getActiveTeam(s).squad`.

Update `special_one`:
```typescript
condition: s => getActiveTeam(s).assignedCoach === 'mourinho',
```

Update `the_klopp`:
```typescript
condition: s => getActiveTeam(s).assignedCoach === 'klopp',
```

- [ ] **Step 8: Commit all type + library changes together**

```bash
git add src/types.ts src/lib/teamHelpers.ts src/lib/bonuses.ts src/lib/coachPerks.ts src/lib/achievements.ts
git commit -m "feat(team): add Team type, helpers, and update library signatures for multi-team"
```

**Note:** This commit includes all type changes and library signature updates together, ensuring no intermediate broken state. The store and UI consumers are updated in the next tasks.

---

### Task 2: Update Zustand store — default state, team actions, migration

**Files:**
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: Update imports and add team helper imports**

At the top of `src/store/useAppStore.ts`, add:

```typescript
import type { Habit, Footballer, AppState, Team } from '../types'
import { getActiveTeam, createDefaultTeam, migrateOldState, updateTeamInArray } from '../lib/teamHelpers'
```

- [ ] **Step 2: Update default initial state**

Replace the three old fields in the initial state:

```typescript
// REMOVE these three lines:
//   squad: Array(11).fill(null),
//   formation: '4-3-3',
//   assignedCoach: null,

// ADD these two (create a stable default team):
teams: [createDefaultTeam()],
activeTeamId: '',  // will be set in the next line
```

Then immediately after the store object creation, set `activeTeamId`:

Since Zustand initial state is a plain object, we need to generate the ID inline. Use a self-executing function or generate the ID first:

```typescript
// Above the create() call — this runs once at module load, which is fine
// since importState overwrites it immediately on login
const _initTeamId = crypto.randomUUID()

// In the store initial state:
teams: [{ id: _initTeamId, name: 'Команда 1', squad: Array(11).fill(null), formation: '4-3-3', assignedCoach: null }],
activeTeamId: _initTeamId,
```

- [ ] **Step 3: Update AppStore interface — new action signatures**

In the `AppStore` interface, update:

```typescript
// Squad — now takes teamId
setSquadSlot: (teamId: string, slotIndex: number, footballerId: string | null) => void
// Coach — now takes teamId
assignCoach: (teamId: string, coachId: string | null) => void
// Formation — now takes teamId
setFormation: (teamId: string, formation: string) => void
// New team actions
createTeam: (name: string) => void
renameTeam: (teamId: string, name: string) => void
deleteTeam: (teamId: string) => void
setActiveTeam: (teamId: string) => void
```

- [ ] **Step 4: Update completeHabit to use active team**

In `completeHabit`, replace:

```typescript
// OLD:
const bonuses = computeActiveBonuses(state)
const coach = getAssignedCoach(state)
const squadPlayers = (state.squad ?? [])
  .filter((id): id is string => id !== null)
  .map(id => footballerMap.get(id))
  .filter((f): f is Footballer => f !== undefined)
```

With:

```typescript
// NEW:
const activeTeam = getActiveTeam(state)
const bonuses = computeActiveBonuses(activeTeam.squad)
const coach = getAssignedCoach(activeTeam.assignedCoach)
const squadPlayers = activeTeam.squad
  .filter((id): id is string => id !== null)
  .map(id => footballerMap.get(id))
  .filter((f): f is Footballer => f !== undefined)
```

And update `computeCoachHabitBonus` call:

```typescript
const coachBonus = computeCoachHabitBonus(state, activeTeam, id, earned, newStreak)
```

- [ ] **Step 5: Update setSquadSlot to target a specific team**

Replace the current `setSquadSlot`:

```typescript
setSquadSlot: (teamId, slotIndex, footballerId) => {
  set(state => ({
    teams: updateTeamInArray(state.teams, teamId, {
      squad: state.teams.find(t => t.id === teamId)!.squad.map(
        (id, i) => i === slotIndex ? footballerId : id
      ),
    }),
  }))
  const newUnlocks = checkAchievements(get())
  for (const achievementId of newUnlocks) {
    get().unlockAchievement(achievementId)
  }
},
```

- [ ] **Step 6: Update setFormation to target a specific team**

Replace the current `setFormation`:

```typescript
setFormation: (teamId, formation) => {
  set(state => ({
    teams: updateTeamInArray(state.teams, teamId, {
      formation,
      squad: Array(11).fill(null),
    }),
  }))
},
```

- [ ] **Step 7: Update assignCoach to target a specific team**

Replace the current `assignCoach`:

```typescript
assignCoach: (teamId, coachId) => {
  set(state => ({
    teams: updateTeamInArray(state.teams, teamId, { assignedCoach: coachId }),
  }))
  const newUnlocks = checkAchievements(get())
  for (const achievementId of newUnlocks) {
    get().unlockAchievement(achievementId)
  }
},
```

- [ ] **Step 8: Add new team CRUD actions**

```typescript
createTeam: (name) => {
  set(state => {
    if (state.teams.length >= 5) return state
    const trimmed = name.trim().slice(0, 30)
    if (!trimmed) return state
    return { teams: [...state.teams, createDefaultTeam(trimmed)] }
  })
},

renameTeam: (teamId, name) => {
  const trimmed = name.trim().slice(0, 30)
  if (!trimmed) return
  set(state => ({
    teams: updateTeamInArray(state.teams, teamId, { name: trimmed }),
  }))
},

deleteTeam: (teamId) => {
  set(state => {
    if (state.teams.length <= 1) return state
    if (state.activeTeamId === teamId) return state
    return { teams: state.teams.filter(t => t.id !== teamId) }
  })
},

setActiveTeam: (teamId) => {
  set({ activeTeamId: teamId })
},
```

- [ ] **Step 9: Update resetAll**

Replace old fields with:

```typescript
resetAll: () => {
  const freshTeam = createDefaultTeam()
  set({
    coins: 200,
    habits: [],
    collection: {},
    pullHistory: [],
    teams: [freshTeam],
    activeTeamId: freshTeam.id,
    achievements: {},
    claimedAchievements: {},
    totalCompletions: 0,
    pendingUnlocks: [],
    pityCounters: {},
    coachCollection: {},
    following: [],
    lastTriviaDate: null,
    triviaHistory: [],
  })
},
```

- [ ] **Step 10: Update importState with migration and stale key clearing**

```typescript
importState: (data) => {
  const migrated = migrateOldState(data as Record<string, unknown>)
  const teams = migrated ? migrated.teams : (data.teams ?? [createDefaultTeam()])
  const activeTeamId = migrated ? migrated.activeTeamId : (data.activeTeamId ?? teams[0]?.id ?? '')

  // Use Zustand's replace mode (second arg = true) to fully replace state,
  // preventing stale top-level squad/formation/assignedCoach from lingering
  set({
    coins: data.coins ?? 200,
    habits: data.habits ?? [],
    collection: data.collection ?? {},
    pullHistory: data.pullHistory ?? [],
    teams,
    activeTeamId,
    achievements: data.achievements ?? {},
    claimedAchievements: data.claimedAchievements ?? {},
    totalCompletions: data.totalCompletions ?? 0,
    pendingUnlocks: [],
    pityCounters: data.pityCounters ?? {},
    coachCollection: data.coachCollection ?? {},
    following: data.following ?? [],
    lastTriviaDate: data.lastTriviaDate ?? null,
    triviaHistory: data.triviaHistory ?? [],
    _stateLoaded: true,
  } as AppStore, true)
},
```

**Important:** The `true` second argument to `set()` uses Zustand's replace mode, which replaces the entire state instead of merging. This ensures any old top-level `squad`/`formation`/`assignedCoach` keys from a previous session are not preserved in state and re-persisted to Supabase.

- [ ] **Step 11: Commit store changes**

```bash
git add src/store/useAppStore.ts
git commit -m "feat(team): update store with multi-team state, actions, and migration"
```

---

### Task 3: Update HabitCard.tsx

**Files:**
- Modify: `src/components/habits/HabitCard.tsx`

- [ ] **Step 1: Update imports**

Add:

```typescript
import { getActiveTeam } from '../../lib/teamHelpers'
```

- [ ] **Step 2: Update store selector**

Replace the selector that reads `squad`/`assignedCoach`:

```typescript
// OLD:
const { squad, assignedCoach, coachCollection, habits: allHabits } = useAppStore(
  useShallow(state => ({
    squad: state.squad,
    assignedCoach: state.assignedCoach,
    coachCollection: state.coachCollection,
    habits: state.habits,
  }))
)

// NEW:
const { activeTeam, coachCollection, habits: allHabits } = useAppStore(
  useShallow(state => {
    const at = getActiveTeam(state)
    return {
      activeTeam: at,
      coachCollection: state.coachCollection,
      habits: state.habits,
    }
  })
)
```

- [ ] **Step 3: Update breakdown calculation**

Replace references to `squad` and `assignedCoach` with `activeTeam.squad` and `activeTeam.assignedCoach`:

```typescript
const breakdown = useMemo(() => {
  const newStreak = calculateNewStreak(habit.streak, habit.lastCompleted)
  const streakMult = streakMultiplier(newStreak)
  const afterStreak = Math.round(habit.coinValue * streakMult)
  const squadChemPct = totalBonusPercent(computeActiveBonuses(activeTeam.squad))
  const coach = getAssignedCoach(activeTeam.assignedCoach)
  const squadPlayers = activeTeam.squad
    .filter((id): id is string => id !== null)
    .map(id => footballerMap.get(id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined)
  const coachChemPct = coach ? computeCoachChemistryPct(coach, squadPlayers) : 0
  const chemistryPct = squadChemPct + coachChemPct
  const withChemistry = Math.round(afterStreak * (1 + chemistryPct / 100))
  const chemistryBonus = withChemistry - afterStreak
  const coachBonus = computeCoachHabitBonus(
    { habits: allHabits, coachCollection },
    activeTeam,
    habit.id, withChemistry, newStreak
  )
  return {
    base: habit.coinValue,
    afterStreak,
    streakMult,
    chemistryPct,
    chemistryBonus,
    coachBonus,
    total: withChemistry + coachBonus,
  } satisfies EarnBreakdown
}, [habit, activeTeam, coachCollection, allHabits])
```

- [ ] **Step 4: Commit**

```bash
git add src/components/habits/HabitCard.tsx
git commit -m "fix(HabitCard): resolve squad/coach from active team"
```

**Note:** Tasks 3-6 can alternatively be committed together with: `git add src/components/habits/HabitCard.tsx src/hooks/useBattle.ts src/pages/Achievements.tsx src/pages/FriendProfile.tsx && git commit -m "fix: update all consumers to resolve squad/coach from active team"`. Each task has its own commit for granularity, but grouping is fine too.

---

### Task 4: Update useBattle.ts

**Files:**
- Modify: `src/hooks/useBattle.ts`

- [ ] **Step 1: Import helpers**

```typescript
import { getActiveTeam, migrateOldState } from '../lib/teamHelpers'
```

- [ ] **Step 2: Update buildMySnapshot**

```typescript
function buildMySnapshot(): SquadSnapshot {
  const s = state()
  const activeTeam = getActiveTeam(s)
  const squadIds = activeTeam.squad.filter((id): id is string => id !== null)
  return {
    squad: squadIds,
    formation: activeTeam.formation,
    coachId: activeTeam.assignedCoach ?? '',
    coachLevel: activeTeam.assignedCoach ? (s.coachCollection[activeTeam.assignedCoach] ?? 1) : 1,
    maxHabitStreak: Math.max(0, ...s.habits.map(h => h.streak)),
    bench: pickAutoBench(Object.keys(s.collection), squadIds),
  }
}
```

- [ ] **Step 3: Update canChallenge — own state + friend state**

```typescript
async function canChallenge(friendId: string): Promise<{
  canChallenge: boolean
  reason?: string
}> {
  const s = state()
  const myTeam = getActiveTeam(s)
  const filledSlots = myTeam.squad.filter(id => id !== null).length
  if (filledSlots < 11) return { canChallenge: false, reason: 'Заповніть склад (11/11)' }
  if (!myTeam.assignedCoach) return { canChallenge: false, reason: 'Призначте тренера' }

  const profile = await fetchUserProfile(friendId)
  if (!profile) return { canChallenge: false, reason: 'Профіль не знайдено' }
  const friendState = profile.state

  // Handle old or new state format for friend
  let friendSquad: (string | null)[]
  let friendCoach: string | null
  if (Array.isArray(friendState.teams) && friendState.teams.length > 0) {
    const friendActiveTeam = getActiveTeam(friendState as AppState)
    friendSquad = friendActiveTeam.squad
    friendCoach = friendActiveTeam.assignedCoach
  } else {
    // Old format
    friendSquad = (friendState as Record<string, unknown>).squad as (string | null)[] ?? []
    friendCoach = (friendState as Record<string, unknown>).assignedCoach as string | null ?? null
  }

  const friendFilled = friendSquad.filter(id => id !== null).length
  if (friendFilled < 11) return { canChallenge: false, reason: 'У друга неповний склад' }
  if (!friendCoach) return { canChallenge: false, reason: 'У друга немає тренера' }

  const pending = await apiHasPendingChallenge(userId, friendId)
  if (pending) return { canChallenge: false, reason: 'Виклик вже відправлено' }

  return { canChallenge: true }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useBattle.ts
git commit -m "fix(battle): resolve squad from active team, handle friend state migration"
```

---

### Task 5: Update Achievements.tsx

**Files:**
- Modify: `src/pages/Achievements.tsx`

- [ ] **Step 1: Update state selector**

Replace the `useShallow` selector to include `teams` and `activeTeamId` instead of `squad`/`formation`/`assignedCoach`:

```typescript
const progressState = useAppStore(
  useShallow(state => ({
    achievements: state.achievements,
    claimedAchievements: state.claimedAchievements,
    totalCompletions: state.totalCompletions,
    collection: state.collection,
    teams: state.teams,
    activeTeamId: state.activeTeamId,
    coachCollection: state.coachCollection,
    coins: state.coins,
    habits: state.habits,
    pullHistory: state.pullHistory,
    pendingUnlocks: state.pendingUnlocks,
    pityCounters: state.pityCounters,
    following: state.following,
    lastTriviaDate: state.lastTriviaDate,
    triviaHistory: state.triviaHistory,
  }))
) as AppState
```

This replaces the old `squad`, `assignedCoach`, `formation` fields with `teams` and `activeTeamId`. All `AppState` fields are included so the cast to `AppState` is complete.

- [ ] **Step 2: Commit**

```bash
git add src/pages/Achievements.tsx
git commit -m "fix(achievements): pass teams/activeTeamId to achievement condition checks"
```

---

### Task 6: Update FriendProfile.tsx

**Files:**
- Modify: `src/pages/FriendProfile.tsx`

- [ ] **Step 1: Import helpers**

```typescript
import { getActiveTeam, migrateOldState } from '../lib/teamHelpers'
```

- [ ] **Step 2: Update state resolution**

Replace the direct `state.squad`/`state.formation` reads:

```typescript
// OLD:
const squad = state.squad ?? Array<string | null>(11).fill(null)
const formation = state.formation ?? '4-3-3'

// NEW:
let squad: (string | null)[]
let formation: string
if (Array.isArray(state.teams) && state.teams.length > 0) {
  const activeTeam = getActiveTeam(state as AppState)
  squad = activeTeam.squad
  formation = activeTeam.formation
} else {
  // Old format friend
  squad = (state as Record<string, unknown>).squad as (string | null)[] ?? Array(11).fill(null)
  formation = (state as Record<string, unknown>).formation as string ?? '4-3-3'
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/FriendProfile.tsx
git commit -m "fix(friends): handle old/new state format in friend profile"
```

---

### Task 7: Update Team.tsx — add multi-team tabs and CRUD

**Files:**
- Modify: `src/pages/Team.tsx`

This is the largest change. The existing pitch/formation/coach/player-picker code stays largely intact — it just gets scoped to the "viewed team" instead of global state.

- [ ] **Step 1: Import helpers and add state for viewed team**

```typescript
import { getActiveTeam } from '../lib/teamHelpers'
```

At the top of the `Team` component, replace the old squad/formation/coach selectors:

```typescript
export function Team() {
  const teams = useAppStore(state => state.teams)
  const activeTeamId = useAppStore(state => state.activeTeamId)
  const setSquadSlot = useAppStore(state => state.setSquadSlot)
  const setFormation = useAppStore(state => state.setFormation)
  const assignCoach = useAppStore(state => state.assignCoach)
  const collection = useAppStore(state => state.collection)
  const coachCollection = useAppStore(state => state.coachCollection)
  const createTeamAction = useAppStore(state => state.createTeam)
  const renameTeam = useAppStore(state => state.renameTeam)
  const deleteTeam = useAppStore(state => state.deleteTeam)
  const setActiveTeam = useAppStore(state => state.setActiveTeam)

  // Currently viewed team (local state, defaults to active)
  const [viewedTeamId, setViewedTeamId] = useState(activeTeamId)
  // Keep viewed team synced if teams change (e.g., deletion)
  useEffect(() => {
    if (!teams.find(t => t.id === viewedTeamId)) {
      setViewedTeamId(activeTeamId)
    }
  }, [teams, viewedTeamId, activeTeamId])

  const viewedTeam = teams.find(t => t.id === viewedTeamId) ?? teams[0]
  const isActiveTeam = viewedTeamId === activeTeamId

  const squad = viewedTeam.squad
  const formation = viewedTeam.formation
  const assignedCoach = viewedTeam.assignedCoach

  // Team name editing state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  // Creating new team state
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
```

- [ ] **Step 2: Update action calls to pass teamId**

Throughout the component, update calls:

```typescript
// setSquadSlot calls:
setSquadSlot(viewedTeam.id, slotIndex, footballerId)

// setFormation calls:
setFormation(viewedTeam.id, newFormation)

// assignCoach calls:
assignCoach(viewedTeam.id, coachId)
```

Remove the old `squadForBonuses` selector — use `viewedTeam.squad` directly:

```typescript
const activeBonuses = useMemo(() => computeActiveBonuses(viewedTeam.squad), [viewedTeam.squad])
```

Update `applyCoachStatBoost` calls:

```typescript
function boostedFootballer(f: Footballer) {
  return applyCoachStatBoost(f, viewedTeam.assignedCoach, coachCollection)
}
```

- [ ] **Step 3: Add team tabs UI**

Insert the team tabs between the header and the formation switcher. Place this block right after the header `<div>` and before the formation switcher:

```tsx
{/* Team tabs */}
<div className="flex gap-1.5 mb-4 flex-wrap items-center">
  {teams.map(team => {
    const isViewed = team.id === viewedTeamId
    const isActive = team.id === activeTeamId
    return (
      <button
        key={team.id}
        onClick={() => setViewedTeamId(team.id)}
        className={`px-3 py-1.5 rounded-lg font-oswald font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
          isViewed
            ? 'bg-[#00E676] text-[#04060A]'
            : 'bg-[#1A2336] text-[#5A7090] border border-[#2A3A50] hover:text-white'
        }`}
      >
        {isActive && <span className="text-[10px]">⭐</span>}
        {team.name}
      </button>
    )
  })}
  {teams.length < 5 && (
    <button
      onClick={() => { setCreatingTeam(true); setNewTeamName('') }}
      className="px-3 py-1.5 rounded-lg font-oswald font-bold text-xs text-[#00E676] border border-dashed border-[#00E676]/50 hover:border-[#00E676] transition-all cursor-pointer"
    >
      +
    </button>
  )}
</div>

{/* Active team indicator + rename/delete controls */}
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    {isActiveTeam ? (
      <span className="text-[10px] text-[#00E676] font-oswald uppercase tracking-widest">
        Активна команда <span className="text-[#5A7090]">• бонуси та бої</span>
      </span>
    ) : (
      <button
        onClick={() => setActiveTeam(viewedTeam.id)}
        className="text-[10px] text-[#FBBF24] font-oswald uppercase tracking-widest hover:text-[#FBBF24]/80 cursor-pointer underline"
      >
        Зробити активною ⭐
      </button>
    )}
  </div>
  <div className="flex items-center gap-2">
    {editingName ? (
      <form
        onSubmit={e => {
          e.preventDefault()
          if (nameInput.trim()) renameTeam(viewedTeam.id, nameInput)
          setEditingName(false)
        }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          maxLength={30}
          className="bg-[#1A2336] text-white text-xs px-2 py-1 rounded border border-[#2A3A50] w-32 font-oswald"
        />
        <button type="submit" className="text-[#00E676] text-xs cursor-pointer">✓</button>
        <button type="button" onClick={() => setEditingName(false)} className="text-[#5A7090] text-xs cursor-pointer">✕</button>
      </form>
    ) : (
      <button
        onClick={() => { setEditingName(true); setNameInput(viewedTeam.name) }}
        className="text-[10px] text-[#5A7090] hover:text-white cursor-pointer"
      >
        ✏️ Назва
      </button>
    )}
    {!isActiveTeam && teams.length > 1 && (
      <button
        onClick={() => {
          if (window.confirm(`Видалити команду "${viewedTeam.name}"?`)) {
            deleteTeam(viewedTeam.id)
          }
        }}
        className="text-[10px] text-red-400/60 hover:text-red-400 cursor-pointer"
      >
        🗑️
      </button>
    )}
  </div>
</div>

{/* New team creation inline */}
{creatingTeam && (
  <div className="mb-4 bg-[#0A0F1A] border border-[#00E676]/30 rounded-xl p-3">
    <form
      onSubmit={e => {
        e.preventDefault()
        if (newTeamName.trim()) {
          createTeamAction(newTeamName)
          setCreatingTeam(false)
          // Switch to the newly created team
          const newTeams = useAppStore.getState().teams
          const newest = newTeams[newTeams.length - 1]
          if (newest) setViewedTeamId(newest.id)
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={newTeamName}
        onChange={e => setNewTeamName(e.target.value)}
        placeholder="Назва нової команди"
        maxLength={30}
        className="flex-1 bg-[#1A2336] text-white text-sm px-3 py-2 rounded-lg border border-[#2A3A50] font-oswald"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-[#00E676] text-[#04060A] font-oswald font-bold text-xs uppercase rounded-lg cursor-pointer"
      >
        Створити
      </button>
      <button
        type="button"
        onClick={() => setCreatingTeam(false)}
        className="px-3 py-2 text-[#5A7090] font-oswald text-xs cursor-pointer"
      >
        ✕
      </button>
    </form>
  </div>
)}
```

- [ ] **Step 4: Update page header to show team name**

```tsx
<h1 className="font-oswald text-2xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
  {viewedTeam.name}
</h1>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors. All consumers now use the new multi-team state shape.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Team.tsx
git commit -m "feat(team): add multi-team tabs, CRUD, and scoped team viewing"
```

---

### Task 8: Verify the app builds and runs

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run dev server and smoke test**

```bash
npm run dev
```

Manual checks:
1. Team page loads with existing squad migrated to "Команда 1"
2. Can create a new team via "+" button
3. Can rename a team
4. Can switch viewed team via tabs
5. Can set a team as active via ⭐ button
6. Can delete non-active teams
7. Formation/coach/player changes are scoped to viewed team
8. Habit coin breakdown reflects active team's chemistry
9. Dashboard HabitCards show correct bonuses from active team

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: post-integration fixes for multi-team system"
```
