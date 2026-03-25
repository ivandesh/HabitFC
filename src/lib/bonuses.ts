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

export interface ThresholdHint {
  label: string        // e.g. "2× England"
  type: 'club' | 'nation'
  potentialPct: number // the bonus at the next tier (e.g. 5 for going from 2→3 nationality)
  currentPct: number   // current bonus for this group (0, 2, 3, 5, 6, 8, 10)
  delta: number        // potentialPct - currentPct
}

function clubTierPct(count: number): number {
  if (count >= 5) return 10
  if (count >= 3) return 6
  if (count >= 2) return 3
  return 0
}

function natTierPct(count: number): number {
  if (count >= 5) return 8
  if (count >= 3) return 5
  if (count >= 2) return 2
  return 0
}

/**
 * Returns up to 4 hints for club/nationality groups that are 1 player away
 * from the next bonus tier, filtered to only groups where the user owns
 * a matching player in their collection.
 */
export function computeNearThresholdHints(
  squad: (string | null)[],
  collection: Record<string, number>
): ThresholdHint[] {
  // If squad bonuses already at cap, no room to improve
  const currentTotal = totalBonusPercent(computeActiveBonuses(squad))
  if (currentTotal >= 40) return []

  const squadPlayers = squad
    .filter((id): id is string => id !== null)
    .map(id => footballerMap.get(id))
    .filter((f): f is Footballer => f !== undefined)

  // Count clubs and nationalities in current squad
  const clubCounts = new Map<string, number>()
  const natCounts = new Map<string, number>()
  for (const p of squadPlayers) {
    clubCounts.set(p.club, (clubCounts.get(p.club) ?? 0) + 1)
    natCounts.set(p.nationality, (natCounts.get(p.nationality) ?? 0) + 1)
  }

  // All owned player objects (not in squad)
  const squadIdSet = new Set(squad.filter((id): id is string => id !== null))
  const ownedBench = Object.keys(collection)
    .filter(id => (collection[id] ?? 0) > 0 && !squadIdSet.has(id))
    .map(id => footballerMap.get(id))
    .filter((f): f is Footballer => f !== undefined)

  // Clubs and nationalities available on the bench
  const benchClubs = new Set(ownedBench.map(f => f.club))
  const benchNats = new Set(ownedBench.map(f => f.nationality))

  const hints: ThresholdHint[] = []

  // Check clubs: current count → count+1, see if it crosses a tier
  for (const [club, count] of clubCounts) {
    const curPct = clubTierPct(count)
    const nextPct = clubTierPct(count + 1)
    if (nextPct > curPct && benchClubs.has(club)) {
      hints.push({ label: `${count}× ${club}`, type: 'club', potentialPct: nextPct, currentPct: curPct, delta: nextPct - curPct })
    }
  }
  // Check nationalities
  for (const [nat, count] of natCounts) {
    const curPct = natTierPct(count)
    const nextPct = natTierPct(count + 1)
    if (nextPct > curPct && benchNats.has(nat)) {
      hints.push({ label: `${count}× ${nat}`, type: 'nation', potentialPct: nextPct, currentPct: curPct, delta: nextPct - curPct })
    }
  }

  // Sort by delta descending, cap at 4
  hints.sort((a, b) => b.delta - a.delta)
  return hints.slice(0, 4)
}
