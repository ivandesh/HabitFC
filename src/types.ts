export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Habit {
  id: string
  name: string
  icon: string
  coinValue: number
  streak: number
  lastCompleted: string // ISO date string YYYY-MM-DD, empty string if never
}

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface Footballer {
  id: string
  name: string
  club: string
  nationality: string
  rarity: Rarity
  position: Position
  stats: { pace: number; shooting: number; passing: number; dribbling: number }
  emoji: string
  photoUrl?: string
}

export interface Pack {
  id: string
  name: string
  cost: number
  cardCount: number
  weights: Record<Rarity, number>
}

export interface AppState {
  coins: number
  habits: Habit[]
  collection: Record<string, number>
  pullHistory: { footballerId: string; pulledAt: string }[]
  squad: (string | null)[]
  achievements: Record<string, { unlockedAt: string }>
  totalCompletions: number
  formation: string
  pendingUnlocks: string[]  // not persisted — UI drain queue
  pityCounters: Record<string, number>  // keyed by pack id
  coachCollection: Record<string, number>   // coachId → copies owned
  assignedCoach: string | null
}

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
