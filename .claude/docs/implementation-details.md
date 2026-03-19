# HabitFC — Implementation Details Reference

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2 |
| Language | TypeScript | 5.9 (strict mode) |
| Build | Vite | 7.3 |
| Styling | Tailwind CSS | 4.2 |
| State | Zustand | 5.0 |
| Animation | Framer Motion | 12.35 |
| Drag & Drop | @dnd-kit/core + sortable | 6.3 / 10.0 |
| Routing | React Router | 7.13 |
| Backend | Supabase (auth, DB, storage) | — |
| Audio | Web Audio API (native) | — |

---

## Project Structure

```
src/
├── main.tsx                    # React root mount
├── App.tsx                     # Router + layout (Nav + Routes)
├── index.css                   # Tailwind + custom utilities
├── types.ts                    # All TypeScript interfaces
│
├── store/
│   ├── useAppStore.ts          # Zustand store (all game state + actions)
│   └── useAuthStore.ts         # Auth state (Supabase session)
│
├── pages/
│   ├── Dashboard.tsx           # Home: habits, coins, trivia
│   ├── LoginPage.tsx           # Auth UI (login/register tabs)
│   ├── Shop.tsx                # Pack store + coach packs
│   ├── PackOpening.tsx         # Gacha animation flow
│   ├── Collection.tsx          # Card gallery + coaches
│   ├── Team.tsx                # Squad builder + formation picker
│   ├── Achievements.tsx        # Achievement list + claim rewards
│   ├── Friends.tsx             # Search, challenges, match history
│   └── FriendProfile.tsx       # View other user's team/collection
│
├── components/
│   ├── AuthGuard.tsx           # Auth + state sync wrapper
│   ├── ErrorBoundary.tsx       # Error catch fallback
│   │
│   ├── habits/
│   │   ├── HabitList.tsx       # Grid + drag-to-reorder
│   │   ├── HabitCard.tsx       # Individual habit UI + complete
│   │   └── HabitFormModal.tsx  # Create/edit habit modal
│   │
│   ├── cards/
│   │   ├── FootballerCard.tsx  # Player card (full/mini)
│   │   ├── FootballerModal.tsx # Expanded card detail view
│   │   ├── PackCard.tsx        # Pack in shop (odds table)
│   │   └── CoachCard.tsx       # Coach card + perk display
│   │
│   ├── ui/
│   │   ├── CoinDisplay.tsx     # Coin counter
│   │   ├── CoinIcon.tsx        # Coin emoji component
│   │   ├── StreakBadge.tsx      # Fire icon + streak number
│   │   ├── EmojiPicker.tsx     # Avatar emoji selector
│   │   ├── TriviaModal.tsx     # Daily trivia question
│   │   ├── ProfileModal.tsx    # Username + avatar settings
│   │   └── AchievementToast.tsx# Unlock notification
│   │
│   ├── battle/
│   │   ├── MatchLive.tsx       # Live match simulation UI + phase machine
│   │   └── CinematicOverlay.tsx# Animated overlays for cinematic events
│   │
│   └── pitch/
│       └── PitchHelpers.tsx    # SVG pitch + player placement
│
├── lib/
│   ├── streaks.ts              # Streak calc + multipliers
│   ├── gacha.ts                # Pack opening + pity system
│   ├── bonuses.ts              # Squad chemistry bonuses
│   ├── coachPerks.ts           # Coach perk calculations
│   ├── achievements.ts         # Achievement definitions + checker
│   ├── formations.ts           # Formation slot layouts
│   ├── rarityConfig.ts         # Rarity colors/styles
│   ├── sounds.ts               # Web Audio API synthesized SFX
│   ├── stateSync.ts            # Supabase state persistence
│   ├── supabase.ts             # Supabase client init
│   ├── battleEngine.ts         # Team strength + match sim + cinematic events + auto-bench
│   ├── playerRating.ts         # Shared player rating (buildPlayerStats, calcRating)
│   ├── battleApi.ts            # Supabase RPC for battles
│   ├── seededRng.ts            # Deterministic RNG
│   ├── watchedMatches.ts       # SessionStorage match tracking
│   └── profileSync.ts          # Profile data CRUD
│
├── hooks/
│   ├── useBattle.ts            # Battle state + auto-claim
│   └── useUnwatchedCount.ts    # Unwatched match counter
│
└── data/
    ├── footballers.ts          # 250+ player cards + lookup map
    ├── packs.ts                # 3 pack definitions
    ├── coaches.ts              # 10+ coach definitions
    ├── coachPack.ts            # Coach pack config
    └── triviaQuestions.ts      # 75 trivia questions (Ukrainian)
```

---

## Routing & Layout (`src/App.tsx`)

```
BrowserRouter (basename="/HabitFC/")
├── NavBar (desktop only, hidden on mobile)
├── BottomNav (mobile only, fixed bottom)
└── Routes:
    ├── /login           → LoginPage (public)
    ├── /                → Dashboard (auth required)
    ├── /shop            → Shop (auth required)
    ├── /open            → PackOpening (auth required)
    ├── /collection      → Collection (auth required)
    ├── /team            → Team (auth required)
    ├── /achievements    → Achievements (auth required)
    ├── /friends         → Friends (auth required)
    └── /profile/:userId → FriendProfile (auth required)
```

- `AuthGuard` wraps all authenticated routes — handles session restore, state loading, and sync subscription.
- Navigation badges: BottomNav shows unwatched match count on Friends tab.

---

## State Management (`src/store/useAppStore.ts`)

### Zustand Store Shape

```typescript
interface AppState {
  coins: number;
  habits: Habit[];
  collection: string[];           // array of footballer IDs owned
  pullHistory: string[];           // history of pulled card IDs
  squad: Record<string, string>;   // slot label → footballer ID
  formation: string;               // e.g. "4-3-3"
  achievements: Record<string, { unlocked: boolean; claimed: boolean }>;
  pendingUnlocks: string[];        // achievement IDs to show toast for
  pityCounters: Record<string, number>; // rarity → packs since last pull
  totalCompletions: number;
  coachCollection: Record<string, number>; // coach ID → level (1-3)
  assignedCoach: string | null;    // active coach ID
  following: string[];             // user IDs being followed
  lastTriviaDate: string;          // YYYY-MM-DD
  triviaHistory: number[];         // answered question indices
  _stateLoaded: boolean;           // flag: Supabase state has been imported
}
```

### Key Actions

| Action | What it does |
|--------|-------------|
| `addHabit(habit)` | Push new habit to array |
| `updateHabit(id, updates)` | Merge updates into existing habit |
| `removeHabit(id)` | Filter habit out by ID |
| `reorderHabits(newOrder)` | Replace habits array (from drag-and-drop) |
| `completeHabit(id)` | Calculate coins, update streak, add coins, increment completions, check achievements |
| `buyPack(packId)` | Deduct cost, call `openPack()`, add new cards to collection, handle duplicates, update pity |
| `buyCoachPack()` | Deduct 500, random coach, add/level-up in coachCollection |
| `setSquadSlot(slot, playerId)` | Assign player to formation slot |
| `setFormation(formation)` | Change active formation |
| `assignCoach(coachId)` | Set active coach |
| `unlockAchievement(id)` | Mark achievement as unlocked, add to pendingUnlocks |
| `claimAchievementReward(id)` | Mark claimed, add reward coins |
| `answerTrivia(index)` | Add to triviaHistory, update lastTriviaDate |
| `importState(state)` | Merge cloud state into store (used on login/sync) |
| `resetAll()` | Factory reset all state to defaults |

### Sync Mechanism
- `syncSubscribe()` is called once on auth → subscribes to Zustand store changes.
- Every state change triggers `scheduleSave()` which debounces 1.5s then calls `saveState()`.
- On page unload: `flushSave()` or `beaconSave()` for best-effort persistence.

---

## Authentication (`src/store/useAuthStore.ts`, `src/components/AuthGuard.tsx`)

### Auth Store
```typescript
interface AuthState {
  user: User | null;
  loading: boolean;
  signIn(email, password): Promise<void>;
  signUp(email, password): Promise<void>;
  signOut(): Promise<void>;
}
```

### AuthGuard Component (wraps all auth routes)
1. On mount: calls `supabase.auth.getSession()`.
2. If session exists → sets user → calls `loadState(userId)` → `importState()`.
3. Subscribes to `onAuthStateChange` for session refresh/logout.
4. Calls `syncSubscribe()` to start auto-saving.
5. On unmount / sign out: unsubscribes sync.

### Login Page
- Two tabs: Login / Register.
- On register: if any local Zustand state exists, migrates it to cloud on first save.
- Validation: email format, password length.

---

## Supabase Integration

### Client (`src/lib/supabase.ts`)
```typescript
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Database Tables (inferred from code)
| Table | Columns | Purpose |
|-------|---------|---------|
| `user_state` | user_id (PK), username, avatar_url, avatar_emoji, state (JSONB), updated_at | All game state |
| `challenges` | id, challenger_id, challenged_id, status, challenger_squad, challenged_squad, timestamps | Battle challenges |
| `matches` | id, challenge_id, match_seed, result, events | Match results |

### Storage Buckets
- `avatars` — user avatar image uploads.

### RPC Functions (called from `battleApi.ts`)
- Challenge CRUD operations.
- Match creation with seeded results.

### State Persistence (`src/lib/stateSync.ts`)
```typescript
saveState(userId, state)    // upsert user_state with JSONB state
loadState(userId)           // fetch user_state row
scheduleSave()              // 1.5s debounce wrapper around saveState
flushSave()                 // immediate save (cancel pending debounce)
beaconSave()                // navigator.sendBeacon fallback on unload
```

---

## Component Architecture

### Page → Component Hierarchy

```
Dashboard
├── CoinDisplay
├── HabitList
│   └── HabitCard (×N, sortable via dnd-kit)
│       └── StreakBadge
├── HabitFormModal (conditional)
├── TriviaModal (once per day)
└── AchievementToast (on unlock)

Shop
├── PackCard (×3 — basic, premium, elite)
├── CoachCard (coach pack section)
└── CoinDisplay

PackOpening
├── Phase: confirm → opening → cards → done
├── FootballerCard (×N during reveal)
└── Sound triggers per phase

Collection
├── Rarity filter tabs
├── FootballerCard (×N, mini mode)
├── FootballerModal (on click)
└── CoachCard (×N, owned coaches)

Team
├── PitchHelpers (SVG pitch + player positions)
├── Formation selector
├── Coach selector
├── FootballerCard (draggable, in squad slots)
└── Chemistry visualization (lines between linked players)

Achievements
├── Category tabs
├── Achievement cards (locked/unlocked/claimed states)
└── Progress indicators

Friends
├── User search
├── Challenge list (incoming/outgoing)
├── Match history
├── MatchLive (on match click)
│   ├── CinematicOverlay (during cinematic events)
│   └── PostMatchLineup (with bench section)
└── useUnwatchedCount (badge)
```

### Drag & Drop (dnd-kit)

**HabitList** uses:
- `DndContext` with `closestCenter` collision detection
- `SortableContext` with `verticalListSortingStrategy`
- Each `HabitCard` wrapped in `useSortable`
- `onDragEnd` → `reorderHabits(newOrder)` in store

---

## Sound System (`src/lib/sounds.ts`)

All audio is synthesized via **Web Audio API** — zero external audio files.

### Architecture
- Lazy `AudioContext` creation (on first user interaction).
- Each sound function creates oscillators/nodes, schedules events, then lets them auto-dispose.
- Sounds are fire-and-forget (no state tracking).

### Sound Catalog

| Function | Trigger | Design |
|----------|---------|--------|
| `playHabitComplete()` | Habit completion | Triangle wave sweep 200→880Hz + E6/G6 two-note ding |
| `playPackOpen()` | Pack opening animation | Bandpass noise sweep (tension) → bass thud 120→35Hz → rumble burst |
| `playCardSlide()` | Card reveal sliding in | Broadband noise through highpass 3kHz (simple swish) |
| `playCardFlip(rarity)` | Card flip reveal | Varies by rarity (see below) |
| `playAchievementUnlock()` | Achievement unlocked | Rising arpeggio + chord bloom + sparkle cascade |
| `playGoal()` | Match goal event | Crowd roar + horn blast |
| `playYellowCard()` | Match yellow card | Sharp whistle |
| `playRedCard()` | Match red card | Harsh whistle + dramatic sting |
| `playNearMiss()` | Match near miss | Quick tension rise + release |
| `playGreatSave()` | Match great save | Impact thud + crowd reaction |
| `playFinalWhistle()` | Match end | Triple whistle blast |
| `playWhistleShort()` | Cinematic foul call | Sine 3200→2600Hz, 0.15s |
| `playTensionBuild()` | Cinematic setup phase | Bandpass noise rising 80→400Hz over 2s |
| `playKickImpact()` | Cinematic kick/shot/header | Low sine thud 150→50Hz |
| `playVarBeep()` | VAR check phase | Three ascending square tones (800/1000/1200Hz) |
| `playCrowdRoar()` | VAR confirmed | Bandpass noise burst, 1.1s celebration |
| `playCrowdGroan()` | VAR disallowed | Descending bandpass noise 600→200Hz |
| `playSubstitution()` | Player substitution | Short whistle + high-passed applause noise |
| `playCounterattackBuild()` | Counterattack sequence | 6 accelerating sine clicks 400→800Hz |

### Card Flip Sound by Rarity
| Rarity | Sound |
|--------|-------|
| Common | Quiet high-frequency flip swish |
| Rare | FM synthesis bell tone |
| Epic | Sawtooth power chord through waveshaper distortion |
| Legendary | Deep bass + warm chord + sparkle cascade arpeggio |

---

## Visual Design System

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0A0F1A` | Page background |
| Primary green | `#00E676` | Active states, buttons, accents |
| Text light | `#E8F0FF` | Primary text |
| Text muted | `#5A7090` | Secondary text |
| Gold | `#FBBF24` | Coins, coach highlights |
| Common | `gray-400` | Common rarity |
| Rare | `blue-400` | Rare rarity |
| Epic | `pink-400` | Epic rarity |
| Legendary | `yellow-400` | Legendary rarity |

### Custom CSS Utilities (`src/index.css`)
```css
.glow-common    { box-shadow: 0 0 12px rgba(156,163,175,0.4) }
.glow-rare      { box-shadow: 0 0 16px rgba(96,165,250,0.5) }
.glow-epic      { box-shadow: 0 0 20px rgba(244,114,182,0.6) }
.glow-legendary { box-shadow: 0 0 24px rgba(250,204,21,0.7) }
.stadium-lines  { /* diagonal stripe background */ }
.hide-scrollbar { /* hides scrollbar cross-browser */ }
```

### Typography
- **Oswald** (`font-oswald`) — uppercase headers, labels, badges, navigation
- **System UI** — body text, descriptions, form inputs

### Rarity Config (`src/lib/rarityConfig.ts`)
Centralized styling per rarity:
```typescript
{
  border: string,    // Tailwind border class
  bg: string,        // Background class
  glow: string,      // Glow utility class
  label: string,     // Display name (Ukrainian)
  color: string,     // Text color class
}
```

---

## Animation Patterns (Framer Motion)

### Pack Opening (`PackOpening.tsx`)
- **Confirm phase:** Pack card scales in with spring animation.
- **Opening phase:** Pack shakes (x oscillation) intensifying over 2s, then exits.
- **Card reveal:** Cards enter from right (`x: 300 → 0`), staggered 0.3s apart.
- **Card flip:** `rotateY: 180 → 0` with scale pulse on completion.

### Achievement Toast (`AchievementToast.tsx`)
- Slides in from top (`y: -100 → 0`).
- Gold border glow animation.
- Auto-dismisses after 4s with exit animation.

### HabitCard Completion
- Scale pulse (`1 → 1.05 → 1`) on completion.
- Coin counter increment animation.
- Checkmark appear with spring.

### Navigation
- Page transitions: fade + slight Y shift.

---

## Battle Engine (`src/lib/battleEngine.ts`)

### Team Strength Algorithm
```typescript
calcTeamStrength(squad, formation, coach): number
```

10 weighted sub-scores:
1. **Base stats (40%)** — Sum of all player stats (pace + shooting + passing + dribbling) across 11 players
2. **Position fit (15%)** — Each player in correct position category gets bonus
3. **Rarity multiplier (10%)** — common=1.0, rare=1.2, epic=1.5, legendary=2.0
4. **Formation cohesion (5%)** — Bonus if formation slots are fully filled
5. **Chemistry (10%)** — Club + nationality links (reuses `computeActiveBonuses`)
6. **Matchup (5%)** — Rock-paper-scissors: attacking formations beat balanced, balanced beats defensive, etc.
7. **Coach bonus (5%)** — If coach has `stat_boost` perk, applied here
8. **Streak (3%)** — Average habit streak of user (proxied through state)
9. **Form (5%)** — Seeded random variance (±5%)
10. **Leader (2%)** — Legendary player count × small bonus

### Match Simulation
```typescript
simulateMatch(homeSnap, awaySnap, rng): SimulationResult
```

- Creates seeded RNG from match seed string.
- Determines expected goals from strength differential.
- Generates minute-by-minute events probabilistically.
- **Cinematic goal rolling:** 50% regular, 15% penalty, 20% free kick, 15% counterattack. Cinematic goals emit a lead-in event (with `phases` array) followed by a canonical `goal` event.
- **Corner events:** ~10% of flavor events. Can score (15% chance) by consuming a future budgeted goal.
- **VAR reviews:** ~10% after any goal. 70% confirmed, 30% disallowed (score adjusted immediately).
- **Halftime subs (minute 46):** 2 lowest-rated outfield players swapped with position-matched bench players.
- **Red card subs:** Immediate sub from bench on next minute.
- Returns: final score, events array, winner/draw.

### Auto-Bench (`pickAutoBench()`)
```typescript
pickAutoBench(collection: string[], startingSquad: string[]): string[]
```
- Filters collection to non-starting, non-GK players sorted by overall rating.
- Picks one per position (DEF, MID, FWD), fills remaining from best available.
- Returns 0-3 bench player IDs.

### Player Rating (`src/lib/playerRating.ts`)
```typescript
buildPlayerStats(events: MatchEvent[]): Record<string, PlayerMatchStats>
calcRating(playerId, stats, formRoll?): number  // 5.0-10.0
```
- Shared module used by both engine (halftime sub decisions) and UI (post-match display).
- `formRoll` tiebreaker: maps [-5, 10] to ±0.3 nudge for players with no events.

### Cinematic Overlay (`src/components/battle/CinematicOverlay.tsx`)
- Renders animated overlays on the pitch during cinematic events.
- Switches on `event.type` for 5 variants: penalty, free_kick, corner, counterattack, var_review.
- Phase timer: `useEffect` + `setTimeout` per phase, calls `onPhaseComplete` callback.
- Sound triggers per phase (whistle, tension build, kick impact, VAR beep, etc.).
- Framer Motion `AnimatePresence` for smooth phase transitions.

### Match Phase Machine (`MatchLive.tsx`)
- `cinematicEvent` state + `cinematicPhaseIndex` + `cinematicQueueRef`.
- When a minute has cinematic events, ALL events for that minute are queued.
- Queue drains sequentially: cinematics show overlay, regular events process normally.
- Timer freezes while cinematic is active or queue is draining.
- `handlePhaseComplete` advances phases, then calls `startNextFromQueue`.

### Seeded RNG (`src/lib/seededRng.ts`)
```typescript
createRng(seed: string): () => number  // returns 0-1
hashSeed(input: string): number        // string → numeric seed
```
Ensures identical match seed always produces identical match outcome (allows server-side verification).

---

## Hooks

### `useBattle()` (`src/hooks/useBattle.ts`)
Returns:
- `challenges` — active incoming/outgoing challenges
- `matchHistory` — completed matches
- `unwatchedCount` — number of unviewed match results
- `sendChallenge(userId)` / `acceptChallenge(id)` / `declineChallenge(id)`
- Auto-claims coins for unwatched matches when viewed

### `useUnwatchedCount()` (`src/hooks/useUnwatchedCount.ts`)
- Returns count of matches not yet viewed.
- Used for badge display on Friends nav tab.
- Reads from `watchedMatches` SessionStorage tracker.

---

## Data Files

### Footballers (`src/data/footballers.ts`)
- 250+ `Footballer` objects in a flat array.
- Each has: id, name, club, nationality, rarity, position, stats, emoji.
- `footballerMap: Map<string, Footballer>` — O(1) lookup by ID.
- `playerOverall(player): number` — position-weighted average of stats.

### Packs (`src/data/packs.ts`)
3 pack definitions with rarity weight distributions and costs.

### Coaches (`src/data/coaches.ts`)
10+ coaches with unique perks. Each perk has 3 level values.

### Coach Pack (`src/data/coachPack.ts`)
Single coach pack config: { name, cost: 500, emoji }.

### Trivia (`src/data/triviaQuestions.ts`)
75 football trivia questions in Ukrainian. Each: question, options[4], correctIndex, funFact.

---

## Build & Deployment

### Vite Config (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/HabitFC/',
});
```

### Scripts
```json
"dev": "vite",
"build": "tsc -b && vite build",
"preview": "vite preview"
```

### GitHub Pages
- Output: `/dist` directory.
- Hosted at `https://<username>.github.io/HabitFC/`.
- SPA routing handled via `index.html` session storage redirect trick (404.html → index.html with path preservation).

### Environment Variables
```
VITE_SUPABASE_URL=<supabase project url>
VITE_SUPABASE_ANON_KEY=<supabase anon key>
```

---

## Key Patterns & Conventions

### State Updates
- All state mutations go through Zustand actions (never direct state mutation).
- Actions use `set((state) => ({...}))` pattern (immer-free).
- Side effects (achievements, sync) triggered within actions or via subscriptions.

### Date Handling
- All dates as `YYYY-MM-DD` strings (no Date objects in state).
- `getToday()` centralizes date string generation.
- Streak comparison: string equality / day-before calculation.

### ID Generation
- Habit IDs: `crypto.randomUUID()` (browser native).
- Card IDs: predefined in data files (stable, not generated).

### Error Handling
- `ErrorBoundary` at app root catches render errors.
- Supabase calls use try/catch with console.error logging.
- No global error toast system (errors silently logged).

### Mobile-First Responsive
- BottomNav: `md:hidden` (mobile only).
- NavBar: `hidden md:flex` (desktop only).
- Grids: `grid-cols-2 lg:grid-cols-3` pattern.
- Safe area: `pb-[env(safe-area-inset-bottom)]` on BottomNav.
- Touch targets: minimum 44px.

### Language
- All user-facing text is hardcoded Ukrainian.
- No i18n framework — strings are inline in components.
- Position abbreviations: ВР (GK), ЗАХ (DEF), ПЗА (MID), НАП (FWD).

### TypeScript
- Strict mode enabled.
- All types in `src/types.ts` (single source of truth).
- No `any` usage (enforced by strict config).
- Interfaces preferred over type aliases for object shapes.
