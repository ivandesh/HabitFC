import type { Pack } from '../types'

export const packs: Pack[] = [
  {
    id: 'basic',
    name: 'Базовий Пакет',
    cost: 100,
    cardCount: 3,
    weights: { common: 60, rare: 28, epic: 10, legendary: 2 },
  },
  {
    id: 'premium',
    name: 'Преміум Пакет',
    cost: 250,
    cardCount: 5,
    weights: { common: 40, rare: 35, epic: 20, legendary: 5 },
  },
  {
    id: 'elite',
    name: 'Еліт Пакет',
    cost: 600,
    cardCount: 5,
    weights: { common: 0, rare: 40, epic: 45, legendary: 15 },
  },
]
