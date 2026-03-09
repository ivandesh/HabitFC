import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Habit, Footballer, AppState } from '../types'
import { calculateNewStreak, streakMultiplier, isCompletedToday, getToday } from '../lib/streaks'
import { duplicateRefund } from '../lib/gacha'
import { computeActiveBonuses, totalBonusPercent } from '../lib/bonuses'
import { checkAchievements } from '../lib/achievements'

interface AppStore extends AppState {
  // Habit actions
  addHabit: (habit: Omit<Habit, 'id' | 'streak' | 'lastCompleted'>) => void
  removeHabit: (id: string) => void
  reorderHabits: (ids: string[]) => void
  completeHabit: (id: string) => void
  // Shop actions
  buyPack: (cost: number, cards: Footballer[]) => { refund: number; newCards: string[]; newUnlockIds: string[] }
  pushPendingUnlock: (id: string) => void
  // Coins
  addCoins: (amount: number) => void
  // Squad
  setSquadSlot: (slotIndex: number, footballerId: string | null) => void
  // Reset
  resetAll: () => void
  // Achievements
  unlockAchievement: (id: string) => void
  drainPendingUnlock: () => string | undefined
  setFormation: (formation: string) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      coins: 200,
      habits: [],
      collection: {},
      pullHistory: [],
      squad: Array(11).fill(null),
      achievements: {},
      totalCompletions: 0,
      formation: '4-3-3',
      pendingUnlocks: [],

      addHabit: (habitData) => {
        const habit: Habit = {
          id: crypto.randomUUID(),
          streak: 0,
          lastCompleted: '',
          ...habitData,
        }
        set(state => ({ habits: [...state.habits, habit] }))
      },

      removeHabit: (id) => {
        set(state => ({ habits: state.habits.filter(h => h.id !== id) }))
      },

      reorderHabits: (ids) => {
        set(state => ({
          habits: ids.map(id => state.habits.find(h => h.id === id)!).filter(Boolean),
        }))
      },

      completeHabit: (id) => {
        set(state => {
          const habit = state.habits.find(h => h.id === id)
          if (!habit || isCompletedToday(habit.lastCompleted)) return state

          const newStreak = calculateNewStreak(habit.streak, habit.lastCompleted)
          const multiplier = streakMultiplier(newStreak)
          const baseCoin = Math.round(habit.coinValue * multiplier)
          const bonuses = computeActiveBonuses(state)
          const bonusPct = totalBonusPercent(bonuses)
          const earned = Math.round(baseCoin * (1 + bonusPct / 100))

          return {
            coins: state.coins + earned,
            habits: state.habits.map(h =>
              h.id === id
                ? { ...h, streak: newStreak, lastCompleted: getToday() }
                : h
            ),
            totalCompletions: state.totalCompletions + 1,
          }
        })
        // Check achievements after state update
        const newUnlocks = checkAchievements(get())
        for (const achievementId of newUnlocks) {
          get().unlockAchievement(achievementId)
        }
      },

      buyPack: (cost, cards) => {
        const state = get()
        const newCollection = { ...state.collection }
        let refund = 0
        const newCards: string[] = []

        for (const card of cards) {
          const owned = newCollection[card.id] ?? 0
          if (owned > 0) {
            refund += duplicateRefund(card.rarity)
          } else {
            newCards.push(card.id)
          }
          newCollection[card.id] = owned + 1
        }

        const pullHistory = [
          ...state.pullHistory,
          ...cards.map(c => ({ footballerId: c.id, pulledAt: new Date().toISOString() })),
        ]

        set({
          coins: state.coins - cost + refund,
          collection: newCollection,
          pullHistory,
        })

        // Record achievements in state but don't queue toasts yet —
        // PackOpening will queue them as each card is flipped.
        const newUnlockIds = checkAchievements(get())
        if (newUnlockIds.length > 0) {
          const unlockedAt = new Date().toISOString()
          set(s => ({
            achievements: Object.fromEntries([
              ...Object.entries(s.achievements),
              ...newUnlockIds.map(id => [id, { unlockedAt }]),
            ]),
          }))
        }

        return { refund, newCards, newUnlockIds }
      },

      addCoins: (amount) => {
        set(state => ({ coins: state.coins + amount }))
      },

      setSquadSlot: (slotIndex, footballerId) => {
        set(state => {
          const squad = [...(state.squad ?? Array(11).fill(null))]
          squad[slotIndex] = footballerId
          return { squad }
        })
        const newUnlocks = checkAchievements(get())
        for (const achievementId of newUnlocks) {
          get().unlockAchievement(achievementId)
        }
      },

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
        })
      },

      unlockAchievement: (id) => {
        set(state => ({
          achievements: {
            ...state.achievements,
            [id]: { unlockedAt: new Date().toISOString() },
          },
          pendingUnlocks: [...state.pendingUnlocks, id],
        }))
      },

      pushPendingUnlock: (id) => {
        set(state => ({ pendingUnlocks: [...state.pendingUnlocks, id] }))
      },

      drainPendingUnlock: () => {
        const state = get()
        if (state.pendingUnlocks.length === 0) return undefined
        const [next, ...rest] = state.pendingUnlocks
        set({ pendingUnlocks: rest })
        return next
      },

      /** Updates formation and resets squad to all-null (positions change between formations). */
      setFormation: (formation) => {
        set({ formation, squad: Array(11).fill(null) })
      },
    }),
    {
      name: 'habit-tracker-store',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { pendingUnlocks, ...rest } = state
        return rest
      },
    }
  )
)
