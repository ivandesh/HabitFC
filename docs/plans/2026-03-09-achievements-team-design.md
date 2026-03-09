# Achievements + Team Page Design
**Date:** 2026-03-09
**Scope:** Phase 1 — Achievements, Phase 2 — Team Page Improvements

---

## Architecture

### Approach: Store-first (extend Zustand)

**Store addition:**
```ts
achievements: Record<string, { unlockedAt: string }>
formation: string  // e.g. '4-3-3'
```

**No stored bonuses** — active bonuses are computed on-the-fly from `collection` and `squad` via `computeActiveBonuses(state)`.

**New files:**
- `src/lib/achievements.ts` — declarative achievement definitions + `checkAchievements(state)` helper
- `src/lib/bonuses.ts` — `computeActiveBonuses(state)` for chemistry bonuses (Phase 2)
- `src/pages/Achievements.tsx` — achievements page
- `src/components/ui/AchievementToast.tsx` — unlock notification

**Achievement checking:** runs after `completeHabit`, `buyPack`, `setSquadSlot` store actions. Pure condition functions, no side effects.

---

## Phase 1 — Achievements

### Achievement Definitions

Each achievement:
```ts
{
  id: string
  titleUA: string
  descUA: string
  category: 'habits' | 'collection' | 'team'
  icon: string
  progressFn?: (state: AppState) => { current: number; total: number }
  condition: (state: AppState) => boolean
}
```

**Habits category:**
| ID | Title (UA) | Condition |
|----|-----------|-----------|
| `first_step` | Перший крок | Complete 1 habit |
| `on_a_roll` | В ударі | 3-day streak on any habit |
| `week_warrior` | Воїн тижня | 7-day streak on any habit |
| `centurion` | Центуріон | 100 total habit completions (tracked via new `totalCompletions` counter) |
| `iron_will` | Залізна воля | 30-day streak on any habit |

**Collection category:**
| ID | Title (UA) | Condition |
|----|-----------|-----------|
| `rookie_collector` | Новачок | Own 10 cards |
| `legend_hunter` | Мисливець за легендами | Own 1 legendary |
| `legend_master` | Майстер легенд | Own all 8 legendaries |
| `real_madrid_fan` | Фанат Реалу | Own all Real Madrid players |
| `barcelona_fan` | Фанат Барси | Own all Barcelona players |
| `man_city_fan` | Фанат Сіті | Own all Man City players |
| `liverpool_fan` | Фанат Ліверпуля | Own all Liverpool players |
| `goalkeeper_club` | Клуб воротарів | Own all GKs |
| `full_attack` | Повна атака | Own all FWDs |

**Team category:**
| ID | Title (UA) | Condition |
|----|-----------|-----------|
| `first_squad` | Перший склад | Fill all 11 slots |
| `dream_chemistry` | Хімія мрії | 15+ chemistry links |
| `elite_team` | Еліта | Squad overall 85+ |
| `all_positions` | Повний склад | At least 1 GK, 1 DEF, 1 MID, 1 FWD |

### Store additions for achievements
- `achievements: Record<string, { unlockedAt: string }>` — persisted
- `totalCompletions: number` — incremented in `completeHabit`, needed for Centurion

### Achievements Page UI

- Route: `/achievements`
- Three category tabs: Звички / Колекція / Команда
- Header: `X / Y досягнень` total count
- Grid of achievement cards:
  - **Unlocked:** full color, icon, title, description, unlock date, glow
  - **Locked:** greyed out, icon visible, title visible, description hidden (`???`)
  - **With progress:** shows progress bar (e.g. "47 / 100")
- Nav link added to existing navigation

### Toast notification on unlock
- `AchievementToast` component: slides in from top-right, shows icon + title + "Досягнення розблоковано!"
- Auto-dismisses after 4 seconds
- Plays new `playAchievementUnlock()` sound — triumphant, distinct from card sounds (synthesized via Web Audio API)
- Multiple unlocks at once queue sequentially

---

## Phase 2 — Team Page Improvements

### Formation Switcher

**Supported formations:**
- 4-3-3 (current default)
- 4-4-2
- 3-5-2
- 4-2-3-1
- 5-3-2

Each formation defines a `SLOTS` array with `{ pos, x, y }` coordinates. Formation stored in Zustand as `formation: string`.

**Behavior on formation switch:**
- Squad resets to all `null` (positions change, old assignments become invalid)
- Confirm dialog before switching if squad has players assigned
- Formation label in header updates dynamically

### Player Stat Overlay

Clicking a **filled** slot on the pitch opens an inline overlay panel (not a full modal) showing:
- Player photo + name + club + nationality
- Stat bars: Швидкість / Удар / Пас / Дриблінг
- Overall rating
- Rarity badge
- "Видалити" button to remove from squad

Clicking an **empty** slot opens the existing player picker (unchanged behavior).

### Chemistry Bonuses (replaces raw link count)

**Chemistry calculation rework:**
- Current: raw count of shared club/nationality pairs
- New: group players in squad by club and nationality, count groups of 2+

**Defined bonuses:**
| Condition | Bonus |
|-----------|-------|
| 2 players same club | +3% coins per habit |
| 3+ players same club | +6% coins per habit |
| 2 players same nationality | +2% coins per habit |
| 3+ players same nationality | +5% coins per habit |
| Stacked bonuses | additive, capped at +40% |

**UI changes:**
- Stats bar: "Хімія" shows total bonus % instead of raw link count (e.g., `+11%`)
- New "Активні бонуси" panel below pitch stats bar listing each active bonus
- `completeHabit` calls `computeActiveBonuses(state)` and applies % to coin earn
- Habit completion shows earned coins with bonus: "15 монет (+11% бонус)"

---

## Data Flow Summary

```
completeHabit()
  → calculateNewStreak()
  → computeActiveBonuses(state) → apply % multiplier to coins
  → checkAchievements(state) → stamp new unlocks in store
  → trigger toast + sound for each new achievement

buyPack()
  → checkAchievements(state) → collection achievements

setSquadSlot()
  → checkAchievements(state) → team achievements
```

---

## Future Backend Readiness
- `achievements` record is a clean key→timestamp map — easy to POST to an API
- `formation` + `squad` are already serializable
- `computeActiveBonuses` is a pure function — can run server-side identically
