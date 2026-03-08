export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Habit {
  id: string
  name: string
  icon: string
  coinValue: number
  streak: number
  lastCompleted: string // ISO date string YYYY-MM-DD, empty string if never
}

export interface Footballer {
  id: string
  name: string
  club: string
  nationality: string
  rarity: Rarity
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
}
