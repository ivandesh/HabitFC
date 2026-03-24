# Multi-Team System — Design Spec

## Overview

Allow users to create up to 5 named teams, each with its own squad, formation, and coach. One team is marked "active" and drives chemistry bonuses on habit coins, battle squad snapshots, coach perks, and squad-related achievements.

## Requirements

- Up to 5 named teams per user
- Players are shared across teams (same footballer can appear in multiple teams)
- Each team has its own squad (11 slots), formation, and assigned coach
- One team is the "active" team at any time
- Active team determines: chemistry bonus on habit coins, battle snapshot, coach perk effects, squad-related achievement checks
- Backwards compatible with existing single-team state format

## Data Model

### New `Team` interface (`src/types.ts`)

```typescript
interface Team {
  id: string                    // crypto.randomUUID()
  name: string                  // user-defined, e.g. "ULTRAS FC"
  squad: (string | null)[]      // 11 slots, footballer IDs
  formation: string             // e.g. "4-3-3"
  assignedCoach: string | null  // coach ID
}
```

### `AppState` changes

Remove top-level fields: `squad`, `formation`, `assignedCoach`.

Add:
- `teams: Team[]` — array of 1–5 teams
- `activeTeamId: string` — ID of the active team

All other fields (`coins`, `habits`, `collection`, `coachCollection`, etc.) remain unchanged.

### Helper function

```typescript
function getActiveTeam(state: AppState): Team {
  return state.teams.find(t => t.id === state.activeTeamId) ?? state.teams[0]
}
```

Falls back to `teams[0]` if `activeTeamId` is stale (data corruption guard). Used by all consumers that previously read `state.squad`, `state.formation`, or `state.assignedCoach`.

## New Store Actions

| Action | Behavior |
|--------|----------|
| `createTeam(name: string)` | Adds new Team with empty squad, "4-3-3" formation, no coach. Fails silently if already at 5 teams. |
| `renameTeam(teamId: string, name: string)` | Updates team name. |
| `deleteTeam(teamId: string)` | Removes team. Blocked if it's the active team (must switch first). |
| `setActiveTeam(teamId: string)` | Changes `activeTeamId`. |

Existing actions modified:
- `setSquadSlot(slotIndex, footballerId)` — operates on the currently viewed team (passed by Team page)
- `setFormation(formation)` — operates on the currently viewed team
- `assignCoach(coachId)` — operates on the currently viewed team

These actions gain a `teamId` parameter to target a specific team within the `teams` array.

Note: `setFormation` retains its current behavior of resetting the squad to all-null when the formation changes (positions change between formations).

## State Migration

In `importState`, detect old format and migrate:

```
if state has 'teams' array → use as-is (new format)
if state has 'squad' but no 'teams' → migrate:
  - teams[0] = { id: uuid, name: "Команда 1", squad, formation, assignedCoach }
  - activeTeamId = teams[0].id
  - explicitly delete old top-level squad/formation/assignedCoach keys from the state
    object to prevent stale keys from being re-persisted to Supabase
```

Zustand initial state (before `importState` runs) also uses the `teams`/`activeTeamId` shape with a single default team.

`resetAll` creates a fresh single team: `teams: [{ id, name: "Команда 1", squad: Array(11).fill(null), formation: "4-3-3", assignedCoach: null }]`.

## Consumer Changes

| File | Change |
|------|--------|
| `src/store/useAppStore.ts` | `completeHabit` resolves active team for chemistry + coach (including `squadPlayers` built from active team's squad for `computeCoachChemistryPct`). Squad/formation/coach actions target specific team in `teams` array. Migration logic in `importState`. Zustand default initial state uses `teams`/`activeTeamId` shape instead of top-level fields. |
| `src/lib/bonuses.ts` | `computeActiveBonuses` reads squad from active team. Signature may change to accept squad directly or resolve from state. |
| `src/lib/coachPerks.ts` | `getAssignedCoach` resolves coach from active team. `computeCoachHabitBonus` resolves both coach AND squad from active team (needed for `squad_full_pct` and `squad_min_pct` perk checks which read `state.squad.filter(Boolean)`). |
| `src/components/habits/HabitCard.tsx` | Reads squad/coach for coin breakdown tooltip via active team. |
| `src/hooks/useBattle.ts` | Builds `SquadSnapshot` from active team's squad/formation/coach. `canChallenge` must also resolve the friend's squad/coach from their active team (friend state may be old or new format — apply same migration logic). |
| `src/pages/Team.tsx` | Major rework — adds team tabs, team CRUD, scopes pitch/formation/coach to selected (viewed) team. "Viewed team" is local React state (`useState`), not persisted. |
| `src/pages/FriendProfile.tsx` | Handles friends with old format (no `teams` array) by applying same migration logic. |
| `src/pages/Achievements.tsx` | Reads squad/formation/coach for achievement condition/progress checks — must resolve from active team instead of top-level fields. |
| `src/lib/achievements.ts` | Achievement condition lambdas that access `s.squad` and `s.assignedCoach` must be updated to use `getActiveTeam(s).squad` and `getActiveTeam(s).assignedCoach`. |

No changes needed to: battle engine (`battleEngine.ts`), match simulation, gacha, streaks, sounds, pack opening, seeded RNG.

## Team Page UI

### Layout changes

A **team tabs row** is added above the pitch:

- **Active team tab** — green background (`#00E676`), dark text, ⭐ icon prefix
- **Inactive team tabs** — dark background (`#1A2336`), muted text, border
- **"+" button** — dashed green border, appears only when < 5 teams exist
- Tabs wrap on narrow screens

Below tabs:
- **"Активна команда" label** with subtitle "бонуси та бої" when viewing the active team
- **Rename (✏️) / Delete (🗑️)** inline controls for the currently viewed team
- Delete is blocked on the active team

Everything below (pitch, formation picker, coach selector, player picker, chemistry lines) remains the same, scoped to the currently viewed team.

### Creating a team

Clicking "+" opens an inline input or small modal to enter the team name. New team starts with empty squad, 4-3-3 formation, no coach.

### Switching active team

Clicking a team tab views that team. A separate "set as active" action (or the ⭐ icon) marks a team as the active team for gameplay purposes. Viewing a team ≠ making it active — the user explicitly chooses which team is active.

## Constraints

- Minimum 1 team, maximum 5 teams (cannot delete the last remaining team; it is always active)
- Cannot delete the active team — must switch active to another team first
- Team names: 1–30 characters, trimmed, no uniqueness enforced
- Players shared across teams — no exclusivity constraint
- Coach can be assigned to multiple teams (same coach in different teams is allowed)
