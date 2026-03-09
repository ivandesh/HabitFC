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
}
