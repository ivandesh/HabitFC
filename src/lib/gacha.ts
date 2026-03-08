import type { Footballer, Pack, Rarity } from '../types'
import { footballers } from '../data/footballers'

function pickRarity(weights: Record<Rarity, number>): Rarity {
  const entries: [Rarity, number][] = [
    ['common', weights.common],
    ['rare', weights.rare],
    ['epic', weights.epic],
    ['legendary', weights.legendary],
  ]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = Math.random() * total
  for (const [rarity, weight] of entries) {
    roll -= weight
    if (roll <= 0) return rarity
  }
  return 'common'
}

function pickCard(rarity: Rarity): Footballer {
  const pool = footballers.filter(f => f.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function openPack(pack: Pack): Footballer[] {
  const results: Footballer[] = []
  for (let i = 0; i < pack.cardCount; i++) {
    const rarity = pickRarity(pack.weights)
    results.push(pickCard(rarity))
  }
  return results
}

export function duplicateRefund(rarity: Rarity): number {
  switch (rarity) {
    case 'common': return 5
    case 'rare': return 15
    case 'epic': return 40
    case 'legendary': return 100
  }
}
