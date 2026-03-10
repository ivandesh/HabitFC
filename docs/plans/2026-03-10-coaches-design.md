# Coaches Feature Design

**Date:** 2026-03-10
**Status:** Approved

---

## Overview

Add 21 famous football coaches as collectible cards. Players pull coaches from a dedicated coach pack in the Shop, assign one coach to their team, and benefit from the coach's unique perk (habit coin bonuses or player stat boosts) plus chemistry with their former clubs.

---

## Data Model

### New types (`src/types.ts`)

```typescript
export type PerkType = 'habit_streak_bonus' | 'habit_all_bonus' | 'habit_condition_bonus' | 'stat_boost'

export interface CoachPerk {
  type: PerkType
  // For stat_boost: which stat and which position filter (undefined = all positions)
  statBoost?: { stat: 'pace' | 'shooting' | 'passing' | 'dribbling'; position?: Position; rarityFilter?: Rarity }
  // Level scaling: [lvl1, lvl2, lvl3]
  values: [number, number, number]
  descUA: (level: number, value: number) => string
}

export interface Coach {
  id: string
  name: string
  nationality: string
  clubs: string[]      // clubs coached in real life — used for chemistry matching
  photoUrl?: string
  emoji: string
  perk: CoachPerk
}
```

### Store additions (`src/store/useAppStore.ts`)

```typescript
coachCollection: Record<string, number>   // coach id → copies owned (level = min(copies, 3))
assignedCoach: string | null
```

### Perk levels

Derived from `coachCollection[id]` count: 1 copy = level 1, 2 copies = level 2, 3+ copies = level 3 (max).

---

## Coach Pack

- **Name:** Тренерський пакет
- **Cost:** 350 coins
- **Cards per pull:** 1
- **Rarity:** all coaches are equal (no rarity tiers)
- **Duplicate:** upgrades perk level (capped at level 3); if already level 3, refund 50 coins

---

## Coach Card Visual Design

Distinct from footballer cards:
- **Accent color:** gold/amber (`#FBBF24`) instead of green
- **Layout:** portrait photo (square crop, not circular), large Oswald name, coached clubs list, perk description, level stars (★★☆)
- **Label:** small "ТРЕНЕР" badge in amber at top
- **Background:** same dark `#0A0F1A`

---

## Team Page Integration

- **Coach slot:** full-width bar above the pitch
- **Empty state:** dashed amber border + "Призначити тренера" prompt
- **Filled state:** compact banner — photo, name, perk text, level stars, chemistry count
- **Assignment flow:** click slot → bottom sheet picker (same pattern as player picker) showing owned coaches

---

## Chemistry

Coach's `clubs[]` array is checked against each squad player's `club`. Each matching player contributes **+5% coins** — same mechanic as existing player club/nationality chemistry.

---

## Perk Balance

- **Stat boosts:** capped at +5/+8/+12 per stat. At max level this adds ~+3 to affected players' overall — meaningful but not game-breaking.
- **Flat habit bonuses:** +8/+15/+25 range (or similar). At max, a 5-habit player earns ~+125 extra coins — noticeable but not income-doubling.
- **Percent habit bonuses:** +8–12% / +15–22% / +25–35% range.
- **All-habits bonuses:** higher values (+30/+50/+80) since condition is hard to trigger.

---

## The 21 Coaches

Photo URLs stored locally at `/coaches/[id].png`, downloaded from TheSportsDB during implementation.

| ID | Name | Nationality | Chemistry Clubs | Perk Type | Perk (lvl 1/2/3) |
|----|------|-------------|-----------------|-----------|-------------------|
| `guardiola` | Pep Guardiola | Spain | Barcelona, Bayern Munich, Man City | Stat | +passing to all MID: +5/+8/+12 |
| `klopp` | Jürgen Klopp | Germany | Dortmund, Liverpool | Stat | +pace to ALL players: +4/+6/+10 |
| `ancelotti` | Carlo Ancelotti | Italy | AC Milan, Chelsea, Real Madrid, Bayern Munich, Napoli, Everton | Habit | +8/+15/+25% to all habit coins |
| `ferguson` | Sir Alex Ferguson | Scotland | Man United | Habit | +10/+20/+35 flat coins per habit with streak ≥7 |
| `mourinho` | José Mourinho | Portugal | Porto, Chelsea, Inter Milan, Real Madrid, Man United, Tottenham, Roma | Habit | +25/+45/+70 bonus coins when ALL habits completed same day |
| `simeone` | Diego Simeone | Argentina | Atletico Madrid | Habit | +10/+18/+28% coins for habits with streak 1–3 |
| `conte` | Antonio Conte | Italy | Juventus, Chelsea, Inter Milan, Tottenham, Napoli | Habit | +8/+15/+25 flat coins per habit with streak ≥3 |
| `tuchel` | Thomas Tuchel | Germany | Dortmund, PSG, Chelsea, Bayern Munich | Habit | +10/+18/+28% coins on days you complete 3+ habits |
| `zidane` | Zinedine Zidane | France | Real Madrid | Stat | +dribbling to legendary players: +5/+8/+12 |
| `luisenrique` | Luis Enrique | Spain | Barcelona, PSG | Habit | +12/+22/+35% coins on days ALL habits are completed |
| `xavi` | Xavi Hernandez | Spain | Barcelona | Stat | +passing to all MID: +6/+10/+15 |
| `arteta` | Mikel Arteta | Spain | Arsenal | Habit | +8/+15/+25 flat coins per habit with streak ≥2 |
| `wenger` | Arsène Wenger | France | Arsenal | Habit | +10/+18/+30 flat coins per habit owned for 7+ days |
| `flick` | Hansi Flick | Germany | Bayern Munich, Barcelona | Habit | +10/+18/+28% coins for habits completed before noon* |
| `emery` | Unai Emery | Spain | Sevilla, PSG, Arsenal, Villarreal, Aston Villa | Habit | +30/+50/+80 flat bonus when ALL habits done in one day |
| `pochettino` | Mauricio Pochettino | Argentina | Tottenham, PSG, Chelsea | Habit | +6/+10/+18 flat coins per habit when 4+ habits active |
| `allegri` | Massimiliano Allegri | Italy | Juventus, AC Milan | Habit | +8/+15/+25% coins when squad has all 11 slots filled |
| `inzaghi` | Simone Inzaghi | Italy | Lazio, Inter Milan | Habit | +8/+15/+22% coins when squad has 5+ players filled |
| `deschamps` | Didier Deschamps | France | France, Monaco | Habit | +6/+12/+20 flat coins per habit with streak ≥3 |
| `southgate` | Gareth Southgate | England | England | Stat | +passing to all GK: +5/+8/+12 |
| `tenhag` | Erik ten Hag | Netherlands | Ajax, Man United | Habit | +6/+10/+18 flat coins per habit with streak ≥1 |

*"Before noon" is checked against local time at habit completion.

---

## Stat Boost Application

Stat boosts are **never applied to base data**. They are computed at render time:

```typescript
// In Team.tsx / wherever stats are displayed
function applyCoachBoost(footballer: Footballer, coach: Coach | null, level: number): Footballer {
  if (!coach || coach.perk.type !== 'stat_boost') return footballer
  const { stat, position, rarityFilter } = coach.perk.statBoost!
  if (position && footballer.position !== position) return footballer
  if (rarityFilter && footballer.rarity !== rarityFilter) return footballer
  const boost = coach.perk.values[level - 1]
  return { ...footballer, stats: { ...footballer.stats, [stat]: Math.min(99, footballer.stats[stat] + boost) } }
}
```

Stats are capped at 99.

---

## Habit Perk Application

Habit perks are applied inside `completeHabit` in the store, after base coin calculation:

```typescript
// After existing streak multiplier + squad bonus calculation:
const coachBonus = computeCoachHabitBonus(state, habit, earned)
const total = earned + coachBonus
```

A new `src/lib/coachPerks.ts` file handles all perk computation logic (habit and stat).

---

## Achievements

### Meme category (4 new)

| ID | Title (UA) | Description (UA) | Condition |
|----|-----------|-----------------|-----------|
| `special_one` | Особливий | Призначив Моурінью. Він вже проводить прес-конференцію. | `assignedCoach === 'mourinho'` |
| `pep_or_pep` | Тіктака чи Тіктака? | Маєш і Гвардіолу, і Хаві. Обидва хочуть, щоб усі пасували. Постійно. | Own both `guardiola` + `xavi` |
| `the_klopp` | ЙЄЄЄС! | Призначив Клоппа. Тепер твоя команда пресингує суперника навіть у нього вдома. | `assignedCoach === 'klopp'` |
| `invincible_process` | Процес | Маєш Артету і Венгера одночасно. Арсенал живе у твоєму серці. | Own both `arteta` + `wenger` |

### Collection category (2 new)

| ID | Title (UA) | Description (UA) | Condition |
|----|-----------|-----------------|-----------|
| `tactics_nerd` | Тактичний Геній | Зібрав 5 тренерів. Ти вже малюєш схеми на серветках. | Own 5+ coaches |
| `full_dugout` | Повна лавка | Зібрав усіх 21 тренера. Хто взагалі тренує команду? | Own all 21 coaches |

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `src/types.ts` | Modify | Add `Coach`, `CoachPerk`, `PerkType` types; add `coachCollection`/`assignedCoach` to `AppState` |
| `src/data/coaches.ts` | Create | 21 coach definitions |
| `src/lib/coachPerks.ts` | Create | `computeCoachHabitBonus()`, `applyCoachStatBoost()`, `getCoachLevel()` |
| `src/data/packs.ts` | Modify | Add coach pack definition |
| `src/store/useAppStore.ts` | Modify | Add `coachCollection`, `assignedCoach`, `assignCoach`, `buyCoachPack` actions |
| `src/components/cards/CoachCard.tsx` | Create | Coach card component (amber theme) |
| `src/pages/Shop.tsx` | Modify | Add coach pack section |
| `src/pages/PackOpening.tsx` | Modify | Handle single-card coach pack reveal |
| `src/pages/Team.tsx` | Modify | Add coach slot above pitch, coach picker panel |
| `src/pages/Collection.tsx` | Modify | Add coaches tab/section |
| `src/lib/achievements.ts` | Modify | Add 6 new achievements; update `checkAchievements` to read `coachCollection`/`assignedCoach` |
| `public/coaches/` | Create | Directory for coach photos (downloaded from TheSportsDB) |
