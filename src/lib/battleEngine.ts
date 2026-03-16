import type { SquadSnapshot, Footballer } from '../types'
import { footballerMap } from '../data/footballers'
import { coaches } from '../data/coaches'
import { FORMATIONS } from './formations'
import type { SeededRng } from './seededRng'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_BASE_STATS = 2178   // 11 × 2 stats × 99
const MAX_RARITY = 110        // 11 × 10
const MAX_CHEMISTRY = 440     // C(11,2) × 8
const MAX_COACH = 132         // 11 × 12
const MAX_FORMATION = 5
const MAX_STREAK = 15
const MIN_FORM = -55           // 11 × -5
const MAX_FORM = 110           // 11 × 10

const RARITY_BONUS: Record<string, number> = {
  common: 0, rare: 2, epic: 5, legendary: 10,
}

const FORMATION_CATEGORY: Record<string, 'attacking' | 'balanced' | 'defensive'> = {
  '4-3-3': 'attacking',
  '3-5-2': 'attacking',
  '4-4-2': 'balanced',
  '4-2-3-1': 'balanced',
  '5-3-2': 'defensive',
}

// attacking > defensive > balanced > attacking
function formationMatchupBonus(mine: string, theirs: string): number {
  const my = FORMATION_CATEGORY[mine] ?? 'balanced'
  const their = FORMATION_CATEGORY[theirs] ?? 'balanced'
  if (my === their) return 2
  if (
    (my === 'attacking' && their === 'defensive') ||
    (my === 'defensive' && their === 'balanced') ||
    (my === 'balanced' && their === 'attacking')
  ) return 5
  return 0
}

/** Get relevant stats based on player's NATURAL position (not slot) */
function positionStats(player: Footballer): number {
  const s = player.stats
  switch (player.position) {
    case 'GK':  return s.passing + s.dribbling
    case 'DEF': return s.pace + s.passing
    case 'MID': return s.passing + s.dribbling
    case 'FWD': return s.pace + s.shooting
  }
}

/** Resolve footballer objects from a snapshot */
export function resolveSquad(snap: SquadSnapshot): (Footballer | undefined)[] {
  return snap.squad.map(id => footballerMap.get(id))
}

/** Calculate all 10 sub-scores and return total team strength (0–100) */
export function calcTeamStrength(
  snap: SquadSnapshot,
  opponentFormation: string,
  isHome: boolean,
  rng: SeededRng,
): { strength: number; formRolls: number[] } {
  const players = resolveSquad(snap)
  const formation = FORMATIONS[snap.formation]
  if (!formation) return { strength: 0, formRolls: [] }

  const coach = coaches.find(c => c.id === snap.coachId)
  const coachLevel = Math.min(snap.coachLevel, 3)

  // ── 1. Base stats (weight: 40) ──
  let baseStats = 0
  let positionFitCount = 0

  for (let i = 0; i < 11; i++) {
    const player = players[i]
    if (!player) continue
    const slotPos = formation.slots[i]?.pos ?? 'MID'

    // Coach stat boost
    let boostedStats = { ...player.stats }
    if (coach?.perk.type === 'stat_boost' && coach.perk.stat) {
      const matchesPosition = !coach.perk.position || coach.perk.position === player.position
      const matchesRarity = !coach.perk.rarityFilter || coach.perk.rarityFilter === player.rarity
      if (matchesPosition && matchesRarity) {
        const boostVal = coach.perk.values[coachLevel - 1] ?? 0
        boostedStats = { ...boostedStats, [coach.perk.stat]: boostedStats[coach.perk.stat] + boostVal }
      }
    }

    // Position fit check
    const fits = player.position === slotPos
    if (fits) positionFitCount++

    // Stat contribution with position penalty
    const statPlayer = { ...player, stats: boostedStats } as Footballer
    let contribution = positionStats(statPlayer)
    if (!fits) {
      contribution *= player.position === 'GK' ? 0.5 : 0.8
    }
    baseStats += contribution
  }

  // ── 2. Rarity bonus (weight: 10) ──
  let rarityBonus = 0
  for (const p of players) {
    if (p) rarityBonus += RARITY_BONUS[p.rarity] ?? 0
  }

  // ── 3. Chemistry (weight: 15) — all pairs ──
  let chemistryScore = 0
  for (let i = 0; i < 11; i++) {
    for (let j = i + 1; j < 11; j++) {
      const a = players[i], b = players[j]
      if (!a || !b) continue
      const sameClub = a.club === b.club
      const sameNat = a.nationality === b.nationality
      if (sameClub && sameNat) chemistryScore += 8
      else if (sameClub) chemistryScore += 3
      else if (sameNat) chemistryScore += 3
    }
  }

  // ── 4. Coach bonus (weight: 10) ──
  let coachBonus = 0
  if (coach?.perk.type === 'stat_boost') {
    for (const p of players) {
      if (!p) continue
      const matchesPosition = !coach.perk.position || coach.perk.position === p.position
      const matchesRarity = !coach.perk.rarityFilter || coach.perk.rarityFilter === p.rarity
      if (matchesPosition && matchesRarity) {
        coachBonus += coach.perk.values[coachLevel - 1] ?? 0
      }
    }
  } else if (coach) {
    coachBonus = 3 * coachLevel
  }

  // ── 5. Formation matchup (weight: 5) ──
  const formBonus = formationMatchupBonus(snap.formation, opponentFormation)

  // ── 6. Position fit (weight: 5) ──
  const positionFit = positionFitCount / 11

  // ── 7. Squad completeness (weight: 3) ──
  const squadComplete = 1

  // ── 8. Habit streak bonus (weight: 5) ──
  const streakBonus = Math.min(snap.maxHabitStreak * 0.5, MAX_STREAK)

  // ── 9. Home advantage (weight: 2) ──
  const homeBonus = isHome ? 1 : 0

  // ── 10. Form/fatigue — random per player (weight: 5) ──
  const formRolls: number[] = []
  let formTotal = 0
  for (let i = 0; i < 11; i++) {
    const roll = rng.int(-5, 10)
    formRolls.push(roll)
    formTotal += roll
  }

  // ── Weighted sum ──
  const strength =
    (baseStats / MAX_BASE_STATS) * 40 +
    (rarityBonus / MAX_RARITY) * 10 +
    (chemistryScore / MAX_CHEMISTRY) * 15 +
    (coachBonus / MAX_COACH) * 10 +
    (formBonus / MAX_FORMATION) * 5 +
    positionFit * 5 +
    squadComplete * 3 +
    (streakBonus / MAX_STREAK) * 5 +
    homeBonus * 2 +
    ((formTotal - MIN_FORM) / (MAX_FORM - MIN_FORM)) * 5

  return { strength, formRolls }
}

// ─── Event Generation ───────────────────────────────────────────────────────

const GOAL_DESCRIPTIONS = [
  'Удар з відстані', 'Гол головою', 'Контратака', 'Сольний прохід',
  'Удар зі штрафного', 'Удар з кутового', 'Далекий постріл',
  'Дриблінг та удар', 'Точний пас та гол', 'Удар з льоту',
  "Гол п'яткою", 'Гол після рикошету',
]

const NEAR_MISS_DESCRIPTIONS = [
  'Удар у штангу!', 'Удар вище воріт', "М'яч пролетів поряд",
  'Небезпечний момент!', 'Удар у перекладину!', 'Промах з близької відстані',
]

const GREAT_SAVE_DESCRIPTIONS = [
  'Чудовий сейв!', 'Рятівний кидок воротаря', 'Парад воротаря!',
  'Неймовірна реакція!', 'Рефлекс-сейв!',
]

const YELLOW_CARD_DESCRIPTIONS = [
  'Тактичний фол', 'Грубий підкат', 'Симуляція', 'Зрив атаки',
  'Фол у центрі поля', 'Гра рукою',
]

const RED_CARD_DESCRIPTIONS = [
  'Жорсткий підкат — червона!', 'Друга жовта — вилучення!',
  'Фол останньої надії', 'Удар суперника — пряма червона!',
]

const MOMENTUM_DESCRIPTIONS = [
  'перехоплює контроль над грою!', 'домінує у центрі поля!',
  'тисне на ворота суперника!', 'перехоплює ініціативу!',
]

export interface SimulationResult {
  events: import('../types').MatchEvent[]
  scoreHome: number
  scoreAway: number
  result: import('../types').MatchResult
}

export function simulateMatch(
  homeSnap: SquadSnapshot,
  awaySnap: SquadSnapshot,
  rng: SeededRng,
): SimulationResult {
  const homePlayers = resolveSquad(homeSnap)
  const awayPlayers = resolveSquad(awaySnap)

  const homeStrength = calcTeamStrength(homeSnap, awaySnap.formation, true, rng)
  const awayStrength = calcTeamStrength(awaySnap, homeSnap.formation, false, rng)

  const totalStrength = homeStrength.strength + awayStrength.strength
  const homeRatio = totalStrength > 0 ? homeStrength.strength / totalStrength : 0.5

  const events: import('../types').MatchEvent[] = []
  let scoreHome = 0
  let scoreAway = 0
  let homeGoalDebuff = 0
  let awayGoalDebuff = 0

  // Determine total goals (0-5, weighted toward 2-3)
  const goalBudgetRoll = rng.next()
  let totalGoalBudget: number
  if (goalBudgetRoll < 0.05) totalGoalBudget = 0
  else if (goalBudgetRoll < 0.20) totalGoalBudget = 1
  else if (goalBudgetRoll < 0.50) totalGoalBudget = 2
  else if (goalBudgetRoll < 0.78) totalGoalBudget = 3
  else if (goalBudgetRoll < 0.92) totalGoalBudget = 4
  else totalGoalBudget = 5

  // Pre-determine goal minutes
  const goalMinutes: number[] = []
  for (let i = 0; i < totalGoalBudget; i++) {
    goalMinutes.push(rng.int(1, 90))
  }
  goalMinutes.sort((a, b) => a - b)

  // Pre-determine flavor event minutes
  const flavorMinuteSet = new Set<number>()
  const flavorCount = rng.int(5, 12)
  for (let i = 0; i < flavorCount; i++) {
    flavorMinuteSet.add(rng.int(1, 90))
  }
  for (const gm of goalMinutes) flavorMinuteSet.delete(gm)

  // Card tracking: yellows per player, and set of sent-off player IDs
  const yellowCards: Record<string, number> = {}
  const sentOff = new Set<string>()

  /** Get eligible (not sent off) players from a team */
  function eligible(teamPlayers: (Footballer | undefined)[]): Footballer[] {
    return teamPlayers.filter((p): p is Footballer => !!p && !sentOff.has(p.id))
  }

  let goalIdx = 0

  for (let minute = 1; minute <= 90; minute++) {
    // ── Goal ──
    if (goalIdx < goalMinutes.length && goalMinutes[goalIdx] === minute) {
      const effectiveHomeRatio = Math.max(0.1, Math.min(0.9,
        homeRatio - homeGoalDebuff + awayGoalDebuff
      ))
      const isHomeGoal = rng.chance(effectiveHomeRatio)
      const team = isHomeGoal ? 'home' as const : 'away' as const
      const teamPlayers = isHomeGoal ? homePlayers : awayPlayers
      const onField = eligible(teamPlayers)
      const scorerCandidates = onField.filter(p => p.position === 'FWD' || p.position === 'MID')
      const scorer = rng.pick(scorerCandidates.length > 0 ? scorerCandidates : onField)

      if (isHomeGoal) scoreHome++; else scoreAway++

      events.push({
        minute,
        type: 'goal',
        team,
        playerId: scorer?.id ?? '',
        description: rng.pick(GOAL_DESCRIPTIONS),
      })
      goalIdx++
      continue
    }

    // ── Flavor events ──
    if (flavorMinuteSet.has(minute)) {
      const roll = rng.next()
      const team = rng.chance(homeRatio) ? 'home' as const : 'away' as const
      const teamPlayers = team === 'home' ? homePlayers : awayPlayers
      const onField = eligible(teamPlayers)

      // Skip event if no eligible players left
      if (onField.length === 0) continue

      const anyPlayer = rng.pick(onField)

      if (roll < 0.15) {
        // Yellow card
        const defOrMid = onField.filter(p => p.position === 'DEF' || p.position === 'MID')
        const carded = rng.pick(defOrMid.length > 0 ? defOrMid : onField)
        if (!carded) continue

        const cardedId = carded.id
        yellowCards[cardedId] = (yellowCards[cardedId] ?? 0) + 1

        if (yellowCards[cardedId] >= 2) {
          // Second yellow = red card, player sent off
          sentOff.add(cardedId)
          if (team === 'home') homeGoalDebuff += 0.10; else awayGoalDebuff += 0.10
          events.push({
            minute, type: 'red_card', team,
            playerId: cardedId,
            description: 'Друга жовта — вилучення!',
          })
        } else {
          if (team === 'home') homeGoalDebuff += 0.03; else awayGoalDebuff += 0.03
          events.push({
            minute, type: 'yellow_card', team,
            playerId: cardedId,
            description: rng.pick(YELLOW_CARD_DESCRIPTIONS),
          })
        }
      } else if (roll < 0.18) {
        // Straight red card (rare)
        const carded = rng.pick(onField)
        if (!carded) continue

        sentOff.add(carded.id)
        if (team === 'home') homeGoalDebuff += 0.10; else awayGoalDebuff += 0.10
        events.push({
          minute, type: 'red_card', team,
          playerId: carded.id,
          description: rng.pick(RED_CARD_DESCRIPTIONS),
        })
      } else if (roll < 0.45) {
        // Near miss
        events.push({
          minute, type: 'near_miss', team,
          playerId: anyPlayer.id,
          description: rng.pick(NEAR_MISS_DESCRIPTIONS),
        })
      } else if (roll < 0.65) {
        // Great save
        const oppositeTeam = team === 'home' ? 'away' as const : 'home' as const
        const oppPlayers = oppositeTeam === 'home' ? homePlayers : awayPlayers
        const oppOnField = eligible(oppPlayers)
        const keepers = oppOnField.filter(p => p.position === 'GK')
        const keeper = keepers.length > 0 ? rng.pick(keepers) : (oppOnField.length > 0 ? rng.pick(oppOnField) : anyPlayer)
        events.push({
          minute, type: 'great_save', team: oppositeTeam,
          playerId: keeper?.id ?? '',
          description: rng.pick(GREAT_SAVE_DESCRIPTIONS),
        })
      } else if (roll < 0.80) {
        // On fire
        const formRolls = team === 'home' ? homeStrength.formRolls : awayStrength.formRolls
        const hotIdx = formRolls.findIndex((r, i) => r >= 8 && teamPlayers[i] && !sentOff.has(teamPlayers[i]!.id))
        if (hotIdx >= 0) {
          const hotPlayer = teamPlayers[hotIdx]
          events.push({
            minute, type: 'on_fire', team,
            playerId: hotPlayer?.id ?? '',
            description: `${hotPlayer?.name ?? 'Гравець'} у відмінній формі!`,
          })
        } else {
          events.push({
            minute, type: 'momentum_shift', team,
            playerId: '',
            description: rng.pick(MOMENTUM_DESCRIPTIONS),
          })
        }
      } else {
        // Momentum shift
        events.push({
          minute, type: 'momentum_shift', team,
          playerId: '',
          description: rng.pick(MOMENTUM_DESCRIPTIONS),
        })
      }
    }
  }

  events.sort((a, b) => a.minute - b.minute)

  const result: import('../types').MatchResult =
    scoreHome > scoreAway ? 'home_win' :
    scoreAway > scoreHome ? 'away_win' : 'draw'

  return { events, scoreHome, scoreAway, result }
}
