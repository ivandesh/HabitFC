import type { MatchEvent } from '../types'

export interface PlayerMatchStats {
  goals: number
  yellowCards: number
  redCards: number
  nearMisses: number
  greatSaves: number
  onFire: boolean
}

export function buildPlayerStats(events: MatchEvent[]): Record<string, PlayerMatchStats> {
  const stats: Record<string, PlayerMatchStats> = {}
  const ensure = (id: string) => {
    if (!id) return
    if (!stats[id]) stats[id] = { goals: 0, yellowCards: 0, redCards: 0, nearMisses: 0, greatSaves: 0, onFire: false }
  }
  for (const ev of events) {
    if (!ev.playerId) continue
    ensure(ev.playerId)
    const s = stats[ev.playerId]
    if (!s) continue
    switch (ev.type) {
      case 'goal': s.goals++; break
      case 'yellow_card': s.yellowCards++; break
      case 'red_card': s.redCards++; break
      case 'near_miss': s.nearMisses++; break
      case 'great_save': s.greatSaves++; break
      case 'on_fire': s.onFire = true; break
    }
  }
  return stats
}

/** Rating 5.0-10.0 based on match contributions. formRoll (optional) breaks ties for players with no events. */
export function calcRating(playerId: string, stats: Record<string, PlayerMatchStats>, formRoll?: number): number {
  const s = stats[playerId]
  let rating = 6.5
  if (s) {
    rating += s.goals * 1.0
    rating += s.greatSaves * 0.6
    rating += s.nearMisses * 0.2
    rating -= s.yellowCards * 0.3
    rating -= s.redCards * 1.0
    if (s.onFire) rating += 0.4
  }
  // formRoll tiebreaker: map [-5, 10] to [-0.3, 0.3] so it nudges but doesn't override real events
  if (formRoll !== undefined) {
    rating += (formRoll / 15) * 0.3
  }
  return Math.max(5.0, Math.min(10.0, Math.round(rating * 10) / 10))
}
