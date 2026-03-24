import { create } from 'zustand'
import type { Habit, Footballer, AppState, Team } from '../types'
import { scheduleSave, flushSave } from '../lib/stateSync'
import { calculateNewStreak, streakMultiplier, isCompletedToday, getToday } from '../lib/streaks'
import { duplicateRefund } from '../lib/gacha'
import { footballerMap } from '../data/footballers'
import { computeActiveBonuses, totalBonusPercent } from '../lib/bonuses'
import { checkAchievements, ACHIEVEMENTS } from '../lib/achievements'
import { computeCoachHabitBonus, computeCoachChemistryPct, getAssignedCoach } from '../lib/coachPerks'
import { getActiveTeam, createDefaultTeam, migrateOldState, updateTeamInArray } from '../lib/teamHelpers'

const _initTeamId = crypto.randomUUID()

interface AppStore extends AppState {
  // Habit actions
  addHabit: (habit: Omit<Habit, 'id' | 'streak' | 'lastCompleted'>) => void
  updateHabit: (id: string, patch: Pick<Habit, 'name' | 'icon' | 'coinValue'>) => void
  removeHabit: (id: string) => void
  reorderHabits: (ids: string[]) => void
  completeHabit: (id: string) => void
  // Shop actions
  buyPack: (cost: number, cards: Footballer[], packId: string, nextPityCounter: number) => { refund: number; newCards: string[]; newUnlockIds: string[] }
  pushPendingUnlock: (id: string) => void
  // Coins
  addCoins: (amount: number) => void
  // Squad — now takes teamId
  setSquadSlot: (teamId: string, slotIndex: number, footballerId: string | null) => void
  // Coach — now takes teamId
  assignCoach: (teamId: string, coachId: string | null) => void
  buyCoachPack: (coachId: string, cost: number) => { isLevelUp: boolean; newLevel: number; refundCoins: number; newUnlockIds: string[] }
  // Formation — now takes teamId
  setFormation: (teamId: string, formation: string) => void
  // New team actions
  createTeam: (name: string) => void
  renameTeam: (teamId: string, name: string) => void
  deleteTeam: (teamId: string) => void
  setActiveTeam: (teamId: string) => void
  // Reset
  resetAll: () => void
  // Import/Export
  importState: (data: Partial<AppState>) => void
  // Achievements
  unlockAchievement: (id: string) => void
  claimAchievementReward: (id: string) => void
  drainPendingUnlock: () => string | undefined
  setFollowing: (ids: string[]) => void
  answerTrivia: (questionId: number, correct: boolean) => void
  // Non-persisted UI state
  _stateLoaded: boolean
}

export const useAppStore = create<AppStore>()((set, get) => ({
      coins: 200,
      habits: [],
      collection: {},
      pullHistory: [],
      teams: [{ id: _initTeamId, name: 'Команда 1', squad: Array(11).fill(null), formation: '4-3-3', assignedCoach: null }],
      activeTeamId: _initTeamId,
      achievements: {},
      claimedAchievements: {},
      totalCompletions: 0,
      pendingUnlocks: [],
      pityCounters: {},
      coachCollection: {},
      following: [],
      lastTriviaDate: null,
      triviaHistory: [],
      _stateLoaded: false,

      addHabit: (habitData) => {
        const habit: Habit = {
          id: crypto.randomUUID(),
          streak: 0,
          lastCompleted: '',
          ...habitData,
        }
        set(state => ({ habits: [...state.habits, habit] }))
      },

      updateHabit: (id, patch) => {
        set(state => ({
          habits: state.habits.map(h => h.id === id ? { ...h, ...patch } : h),
        }))
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
          const activeTeam = getActiveTeam(state)
          const bonuses = computeActiveBonuses(activeTeam.squad)
          const bonusPct = totalBonusPercent(bonuses)
          const coach = getAssignedCoach(activeTeam.assignedCoach)
          const squadPlayers = activeTeam.squad
            .filter((id): id is string => id !== null)
            .map(id => footballerMap.get(id))
            .filter((f): f is Footballer => f !== undefined)
          const coachChemPct = coach ? computeCoachChemistryPct(coach, squadPlayers) : 0
          const earned = Math.round(baseCoin * (1 + (bonusPct + coachChemPct) / 100))
          const coachBonus = computeCoachHabitBonus(state, activeTeam, id, earned, newStreak)
          const total = earned + coachBonus

          return {
            coins: state.coins + total,
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

      buyPack: (cost, cards, packId, nextPityCounter) => {
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
          pityCounters: { ...state.pityCounters, [packId]: nextPityCounter },
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

      assignCoach: (teamId, coachId) => {
        set(state => ({
          teams: updateTeamInArray(state.teams, teamId, { assignedCoach: coachId }),
        }))
        const newUnlocks = checkAchievements(get())
        for (const achievementId of newUnlocks) {
          get().unlockAchievement(achievementId)
        }
      },

      buyCoachPack: (coachId, cost) => {
        const state = get()
        const current = state.coachCollection[coachId] ?? 0
        const newCount = current + 1
        const newLevel = Math.min(newCount, 3)
        const isLevelUp = current > 0 && newLevel > current
        const alreadyMaxed = current >= 3
        const refundCoins = alreadyMaxed ? 50 : 0

        set({
          coins: state.coins - cost + refundCoins,
          coachCollection: { ...state.coachCollection, [coachId]: Math.min(newCount, 3) },
        })

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

        return { isLevelUp, newLevel, refundCoins, newUnlockIds }
      },

      answerTrivia: (questionId, correct) => {
        set(state => ({
          lastTriviaDate: getToday(),
          triviaHistory: [...state.triviaHistory, questionId],
          coins: correct ? state.coins + 50 : state.coins,
        }))
      },

      addCoins: (amount) => {
        set(state => ({ coins: state.coins + amount }))
      },

      setSquadSlot: (teamId, slotIndex, footballerId) => {
        set(state => {
          const team = state.teams.find(t => t.id === teamId)
          if (!team) return state
          return {
            teams: updateTeamInArray(state.teams, teamId, {
              squad: team.squad.map((id, i) => i === slotIndex ? footballerId : id),
            }),
          }
        })
        const newUnlocks = checkAchievements(get())
        for (const achievementId of newUnlocks) {
          get().unlockAchievement(achievementId)
        }
      },

      setFormation: (teamId, formation) => {
        set(state => ({
          teams: updateTeamInArray(state.teams, teamId, {
            formation,
            squad: Array(11).fill(null),
          }),
        }))
      },

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
          return { teams: state.teams.filter((t: Team) => t.id !== teamId) }
        })
      },

      setActiveTeam: (teamId) => {
        set({ activeTeamId: teamId })
      },

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

      importState: (data) => {
        const migrated = migrateOldState(data as Record<string, unknown>)
        const teams = migrated ? migrated.teams : (data.teams ?? [createDefaultTeam()])
        const activeTeamId = migrated ? migrated.activeTeamId : (data.activeTeamId ?? teams[0]?.id ?? '')

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

      claimAchievementReward: (id) => {
        const state = get()
        if (!state.achievements[id] || state.claimedAchievements[id]) return
        const def = ACHIEVEMENTS.find(a => a.id === id)
        if (!def) return
        set(s => ({
          coins: s.coins + def.coinReward,
          claimedAchievements: { ...s.claimedAchievements, [id]: true },
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

      setFollowing: (ids) => {
        set({ following: ids })
      },
}))

export function syncSubscribe(userId: string): () => void {
  const unsubscribe = useAppStore.subscribe((state) => {
    scheduleSave(userId, state)
  })

  // Note: flushSave fires synchronously but saveState is async.
  // Browsers cannot await Promises in beforeunload — this is best-effort.
  window.addEventListener('beforeunload', flushSave)

  return () => {
    unsubscribe()
    window.removeEventListener('beforeunload', flushSave)
  }
}
