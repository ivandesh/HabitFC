import { footballers, footballerMap } from '../data/footballers'
import type { AppState } from '../types'

export interface AchievementDef {
  id: string
  titleUA: string
  descUA: string
  category: 'habits' | 'collection' | 'team' | 'memes'
  icon: string
  coinReward: number
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
    coinReward: 10,
    condition: s => s.totalCompletions >= 1,
  },
  {
    id: 'on_a_roll',
    titleUA: 'В ударі',
    descUA: 'Досягни серії 3 дні підряд',
    category: 'habits',
    icon: '🔥',
    coinReward: 10,
    condition: s => s.habits.some(h => h.streak >= 3),
  },
  {
    id: 'week_warrior',
    titleUA: 'Воїн тижня',
    descUA: 'Досягни серії 7 днів підряд',
    category: 'habits',
    icon: '⚔️',
    coinReward: 50,
    condition: s => s.habits.some(h => h.streak >= 7),
  },
  {
    id: 'centurion',
    titleUA: 'Центуріон',
    descUA: 'Виконай 100 звичок',
    category: 'habits',
    icon: '💯',
    coinReward: 100,
    progressFn: s => ({ current: s.totalCompletions, total: 100 }),
    condition: s => s.totalCompletions >= 100,
  },
  {
    id: 'iron_will',
    titleUA: 'Залізна воля',
    descUA: 'Досягни серії 30 днів підряд',
    category: 'habits',
    icon: '🏆',
    coinReward: 100,
    condition: s => s.habits.some(h => h.streak >= 30),
  },

  // ── Collection ───────────────────────────────────────────────────────────────
  {
    id: 'rookie_collector',
    titleUA: 'Новачок',
    descUA: 'Зібри 10 карток',
    category: 'collection',
    icon: '📦',
    coinReward: 10,
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
    coinReward: 50,
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
    coinReward: 100,
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
    coinReward: 50,
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
    coinReward: 50,
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
    coinReward: 50,
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
    coinReward: 50,
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
    coinReward: 50,
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
    coinReward: 50,
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
    coinReward: 10,
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
    coinReward: 50,
    condition: s => {
      const players = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballerMap.get(id))
        .filter(Boolean) as typeof footballers
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
    coinReward: 100,
    condition: s => {
      const players = s.squad
        .filter((id): id is string => id !== null)
        .map(id => footballerMap.get(id))
        .filter(Boolean) as typeof footballers
      if (players.length === 0) return false
      const overall = Math.round(
        players.reduce((sum, f) =>
          sum + Math.round((f.stats.pace + f.stats.shooting + f.stats.passing + f.stats.dribbling) / 4), 0
        ) / players.length
      )
      return overall >= 85
    },
  },

  // ── Memes ─────────────────────────────────────────────────────────────────────
  {
    id: 'siiiiu',
    titleUA: 'СІІІУУ!',
    descUA: 'Виятгнув Роналду. СІІІУУ!!!',
    category: 'memes',
    icon: '🎤',
    coinReward: 10,
    condition: s => (s.collection['ronaldo'] ?? 0) > 0,
  },
  {
    id: 'goat_card',
    titleUA: 'Козел',
    descUA: 'Виятгнув Мессі. G.O.A.T. у кишені.',
    category: 'memes',
    icon: '🐐',
    coinReward: 10,
    condition: s => (s.collection['messi'] ?? 0) > 0,
  },
  {
    id: 'cyborg',
    titleUA: 'Кіборг',
    descUA: 'Виятгнув Голанда. Він не людина.',
    category: 'memes',
    icon: '🤖',
    coinReward: 10,
    condition: s => (s.collection['haaland'] ?? 0) > 0,
  },
  {
    id: 'still_running',
    titleUA: 'Ще бігає?!',
    descUA: 'Виятгнув Модріча. Він невмирущий.',
    category: 'memes',
    icon: '👴',
    coinReward: 10,
    condition: s => (s.collection['modric'] ?? 0) > 0,
  },
  {
    id: 'samba_time',
    titleUA: 'Самба Тайм',
    descUA: 'Виятгнув Вініcіуса. Будете разом танцювати.',
    category: 'memes',
    icon: '💃',
    coinReward: 10,
    condition: s => (s.collection['vinicius'] ?? 0) > 0,
  },
  {
    id: 'sweeper_keeper',
    titleUA: 'Польовий Воротар',
    descUA: 'Виятгнув Нойєра. Він впевнений, що він захисник.',
    category: 'memes',
    icon: '🧤',
    coinReward: 10,
    condition: s => (s.collection['neuer'] ?? 0) > 0,
  },
  {
    id: 'nine_minutes',
    titleUA: '5 за 9 хвилин',
    descUA: 'Виятгнув Левандовського. Знову 5 голів?',
    category: 'memes',
    icon: '⚡',
    coinReward: 10,
    condition: s => (s.collection['lewandowski'] ?? 0) > 0,
  },
  {
    id: 'too_young',
    titleUA: 'Занадто Молодий',
    descUA: 'Виятгнув Ямала. Він молодший за тебе. І він вже чемпіон Європи.',
    category: 'memes',
    icon: '🍼',
    coinReward: 10,
    condition: s => (s.collection['yamal'] ?? 0) > 0,
  },
  {
    id: 'fragile_genius',
    titleUA: 'Крихкий Геній',
    descUA: 'Виятгнув Педрі. Найталановитіший гравець покоління. Фізіотерапевт Барселони знає його краще за тренера.',
    category: 'memes',
    icon: '🩹',
    coinReward: 10,
    condition: s => (s.collection['pedri'] ?? 0) > 0,
  },
  {
    id: 'mentality_monster',
    titleUA: 'Менталітет',
    descUA: 'Виятгнув Кіммiха. Менталітет. Характер. Воля до перемоги.',
    category: 'memes',
    icon: '🧠',
    coinReward: 10,
    condition: s => (s.collection['kimmich'] ?? 0) > 0,
  },
  {
    id: 'wall_of_milan',
    titleUA: 'Стіна Мілану',
    descUA: 'Виятгнув Доннаруму. 1.96 метра чистого жаху.',
    category: 'memes',
    icon: '🏔️',
    coinReward: 10,
    condition: s => (s.collection['donnarumma'] ?? 0) > 0,
  },
  {
    id: 'arteta_invention',
    titleUA: 'Винахід Артети',
    descUA: 'Виятгнув Зінченка. Шкода що грає він тепер хіба в фіфашку',
    category: 'memes',
    icon: '🧩',
    coinReward: 10,
    condition: s => (s.collection['zinchenko'] ?? 0) > 0,
  },
  {
    id: 'everton_survivor',
    titleUA: 'Евертон Сюрвайвор',
    descUA: 'Виятгнув Миколенка. Грати в Евертоні та залишатися психічно здоровим — це вже досягнення.',
    category: 'memes',
    icon: '⚓',
    coinReward: 10,
    condition: s => (s.collection['mykolenko'] ?? 0) > 0,
  },
  {
    id: 'ukraine_in_apl',
    titleUA: 'Україна в АПЛ',
    descUA: 'Зінченко і Миколенко в колекції. АПЛ — наш. Лівий фланг — наш. Слава Україні.',
    category: 'memes',
    icon: '🌻',
    coinReward: 50,
    condition: s => (s.collection['zinchenko'] ?? 0) > 0 && (s.collection['mykolenko'] ?? 0) > 0,
  },
  {
    id: 'hospital_vip',
    titleUA: 'VIP Палата',
    descUA: 'Виятгнув Неймара. Він не грає. Він ніколи не грає. Але картка красива.',
    category: 'memes',
    icon: '🏥',
    coinReward: 10,
    condition: s => (s.collection['neymar'] ?? 0) > 0,
  },
  {
    id: 'eternal_debate',
    titleUA: 'Вічна Суперечка',
    descUA: 'Маєш і Мессі, і Роналду. Тепер сперечайся сам із собою до 3 ночі.',
    category: 'memes',
    icon: '⚔️',
    coinReward: 50,
    condition: s => (s.collection['messi'] ?? 0) > 0 && (s.collection['ronaldo'] ?? 0) > 0,
  },
  {
    id: 'wonderkids_assembly',
    titleUA: 'Збори Дива',
    descUA: 'Ямал, Беллінгем, Мусіала і Вірц. Кожен — "наступний Мессі". Хто правий?',
    category: 'memes',
    icon: '✨',
    coinReward: 50,
    condition: s =>
      (s.collection['yamal'] ?? 0) > 0 &&
      (s.collection['bellingham'] ?? 0) > 0 &&
      (s.collection['musiala'] ?? 0) > 0 &&
      (s.collection['wirtz'] ?? 0) > 0,
  },

  // ── Coaches — Memes ───────────────────────────────────────────────────────────
  {
    id: 'special_one',
    titleUA: 'Особливий',
    descUA: 'Ай ем Жозе Моуріньйо',
    category: 'memes',
    icon: '😏',
    coinReward: 10,
    condition: s => s.assignedCoach === 'mourinho',
  },
  {
    id: 'pep_or_pep',
    titleUA: 'Тіктака чи Тіктака?',
    descUA: 'Маєш і Гвардіолу, і Хаві. Обидва хочуть, щоб усі пасували. Постійно.',
    category: 'memes',
    icon: '🧠',
    coinReward: 50,
    condition: s => (s.coachCollection['guardiola'] ?? 0) > 0 && (s.coachCollection['xavi'] ?? 0) > 0,
  },
  {
    id: 'the_klopp',
    titleUA: 'ЙЄЄЄС!',
    descUA: 'Призначив Клоппа. Тепер твоя команда пресингує суперника навіть у нього вдома.',
    category: 'memes',
    icon: '😁',
    coinReward: 10,
    condition: s => s.assignedCoach === 'klopp',
  },
  {
    id: 'invincible_process',
    titleUA: 'Процес',
    descUA: 'Маєш Артету і Венгера одночасно. Арсенал живе у твоєму серці.',
    category: 'memes',
    icon: '🔴',
    coinReward: 50,
    condition: s => (s.coachCollection['arteta'] ?? 0) > 0 && (s.coachCollection['wenger'] ?? 0) > 0,
  },

  // ── Coaches — Collection ──────────────────────────────────────────────────────
  {
    id: 'tactics_nerd',
    titleUA: 'Тактичний Геній',
    descUA: 'Зібрав 5 тренерів. Ти вже малюєш схеми на серветках.',
    category: 'collection',
    icon: '📋',
    coinReward: 50,
    progressFn: s => ({
      current: Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length,
      total: 5,
    }),
    condition: s =>
      Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length >= 5,
  },
  {
    id: 'full_dugout',
    titleUA: 'Повна лавка',
    descUA: 'Зібрав усіх 21 тренера. Хто взагалі тренує команду?',
    category: 'collection',
    icon: '🏟️',
    coinReward: 100,
    progressFn: s => ({
      current: Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length,
      total: 21,
    }),
    condition: s =>
      Object.keys(s.coachCollection).filter(id => (s.coachCollection[id] ?? 0) > 0).length >= 21,
  },
]

/** Returns IDs of achievements that are now unlocked but not yet recorded. */
export function checkAchievements(state: AppState): string[] {
  return ACHIEVEMENTS
    .filter(a => !state.achievements[a.id] && a.condition(state))
    .map(a => a.id)
}
