export function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function streakMultiplier(streak: number): number {
  if (streak >= 30) return 2.0
  if (streak >= 7) return 1.5
  if (streak >= 3) return 1.25
  return 1.0
}

/** Returns updated streak count given current streak and lastCompleted date */
export function calculateNewStreak(currentStreak: number, lastCompleted: string): number {
  const today = getToday()
  const yesterday = getYesterday()
  if (lastCompleted === today) return currentStreak // already done today
  if (lastCompleted === yesterday) return currentStreak + 1 // continuing streak
  return 1 // reset
}

/** Returns true if habit was already completed today */
export function isCompletedToday(lastCompleted: string): boolean {
  return lastCompleted === getToday()
}
