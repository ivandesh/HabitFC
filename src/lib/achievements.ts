import { footballers } from '../data/footballers'
import type { AppState } from '../types'

export interface AchievementDef {
  id: string
  titleUA: string
  descUA: string
  category: 'habits' | 'collection' | 'team'
  icon: string
  progressFn?: (state: AppState) => { current: number; total: number }
  condition: (state: AppState) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Habits ──────────────────────────────────────────────────────────────────
  {
    id: 'first_step',
    titleUA: 'Перший крок',
    descUA: 'Виконай 1 звичку',
    category: 'habits',
    icon: '👟',
    condition: s => s.totalCompletions >= 1,
  },
  {
    id: 'on_a_roll',
    titleUA: 'В ударі',
    descUA: 'Досягни серії 3 дні підряд',
    category: 'habits',
    icon: '🔥',
    condition: s => s.habits.some(h => h.streak >= 3),
  },
  {
    id: 'week_warrior',
    titleUA: 'Воїн тижня',
    descUA: 'Досягни серії 7 днів підряд',
    category: 'habits',
    icon: '⚔️',
    condition: s => s.habits.some(h => h.streak >= 7),
  },
  {
    id: 'centurion',
    titleUA: 'Центуріон',
    descUA: 'Виконай 100 звичок',
    category: 'habits',
    icon: '💯',
    progressFn: s => ({ current: s.totalCompletions, total: 100 }),
    condition: s => s.totalCompletions >= 100,
  },
  {
    id: 'iron_will',
    titleUA: 'Залізна воля',
    descUA: 'Досягни серії 30 днів підряд',
    category: 'habits',
    icon: '🏆',
    condition: s => s.habits.some(h => h.streak >= 30),
  },

  // ── Collection ───────────────────────────────────────────────────────────────
  {
    id: 'rookie_collector',
    titleUA: 'Новачок',
    descUA: 'Зібри 10 карток',
    category: 'collection',
    icon: '📦',
    progressFn: s => ({
      current: Object.keys(s.collection).filter(id => (s.collection[id] ?? 0) > 0).length,
      total: 10,
    }),
    condition: s =>
      Object.keys(s.collection).filter(id => (s.collection[id] ?? 0) > 0).length >= 10,
  },
  {
    id: 'legend_hunter',
    titleUA: 'Мисливець за легендами',
    descUA: 'Отримай хоча б одну легендарну картку',
    category: 'collection',
    icon: '⭐',
    condition: s =>
      footballers
        .filter(f => f.rarity === 'legendary')
        .some(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'legend_master',
    titleUA: 'Майстер легенд',
    descUA: 'Зібри всіх легендарних гравців',
    category: 'collection',
    icon: '👑',
    progressFn: s => {
      const legendaries = footballers.filter(f => f.rarity === 'legendary')
      return {
        current: legendaries.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: legendaries.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.rarity === 'legendary')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'real_madrid_fan',
    titleUA: 'Фанат Реалу',
    descUA: 'Зібри всіх гравців Реал Мадрид',
    category: 'collection',
    icon: '⚪',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Real Madrid')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Real Madrid')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'barcelona_fan',
    titleUA: 'Фанат Барси',
    descUA: 'Зібри всіх гравців Барселони',
    category: 'collection',
    icon: '🔵',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Barcelona')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Barcelona')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'man_city_fan',
    titleUA: 'Фанат Сіті',
    descUA: 'Зібри всіх гравців Ман Сіті',
    category: 'collection',
    icon: '🔷',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Man City')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Man City')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'liverpool_fan',
    titleUA: 'Фанат Ліверпуля',
    descUA: 'Зібри всіх гравців Ліверпуля',
    category: 'collection',
    icon: '🔴',
    progressFn: s => {
      const club = footballers.filter(f => f.club === 'Liverpool')
      return {
        current: club.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: club.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.club === 'Liverpool')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'goalkeeper_club',
    titleUA: 'Клуб воротарів',
    descUA: 'Зібри всіх воротарів',
    category: 'collection',
    icon: '🧤',
    progressFn: s => {
      const gks = footballers.filter(f => f.position === 'GK')
      return {
        current: gks.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: gks.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.position === 'GK')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },
  {
    id: 'full_attack',
    titleUA: 'Повна атака',
    descUA: 'Зібри всіх нападників',
    category: 'collection',
    icon: '⚡',
    progressFn: s => {
      const fwds = footballers.filter(f => f.position === 'FWD')
      return {
        current: fwds.filter(f => (s.collection[f.id] ?? 0) > 0).length,
        total: fwds.length,
      }
    },
    condition: s =>
      footballers
        .filter(f => f.position === 'FWD')
        .every(f => (s.collection[f.id] ?? 0) > 0),
  },

  // ── Team ─────────────────────────────────────────────────────────────────────
  {
    id: 'first_squad',
    titleUA: 'Перший склад',
    descUA: 'Заповни всі 11 позицій у складі',
    category: 'team',
    icon: '⚽',
    progressFn: s => ({
      current: s.squad.filter(Boolean).length,
      total: 11,
    }),
    condition: s => s.squad.filter(Boolean).length === 11,
  },
  {
    id: 'dream_chemistry',
    titleUA: 'Хімія мрії',
    descUA: "Досягни 15 хімічних зв'язків",
    category: 'team',
    icon: '🧪',
    condition: s => {
      const players = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballers.find(f => f.id === id)!)
        .filter(Boolean)
      let links = 0
      for (let i = 0; i < players.length; i++)
        for (let j = i + 1; j < players.length; j++)
          if (players[i].club === players[j].club || players[i].nationality === players[j].nationality)
            links++
      return links >= 15
    },
  },
  {
    id: 'elite_team',
    titleUA: 'Еліта',
    descUA: 'Досягни загального рейтингу складу 85+',
    category: 'team',
    icon: '🌟',
    condition: s => {
      const players = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballers.find(f => f.id === id)!)
        .filter(Boolean)
      if (players.length === 0) return false
      const overall = Math.round(
        players.reduce((sum, f) =>
          sum + Math.round((f.stats.pace + f.stats.shooting + f.stats.passing + f.stats.dribbling) / 4), 0
        ) / players.length
      )
      return overall >= 85
    },
  },
  {
    id: 'all_positions',
    titleUA: 'Повний склад',
    descUA: 'Постав хоча б одного гравця на кожну позицію',
    category: 'team',
    icon: '🗺️',
    condition: s => {
      const positionsInSquad = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballers.find(f => f.id === id)?.position)
        .filter(Boolean)
      return (['GK', 'DEF', 'MID', 'FWD'] as const).every(pos => positionsInSquad.includes(pos))
    },
  },
]

/** Returns IDs of achievements that are now unlocked but not yet recorded. */
export function checkAchievements(state: AppState): string[] {
  return ACHIEVEMENTS
    .filter(a => !state.achievements[a.id] && a.condition(state))
    .map(a => a.id)
}
