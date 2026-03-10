import type { Coach, Footballer } from '../types'
import type { AppState } from '../types'
import { isCompletedToday } from './streaks'
import { coaches } from '../data/coaches'

export function getCoachLevel(coachId: string, coachCollection: Record<string, number>): number {
  return Math.min(coachCollection[coachId] ?? 0, 3)
}

export function getAssignedCoach(state: Pick<AppState, 'assignedCoach'>): Coach | null {
  if (!state.assignedCoach) return null
  return coaches.find((c: Coach) => c.id === state.assignedCoach) ?? null
}

/**
 * Returns extra coins earned from the coach habit perk.
 * Called in completeHabit after baseEarned is computed (streak × squad bonus).
 * state is the state BEFORE this habit is committed to storage.
 */
export function computeCoachHabitBonus(
  state: AppState,
  habitId: string,
  baseEarned: number,
  newStreak: number,
): number {
  if (!state.assignedCoach) return 0
  const coach = getAssignedCoach(state)
  if (!coach) return 0
  const level = getCoachLevel(coach.id, state.coachCollection)
  if (level === 0) return 0

  const perk = coach.perk
  const value = perk.values[level - 1]

  switch (perk.type) {
    case 'all_habit_pct':
      return Math.round(baseEarned * value / 100)

    case 'streak_gte_flat':
    case 'habit_streak_flat':
      return newStreak >= (perk.minStreak ?? 0) ? value : 0

    case 'streak_range_pct':
      return newStreak >= (perk.minStreak ?? 0) && newStreak <= (perk.maxStreak ?? Infinity)
        ? Math.round(baseEarned * value / 100)
        : 0

    case 'all_done_flat': {
      const others = state.habits.filter(h => h.id !== habitId)
      return others.every(h => isCompletedToday(h.lastCompleted)) ? value : 0
    }

    case 'all_done_pct': {
      const others = state.habits.filter(h => h.id !== habitId)
      return others.every(h => isCompletedToday(h.lastCompleted))
        ? Math.round(baseEarned * value / 100)
        : 0
    }

    case 'daily_count_pct': {
      const doneToday = state.habits.filter(h => isCompletedToday(h.lastCompleted)).length + 1
      return doneToday >= (perk.minCount ?? 0) ? Math.round(baseEarned * value / 100) : 0
    }

    case 'before_noon_pct':
      return new Date().getHours() < 12 ? Math.round(baseEarned * value / 100) : 0

    case 'active_habits_flat':
      return state.habits.length >= (perk.minHabits ?? 0) ? value : 0

    case 'squad_full_pct':
      return state.squad.filter(Boolean).length === 11
        ? Math.round(baseEarned * value / 100)
        : 0

    case 'squad_min_pct':
      return state.squad.filter(Boolean).length >= (perk.minPlayers ?? 0)
        ? Math.round(baseEarned * value / 100)
        : 0

    case 'stat_boost':
      return 0

    default:
      return 0
  }
}

/**
 * Apply coach stat boost to a footballer at render time.
 * Returns a new Footballer object — never mutates base data.
 */
export function applyCoachStatBoost(footballer: Footballer, state: AppState): Footballer {
  if (!state.assignedCoach) return footballer
  const coach = getAssignedCoach(state)
  if (!coach || coach.perk.type !== 'stat_boost') return footballer
  const level = getCoachLevel(coach.id, state.coachCollection)
  if (level === 0) return footballer

  const { stat, position, rarityFilter, values } = coach.perk
  if (!stat) return footballer
  if (position && footballer.position !== position) return footballer
  if (rarityFilter && footballer.rarity !== rarityFilter) return footballer

  const boost = values[level - 1]
  return {
    ...footballer,
    stats: { ...footballer.stats, [stat]: Math.min(99, footballer.stats[stat] + boost) },
  }
}

/**
 * Returns the chemistry % bonus from the coach (5% per squad player from coach's clubs).
 */
export function computeCoachChemistryPct(
  coach: Coach,
  squadFootballers: Array<{ club: string }>,
): number {
  return squadFootballers.filter(f => coach.clubs.includes(f.club)).length * 5
}
