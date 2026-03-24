# HabitFC — Business Logic Reference

## Overview

HabitFC is a gamified habit tracker with a football (soccer) theme. Users complete daily habits to earn coins, spend coins on gacha packs to collect footballer cards, build squads, and battle friends. All UI is in Ukrainian.

---

## 1. Habit System

### Creating Habits
- Users create habits with: **name**, **emoji** (icon), **coin value** (base reward).
- Habits are stored as an array in Zustand and synced to Supabase.
- Habits can be reordered via drag-and-drop (order persisted).
- Habits can be edited (name, emoji, coin value) or deleted.

### Completing Habits
- Each habit can be completed **once per day** (checked via `lastCompleted` date string `YYYY-MM-DD`).
- Completing a habit:
  1. Calculates streak (consecutive days completed).
  2. Applies **streak multiplier** to base coin value.
  3. Applies **chemistry bonus** from squad composition.
  4. Applies **coach perk bonus** if an active coach has a relevant perk.
  5. Awards total coins to user.
  6. Increments `totalCompletions` counter.
  7. Triggers achievement check.
  8. Plays `playHabitComplete()` sound.

### Streak Logic (`src/lib/streaks.ts`)
- **getToday()** returns current date as `YYYY-MM-DD`.
- **calculateNewStreak(lastCompleted, currentStreak):**
  - If `lastCompleted` is yesterday → streak + 1
  - If `lastCompleted` is today → streak unchanged (already completed)
  - Otherwise → streak resets to 1
- **isStreakActive(lastCompleted):** true if completed today or yesterday.
- **isCompletedToday(lastCompleted):** true if completed today.

### Streak Multipliers
| Streak Days | Multiplier |
|-------------|-----------|
| 0–2         | 1.0x      |
| 3–6         | 1.25x     |
| 7–29        | 1.5x      |
| 30+         | 2.0x      |

---

## 2. Coin Economy

### Earning Coins
| Source | Amount |
|--------|--------|
| Habit completion | base × streak_mult × (1 + chemistry% + coach%) |
| Achievement reward | 10–100 per achievement (claimed manually) |
| Daily trivia (correct) | +50 |
| Battle win | +100 |
| Battle draw | +50 |
| Duplicate card refund | 10–200 (by rarity) |
| Duplicate coach refund (max level) | 50 |

### Spending Coins
| Item | Cost |
|------|------|
| Basic Pack (5 cards) | 200 |
| Premium Pack (5 cards) | 500 |
| Elite Pack (3 cards) | 750 |
| Coach Pack (1 coach) | 500 |

---

## 3. Gacha / Pack System (`src/lib/gacha.ts`)

### Pack Definitions (`src/data/packs.ts`)
Three packs with different rarity weights:

| Pack | Cards | Common | Rare | Epic | Legendary | Cost |
|------|-------|--------|------|------|-----------|------|
| Basic | 5 | 70% | 22% | 7% | 1% | 200 |
| Premium | 5 | 40% | 35% | 20% | 5% | 500 |
| Elite | 3 | 0% | 45% | 45% | 10% | 750 |

### Pull Algorithm
1. For each card in pack:
   a. Apply **pity system** adjustments to weights.
   b. Roll random number → determine rarity via `pickRarity()`.
   c. `pickCard(rarity)` → random footballer of that rarity.
2. Return array of pulled cards.

### Pity System
- Tracked per-rarity via `pityCounters` in state.
- **Threshold:** After 2 packs without a legendary, pity kicks in.
- **Boost:** +2% added to legendary weight per pack past threshold.
- **Cap:** Pity boost maxes at 50%.
- **Reset:** Pity counter resets to 0 when a legendary is pulled.

### Duplicate Handling
- If user already owns the card → refund coins based on rarity:
  - Common: 10 coins
  - Rare: 25 coins
  - Epic: 75 coins
  - Legendary: 200 coins
- The card is NOT added again to collection.

### Pack Opening Flow (UX states)
1. **confirm** — User sees pack, clicks to open.
2. **opening** — Pack shakes with animation + `playPackOpen()` sound.
3. **cards** — Cards revealed one by one with flip animations + `playCardSlide()` / `playCardFlip(rarity)`.
4. **done** — Summary of all pulled cards, new vs duplicate indicators.

---

## 4. Footballer Cards (`src/data/footballers.ts`)

### Card Properties
- **id:** unique string
- **name:** player name
- **club:** team name
- **nationality:** country
- **rarity:** common | rare | epic | legendary
- **position:** GK | DEF | MID | FWD
- **stats:** { pace, shooting, passing, dribbling } (each 1–99)
- **emoji:** visual representation

### Card Pool Size
- **Legendary:** 8 players
- **Epic:** 40 players
- **Rare:** 60 players
- **Common:** 142 players
- **Total:** 250+ unique cards

### Overall Rating Calculation (`playerOverall()`)
- Weighted average of stats (varies by position):
  - GK: heavy on passing (reflex proxy), moderate dribbling (positioning)
  - DEF: balanced passing/dribbling, lower shooting weight
  - MID: balanced across all stats
  - FWD: heavy on shooting/pace

---

## 5. Squad / Team System

### Multi-Team System (`src/lib/teamHelpers.ts`)
Users can create up to **5 named teams**, each with its own squad, formation, and coach. One team is the **active team** at any time.

#### Team Properties
- **id:** unique string (`crypto.randomUUID()`)
- **name:** user-defined, 1–30 characters (e.g., "ULTRAS FC")
- **squad:** array of 11 slots, each `string | null` (footballer IDs)
- **formation:** string (e.g., "4-3-3")
- **assignedCoach:** coach ID or null

#### Active Team
The active team determines:
- Chemistry bonus applied to ALL habit coin earnings
- Battle squad snapshot (challenges use active team)
- Coach perk effects on habit completions
- Squad-related achievement checks (e.g., "fill all 11 slots")

#### Team Constraints
- Minimum 1 team, maximum 5 teams
- Cannot delete the last remaining team (it is always active)
- Cannot delete the active team — must switch active to another team first
- Players are shared across teams (same footballer can appear in multiple teams)
- Same coach can be assigned to multiple teams
- Team names: 1–30 characters, trimmed, no uniqueness enforced

#### State Migration
Old single-team state (with top-level `squad`/`formation`/`assignedCoach`) is auto-migrated to multi-team format in `importState`. The old fields are wrapped into a single team named "Команда 1".

### Formation System (`src/lib/formations.ts`)
5 formations available:
- **4-3-3** (default)
- **4-4-2**
- **3-5-2**
- **4-2-3-1**
- **5-3-2**

Each formation defines 11 slots with:
- Slot label (e.g., "GK", "CB", "LW")
- Position category (GK/DEF/MID/FWD)
- Visual x/y percentage for pitch rendering

### Squad Building
- User places owned footballers into formation slots on a per-team basis.
- Each slot has a preferred position category.
- Players CAN be placed in any slot (no hard restriction), but position mismatch affects battle strength.
- Each player can only occupy one slot within a team.

### Chemistry System (`src/lib/bonuses.ts`)
- **Club link:** Two+ players from the same club → bonus percentage.
- **Nationality link:** Two+ players from the same country → bonus percentage.
- Chemistry bonuses stack but are **capped at 40% total**.
- Visual: colored lines drawn between linked players on the pitch.
- Chemistry bonus from the **active team** applies as a percentage increase to ALL habit coin earnings.

### `computeActiveBonuses(squad)`
Takes a squad array `(string | null)[]` directly. Returns an array of active bonuses, each with:
- Label (count + club/country name)
- Percentage bonus (2% for 2 players, scaling up with more)

### `totalBonusPercent(bonuses)`
Sums all bonus percentages, capped at 40%.

---

## 6. Coach System (`src/data/coaches.ts`, `src/lib/coachPerks.ts`)

### Coach Properties
- **id, name, nationality, clubs** (career history)
- **emoji** — visual representation
- **perk** — { type, label, values: [level1, level2, level3] }

### Coach Levels
- First pull: level 1
- Duplicate pull: level up (max 3)
- Pulling at max level: 50 coin refund

### Perk Types and Effects
| Perk Type | Description | When Applied |
|-----------|-------------|-------------|
| `all_habit_pct` | +X% coins on ALL habits | Every completion |
| `streak_gte_flat` | +X flat coins if streak ≥ threshold | Completion with streak check |
| `streak_range_pct` | +X% coins if streak in range | Completion with streak check |
| `all_done_flat` | +X flat coins when ALL habits done today | After all habits completed |
| `all_done_pct` | +X% coins when ALL habits done today | After all habits completed |
| `daily_count_pct` | +X% if N+ habits completed today | Completion with count check |
| `habit_streak_flat` | +X flat per streak day | Completion |
| `before_noon_pct` | +X% if completed before 12:00 | Completion with time check |
| `active_habits_flat` | +X flat per active habit | Completion |
| `squad_full_pct` | +X% if squad is fully filled | Completion with squad check |
| `squad_min_pct` | +X% if squad has N+ players | Completion with squad check |
| `stat_boost` | Boost player stats in battle | Render-time / battle calc |

### `computeCoachHabitBonus(coach, habit, allHabits, squad)`
Returns bonus coins for a habit completion considering:
- The active coach's perk type and current level
- Habit's base value, streak, time of day
- Other habits' completion status
- Squad state

### `computeCoachChemistryPct(coach, squad, footballerMap)`
Some coaches may boost chemistry percentage based on their clubs/nationality matching squad.

---

## 7. Achievement System (`src/lib/achievements.ts`)

### Achievement Structure
Each achievement has:
- **id:** unique identifier
- **title:** display name (Ukrainian)
- **description:** what to do (Ukrainian)
- **category:** habits | collection | team | memes
- **icon:** emoji
- **reward:** coin amount
- **condition(state):** function that returns true when unlocked
- **progress(state):** optional, returns { current, target } for progress display

### Achievement Categories
1. **Habits** — completion milestones (first habit, 10/50/100 completions, streaks)
2. **Collection** — card ownership milestones (first card, all rarities, full collection)
3. **Team** — squad building (fill squad, set formation, assign coach)
4. **Memes** — fun football references (specific player combos, themed squads)

### Achievement Flow
1. After ANY state change → `checkAchievements(state)` runs.
2. Returns array of newly unlocked achievement IDs.
3. Each new unlock → `unlockAchievement(id)` called.
4. **AchievementToast** appears with animation + `playAchievementUnlock()` sound.
5. User can later **claim** the coin reward from Achievements page.

### Example Achievements (30+ total)
- "Перший крок" (First Step) — complete 1 habit → 10 coins
- "Центуріон" (Centurion) — 100 completions → 100 coins
- "Легенда" — pull a legendary card → 50 coins
- "Повний склад" — fill all 11 squad slots → 50 coins
- "MSN" — have Messi, Suarez, Neymar in squad → 75 coins

---

## 8. Daily Trivia (`src/data/triviaQuestions.ts`)

### Mechanics
- One trivia question per day (gated by `lastTriviaDate`).
- Question shown via **TriviaModal** on Dashboard load (once per day).
- 75 questions in Ukrainian, each with:
  - Question text
  - 4 answer options
  - Correct answer index
  - Fun fact (shown after answering)
- Correct answer: **+50 coins**.
- Wrong answer: no penalty, still shows fun fact.
- Question selection: random from pool, avoiding previously answered questions (tracked in `triviaHistory` array of indices).

### State Tracking
- `lastTriviaDate: string` — prevents showing more than once per day.
- `triviaHistory: number[]` — indices of already-answered questions.
- `answerTrivia(questionIndex)` — records answer, updates date.

---

## 9. Battle System

### Challenge Flow
1. User A follows User B (adds to `following` array).
2. User A sends **challenge** to User B via `sendChallenge()`.
3. User B can **accept** or **decline**.
4. On accept → `createMatch()` generates a seeded match.
5. Both users can watch the match replay (live simulation UI).

### Team Strength Calculation (`src/lib/battleEngine.ts`)
`calcTeamStrength(squad, formation, coach)` computes a composite score from 10 factors:
1. **Base stats** — sum of all player stats (pace, shooting, passing, dribbling)
2. **Position fit** — bonus for players in their natural position
3. **Rarity weight** — higher rarity → higher base contribution
4. **Formation bonus** — some formations favor certain play styles
5. **Chemistry** — club/nationality links boost strength
6. **Matchup** — tactical advantage based on formation vs opponent formation
7. **Coach bonus** — coach perk with `stat_boost` type
8. **Streak bonus** — players from active habits get streak consideration
9. **Form** — slight randomness (seeded) for realism
10. **Leader bonus** — legendary players provide team-wide small boost

### Match Simulation (`simulateMatch()`)
- Uses **seeded RNG** (`src/lib/seededRng.ts`) for deterministic outcomes.
- Seed derived from challenge/match ID → same match always produces same result.
- Generates **match events** including cinematic lead-in events.
- Final score determined by team strength differential + random variance.

### Match Events
Event types:
- **goal** — scored by a specific player, with minute
- **yellow_card** / **red_card** — disciplinary action
- **near_miss** — close chance that didn't convert
- **great_save** — goalkeeper heroics
- **momentum_shift** — tactical change affecting flow
- **penalty** — cinematic lead-in: foul in box → penalty kick sequence (~15% of goals)
- **free_kick** — cinematic lead-in: foul near box → free kick sequence (~20% of goals)
- **counterattack** — cinematic lead-in: fast break sequence (~15% of goals)
- **corner** — flavor event with ~10% chance, can score (~15%) by consuming a budgeted goal
- **var_review** — ~10% chance after any goal; 70% confirmed, 30% disallowed (score adjusted)
- **substitution** — player swap at halftime or after red card

### Cinematic Event System
- Cinematic events (`penalty`, `free_kick`, `corner`, `counterattack`) are **lead-in events** that precede the canonical outcome event (`goal`, `great_save`, `near_miss`).
- Each cinematic event carries a `phases` array defining a multi-step sequence with durations (e.g., penalty: foul → whistle → walk to spot → keeper ready → kick → outcome, ~5.1s total).
- The UI freezes the match timer during cinematic phases and plays an animated overlay (`CinematicOverlay`).
- VAR reviews carry `varOutcome: 'confirmed' | 'disallowed'` — if disallowed, the score is decremented.
- Regular goals (50% of all goals) play without cinematic lead-ins, behaving as before.

### Auto-Bench System (`pickAutoBench()`)
- When building a squad snapshot, 3 bench players are auto-picked from the owner's collection.
- Selection: one per position (DEF, MID, FWD) sorted by overall rating; no GKs.
- If fewer than 3 non-starting players available, bench is smaller.
- Bench stored in `SquadSnapshot.bench` (optional, absent in old matches).

### Substitutions
- **Halftime (minute 46):** The 2 lowest-rated outfield players are subbed out for position-matched bench players. Rating uses `calcRating()` with first-half event stats + form roll tiebreaker.
- **Red card:** Immediately after a red card, a bench player matching the sent-off player's position enters on the next minute.
- Substitution events show in commentary and post-match lineups with sub-in/sub-out indicators.

### Rewards
- **Win:** +100 coins
- **Draw:** +50 coins
- **Loss:** 0 coins
- Coins auto-claimed when viewing an unwatched match result.
- `watchedMatches` tracked in SessionStorage to prevent double-claiming.

### Live Match UI (`MatchLive.tsx`)
- Events play out in real-time with sound effects.
- Score updates, event animations, commentary.
- **Phase machine** freezes the minute timer during cinematic events; phases advance on their own durations.
- **CinematicOverlay** renders animated sequences (penalty spot zoom, free kick wall, corner cross, counterattack passes, VAR screen tint) on top of the pitch.
- Phase-by-phase commentary in Ukrainian updates during cinematics.
- Post-match lineups include a "Лава" (Bench) section with sub indicators (↑/↓ minute).
- Sounds: `playGoal()`, `playYellowCard()`, `playRedCard()`, `playNearMiss()`, `playGreatSave()`, `playFinalWhistle()`, `playWhistleShort()`, `playTensionBuild()`, `playKickImpact()`, `playVarBeep()`, `playCrowdRoar()`, `playCrowdGroan()`, `playSubstitution()`, `playCounterattackBuild()`.

---

## 10. Social / Friends System

### Following
- Users can search for other users by username.
- "Follow" adds their user ID to `following` array.
- Following is one-directional (no mutual requirement).

### Friend Profile (`FriendProfile.tsx`)
- View another user's squad, formation, collection stats.
- Read-only — cannot modify their data.

### Battle Integration
- Can only send challenges to followed users.
- Match history shows all past battles with results.

---

## 11. Authentication & Data Persistence

### Auth Flow (`src/store/useAuthStore.ts`)
- **Supabase Auth** (email + password).
- Sign up → creates auth user → triggers state sync.
- Sign in → loads state from Supabase → imports to Zustand.
- Sign out → clears local state, navigates to /login.

### State Sync (`src/lib/stateSync.ts`)
- **saveState(userId, state)** — upserts to `user_state` table (JSONB).
- **loadState(userId)** — fetches from `user_state` table.
- **scheduleSave()** — debounced (1.5s) auto-save on state changes.
- **flushSave()** — immediate save (used on page unload).
- **beaconSave()** — `navigator.sendBeacon` fallback for unload events.

### Local → Cloud Migration
- On first signup, if local state exists, it's migrated to the cloud.
- Prevents data loss for users who played before creating an account.

---

## 12. Coin Earning Formula (Complete)

When a habit is completed, the total coins earned are:

```
base_coins = habit.coinValue
streak_mult = streakMultiplier(habit.streak)  // 1.0, 1.25, 1.5, or 2.0
chemistry_pct = totalBonusPercent(computeActiveBonuses(squad))  // 0–40%
coach_bonus = computeCoachHabitBonus(coach, habit, allHabits, squad)  // flat or %

// If coach perk is percentage-based:
total = floor(base_coins × streak_mult × (1 + chemistry_pct/100 + coach_pct/100))

// If coach perk is flat:
total = floor(base_coins × streak_mult × (1 + chemistry_pct/100)) + coach_flat_bonus
```

The HabitCard UI shows a breakdown tooltip: base, streak multiplier, chemistry %, coach bonus.
