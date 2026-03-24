import { footballerMap } from '../data/footballers'
import type { Footballer } from '../types'

export interface BonusEntry {
  label: string
  percent: number
}

export function computeActiveBonuses(squad: (string | null)[]): BonusEntry[] {
  const squadPlayers = squad
    .filter((id): id is string => id !== null)
    .map(id => footballerMap.get(id))
    .filter((f): f is Footballer => f !== undefined)

  if (squadPlayers.length === 0) return []

  const bonuses: BonusEntry[] = []

  // Count by club
  const clubCounts = new Map<string, number>()
  for (const p of squadPlayers) {
    clubCounts.set(p.club, (clubCounts.get(p.club) ?? 0) + 1)
  }
  for (const [club, count] of clubCounts) {
    if (count >= 3) {
      const pct = count >= 5 ? 10 : 6
      bonuses.push({ label: `${count}× ${club}`, percent: pct })
    } else if (count === 2) {
      bonuses.push({ label: `2× ${club}`, percent: 3 })
    }
  }

  // Count by nationality
  const natCounts = new Map<string, number>()
  for (const p of squadPlayers) {
    natCounts.set(p.nationality, (natCounts.get(p.nationality) ?? 0) + 1)
  }
  for (const [nat, count] of natCounts) {
    if (count >= 3) {
      const pct = count >= 5 ? 8 : 5
      bonuses.push({ label: `${count}× ${nat}`, percent: pct })
    } else if (count === 2) {
      bonuses.push({ label: `2× ${nat}`, percent: 2 })
    }
  }

  return bonuses
}

export function totalBonusPercent(bonuses: BonusEntry[]): number {
  const total = bonuses.reduce((sum, b) => sum + b.percent, 0)
  return Math.min(total, 40) // cap at 40%
}
