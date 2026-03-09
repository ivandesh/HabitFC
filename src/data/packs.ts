import type { Pack } from '../types'

export const packs: Pack[] = [
  {
    id: 'basic',
    name: 'Базовий Пакет',
    cost: 200,
    cardCount: 3,
    weights: { common: 70, rare: 22, epic: 7, legendary: 1 },
  },
  {
    id: 'premium',
    name: 'Преміум Пакет',
    cost: 400,
    cardCount: 3,
    weights: { common: 50, rare: 33, epic: 14, legendary: 3 },
  },
  {
    id: 'elite',
    name: 'Еліт Пакет',
    cost: 750,
    cardCount: 3,
    weights: { common: 0, rare: 45, epic: 45, legendary: 10 },
  },
]
