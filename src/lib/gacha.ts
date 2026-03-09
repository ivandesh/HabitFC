import type { Footballer, Pack, Rarity } from '../types'
import { footballers } from '../data/footballers'

const PITY_THRESHOLD = 10   // packs without legendary before pity starts
const PITY_INCREMENT = 2    // % added per pack beyond threshold
const PITY_CAP = 50         // max legendary weight

function pickRarity(weights: Record<Rarity, number>, pityCounter: number): Rarity {
  const legendaryWeight = Math.min(
    weights.legendary + Math.max(0, pityCounter - PITY_THRESHOLD) * PITY_INCREMENT,
    PITY_CAP,
  )

  const entries: [Rarity, number][] = [
    ['common', weights.common],
    ['rare', weights.rare],
    ['epic', weights.epic],
    ['legendary', legendaryWeight],
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

/** Opens a pack and returns the cards plus the updated pity counter for this pack type. */
export function openPack(pack: Pack, pityCounter: number): { cards: Footballer[]; nextPityCounter: number } {
  const cards: Footballer[] = []
  let gotLegendary = false

  for (let i = 0; i < pack.cardCount; i++) {
    const rarity = pickRarity(pack.weights, pityCounter)
    if (rarity === 'legendary') gotLegendary = true
    cards.push(pickCard(rarity))
  }

  const nextPityCounter = gotLegendary ? 0 : pityCounter + 1
  return { cards, nextPityCounter }
}

export function duplicateRefund(rarity: Rarity): number {
  switch (rarity) {
    case 'common': return 10
    case 'rare': return 30
    case 'epic': return 80
    case 'legendary': return 200
  }
}
