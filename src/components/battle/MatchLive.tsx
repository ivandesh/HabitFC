import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Match, MatchEvent, Footballer } from '../../types'
import { buildPlayerStats, calcRating, playerStatsKey } from '../../lib/playerRating'
import type { PlayerMatchStats } from '../../lib/playerRating'
import { footballerMap } from '../../data/footballers'
import { FORMATIONS } from '../../lib/formations'
import { CinematicOverlay } from './CinematicOverlay'
import {
  playGoal, playYellowCard, playRedCard,
  playNearMiss, playGreatSave, playFinalWhistle,
  playSubstitution,
} from '../../lib/sounds'

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽', yellow_card: '🟨', red_card: '🟥',
  near_miss: '💨', great_save: '🧤', on_fire: '🔥', momentum_shift: '🔄',
  penalty: '🎯', free_kick: '🎯', corner: '🚩', counterattack: '⚡',
  var_review: '📺', substitution: '🔄',
}

const SOUND_MAP: Record<string, (() => void) | undefined> = {
  goal: playGoal,
  yellow_card: playYellowCard,
  red_card: playRedCard,
  near_miss: playNearMiss,
  great_save: playGreatSave,
  substitution: playSubstitution,
}

const CINEMATIC_TYPES = new Set(['penalty', 'free_kick', 'corner', 'counterattack', 'var_review'])

function getPlayer(id: string): Footballer | undefined {
  return footballerMap.get(id)
}

function getPlayerName(id: string): string {
  return getPlayer(id)?.name ?? 'Гравець'
}

function getLastName(name: string): string {
  const parts = name.split(' ')
  return parts[parts.length - 1]
}

// ─── Pitch ball position logic ──────────────────────────────────────────────

interface BallState {
  x: number
  y: number
  pulse: 'none' | 'goal' | 'danger' | 'card' | 'fire'
  label: string
}

function minuteRand(minute: number, salt: number): number {
  let h = (minute * 2654435761 + salt * 340573321) >>> 0
  h = ((h ^ (h >> 16)) * 0x45d9f3b) >>> 0
  h = ((h ^ (h >> 16)) * 0x45d9f3b) >>> 0
  h = (h ^ (h >> 16)) >>> 0
  return (h & 0x7fffffff) / 0x7fffffff
}

function getBallState(
  currentMinute: number,
  latestEvent: MatchEvent | null,
  isHalfTime: boolean,
): BallState {
  if (isHalfTime) return { x: 50, y: 50, pulse: 'none', label: 'Перерва' }

  if (latestEvent && latestEvent.minute === currentMinute) {
    const ev = latestEvent
    const attacksRight = ev.team === 'home'
    switch (ev.type) {
      case 'goal':
        return { x: attacksRight ? 93 : 7, y: 45 + minuteRand(currentMinute, 1) * 10, pulse: 'goal', label: '⚽ ГОЛ!' }
      case 'near_miss':
        return { x: attacksRight ? 88 : 12, y: 20 + minuteRand(currentMinute, 2) * 60, pulse: 'danger', label: getPlayerName(ev.playerId) }
      case 'great_save': {
        const keeperSide = ev.team === 'home'
        return { x: keeperSide ? 10 : 90, y: 40 + minuteRand(currentMinute, 3) * 20, pulse: 'danger', label: `🧤 ${getPlayerName(ev.playerId)}` }
      }
      case 'yellow_card':
      case 'red_card':
        return { x: 35 + minuteRand(currentMinute, 4) * 30, y: 25 + minuteRand(currentMinute, 5) * 50, pulse: 'card', label: `${ev.type === 'red_card' ? '🟥' : '🟨'} ${getPlayerName(ev.playerId)}` }
      case 'on_fire':
        return { x: attacksRight ? 60 + minuteRand(currentMinute, 6) * 25 : 15 + minuteRand(currentMinute, 6) * 25, y: 25 + minuteRand(currentMinute, 7) * 50, pulse: 'fire', label: `🔥 ${getPlayerName(ev.playerId)}` }
      case 'momentum_shift':
        return { x: attacksRight ? 62 : 38, y: 45 + minuteRand(currentMinute, 8) * 10, pulse: 'none', label: ev.team === 'home' ? '→ Тиск' : '← Тиск' }
    }
  }

  const driftX = 30 + minuteRand(currentMinute, 10) * 40
  const driftY = 20 + minuteRand(currentMinute, 11) * 60
  return { x: driftX, y: driftY, pulse: 'none', label: '' }
}

// ─── Map formation coords to pitch halves ───────────────────────────────────

interface PitchPlayer {
  id: string
  footballer: Footballer | undefined
  x: number  // 0-100 on pitch
  y: number  // 0-100 on pitch
  team: 'home' | 'away'
}

/** Convert formation slot coords to pitch coords. Home team on left half, away on right. */
function getLineupPositions(
  squadIds: string[],
  formation: string,
  team: 'home' | 'away',
): PitchPlayer[] {
  const formDef = FORMATIONS[formation]
  if (!formDef) return []

  return squadIds.slice(0, 11).map((id, i) => {
    const slot = formDef.slots[i]
    if (!slot) return null
    const footballer = getPlayer(id)

    // Formation slots: x=0-100 (left-right), y=0-100 (top=attacking, bottom=GK)
    // Pitch: home on left (x: 2-48%), away on right (x: 52-98%)
    // We need to flip y so attackers are toward center

    let px: number, py: number

    if (team === 'home') {
      // Home on left: GK near x=4%, attackers near x=46%
      // Map slot.y (86=GK, 18=FWD) to pitch x (4=GK, 46=FWD)
      px = 4 + ((86 - slot.y) / 70) * 42
      // Map slot.x to pitch y
      py = 8 + (slot.x / 100) * 84
    } else {
      // Away on right: GK near x=96%, attackers near x=54%
      // Map slot.y (86=GK, 18=FWD) to pitch x (96=GK, 54=FWD)
      px = 96 - ((86 - slot.y) / 70) * 42
      // Mirror y
      py = 8 + ((100 - slot.x) / 100) * 84
    }

    return { id, footballer, x: px, y: py, team }
  }).filter(Boolean) as PitchPlayer[]
}

// ─── Pitch Player Dot ───────────────────────────────────────────────────────

function PitchPlayerDot({
  player,
  stats,
  showBadges,
}: {
  player: PitchPlayer
  stats: PlayerMatchStats | undefined
  showBadges: boolean
}) {
  const hasGoal = showBadges && stats && stats.goals > 0
  const hasYellow = showBadges && stats && stats.yellowCards > 0
  const hasRed = showBadges && stats && stats.redCards > 0
  const isOnFire = showBadges && stats?.onFire
  const isSentOff = !!(stats && stats.redCards > 0)

  const borderColor = isSentOff
    ? 'rgba(100,100,100,0.5)'
    : player.team === 'home'
      ? 'rgba(0,230,118,0.7)'
      : 'rgba(255,107,107,0.7)'

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${player.x}%`,
        top: `${player.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        opacity: isSentOff ? 0.35 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Player circle with photo */}
      <div
        className="relative rounded-full overflow-hidden w-[22px] h-[22px] sm:w-[36px] sm:h-[36px]"
        style={{
          border: `2px solid ${borderColor}`,
          background: '#0A0F1A',
          boxShadow: isSentOff
            ? 'none'
            : isOnFire
              ? '0 0 8px rgba(255,140,0,0.7), 0 0 3px rgba(255,140,0,0.4)'
              : `0 0 4px ${borderColor}`,
          filter: isSentOff ? 'grayscale(1)' : 'none',
        }}
      >
        {player.footballer?.photoUrl ? (
          <img
            src={`${import.meta.env.BASE_URL}${player.footballer.photoUrl.replace(/^\//, '')}`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[8px] sm:text-xs">
            {player.footballer?.emoji ?? '⚽'}
          </div>
        )}
      </div>

      {/* Player name */}
      <div
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-oswald text-[7px] sm:text-[10px] tracking-wide"
        style={{
          top: 'calc(100% + 2px)',
          color: isSentOff ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.6)',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          textDecoration: isSentOff ? 'line-through' : 'none',
        }}
      >
        {player.footballer ? getLastName(player.footballer.name) : ''}
      </div>

      {/* Badges container — positioned to the right of the dot */}
      {showBadges && (hasGoal || hasYellow || hasRed) && (
        <div
          className="absolute flex gap-0.5"
          style={{
            left: '100%',
            top: -2,
          }}
        >
          {hasGoal && (
            <div className="flex items-center" style={{ fontSize: 8, lineHeight: 1 }}>
              <span className="text-[8px] sm:text-[12px]">⚽</span>
              {stats!.goals > 1 && (
                <span className="text-white font-bold text-[7px] sm:text-[10px]">×{stats!.goals}</span>
              )}
            </div>
          )}
          {hasYellow && !hasRed && <span className="text-[8px] sm:text-[12px]">🟨</span>}
          {hasRed && <span className="text-[8px] sm:text-[12px]">🟥</span>}
        </div>
      )}
    </div>
  )
}

// ─── Pitch Component ────────────────────────────────────────────────────────

function MatchPitch({
  ball,
  isFinished,
  homePlayers,
  awayPlayers,
  playerStats,
  showBadges,
  cinematicEvent,
  cinematicPhaseIndex,
  onPhaseComplete,
}: {
  ball: BallState
  isFinished: boolean
  homePlayers: PitchPlayer[]
  awayPlayers: PitchPlayer[]
  playerStats: Record<string, PlayerMatchStats>
  showBadges: boolean
  cinematicEvent?: MatchEvent | null
  cinematicPhaseIndex?: number
  onPhaseComplete?: () => void
}) {
  const pulseColor = ball.pulse === 'goal' ? 'rgba(0,230,118,0.8)'
    : ball.pulse === 'danger' ? 'rgba(255,107,107,0.6)'
    : ball.pulse === 'card' ? 'rgba(255,200,50,0.6)'
    : ball.pulse === 'fire' ? 'rgba(255,140,0,0.7)'
    : 'rgba(255,255,255,0.3)'

  const showRipple = ball.pulse !== 'none'

  return (
    <div className="relative w-full rounded-xl overflow-hidden mb-4 border border-[#1A4D2E]/60"
         style={{ aspectRatio: '2 / 1', background: 'linear-gradient(180deg, #1a6b32 0%, #15572a 100%)' }}>
      {/* Pitch stripe pattern */}
      <div className="absolute inset-0 opacity-[0.07]"
           style={{
             backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 9%, rgba(255,255,255,1) 9%, rgba(255,255,255,1) 10%)',
           }} />

      {/* Field markings */}
      <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <rect x="2" y="2" width="196" height="96" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
        <line x1="100" y1="2" x2="100" y2="98" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
        <circle cx="100" cy="50" r="14" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
        <circle cx="100" cy="50" r="1" fill="rgba(255,255,255,0.2)" />
        <rect x="2" y="26" width="22" height="48" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
        <rect x="2" y="36" width="8" height="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <rect x="176" y="26" width="22" height="48" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
        <rect x="190" y="36" width="8" height="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <rect x="0" y="40" width="2" height="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        <rect x="198" y="40" width="2" height="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        <path d="M 2,6 A 4,4 0 0 1 6,2" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <path d="M 194,2 A 4,4 0 0 1 198,6" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <path d="M 2,94 A 4,4 0 0 0 6,98" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <path d="M 194,98 A 4,4 0 0 0 198,94" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
      </svg>

      {/* Team players */}
      {homePlayers.map(p => (
        <PitchPlayerDot key={p.id} player={p} stats={playerStats[playerStatsKey('home', p.id)]} showBadges={showBadges} />
      ))}
      {awayPlayers.map(p => (
        <PitchPlayerDot key={p.id} player={p} stats={playerStats[playerStatsKey('away', p.id)]} showBadges={showBadges} />
      ))}

      {/* Goal flash */}
      <AnimatePresence>
        {ball.pulse === 'goal' && (
          <motion.div
            key="goal-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 0.8, times: [0, 0.2, 1] }}
            className="absolute inset-0"
            style={{
              background: ball.x > 50
                ? 'linear-gradient(270deg, rgba(0,230,118,0.3) 0%, transparent 40%)'
                : 'linear-gradient(90deg, rgba(0,230,118,0.3) 0%, transparent 40%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Ball ripple */}
      <AnimatePresence>
        {showRipple && (
          <motion.div
            key={`ripple-${ball.x}-${ball.y}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${ball.x}%`, top: `${ball.y}%`,
              transform: 'translate(-50%, -50%)',
              border: `2px solid ${pulseColor}`,
              zIndex: 20,
            }}
            initial={{ width: 8, height: 8, opacity: 0.8 }}
            animate={{ width: 40, height: 40, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Ball */}
      {!isFinished && !cinematicEvent && (
        <motion.div
          className="absolute pointer-events-none"
          style={{ transform: 'translate(-50%, -50%)', zIndex: 25 }}
          animate={{ left: `${ball.x}%`, top: `${ball.y}%` }}
          transition={{
            type: 'spring',
            stiffness: ball.pulse === 'goal' ? 300 : 120,
            damping: ball.pulse === 'goal' ? 20 : 18,
            mass: 0.8,
          }}
        >
          <div className="absolute rounded-full" style={{
            width: 18, height: 18, left: -3, top: -3,
            background: `radial-gradient(circle, ${pulseColor} 0%, transparent 70%)`,
            opacity: showRipple ? 0.7 : 0.3,
          }} />
          <div className="rounded-full" style={{
            width: 10, height: 10,
            background: 'radial-gradient(circle at 35% 35%, #fff 0%, #ddd 50%, #aaa 100%)',
            boxShadow: `0 0 6px rgba(255,255,255,0.5), 0 0 ${showRipple ? 12 : 4}px ${pulseColor}`,
          }} />
        </motion.div>
      )}

      {/* Cinematic Overlay */}
      <CinematicOverlay
        event={cinematicEvent ?? null}
        phaseIndex={cinematicPhaseIndex ?? 0}
        onPhaseComplete={onPhaseComplete ?? (() => {})}
      />

      {/* Status label */}
      <AnimatePresence mode="wait">
        {ball.label && !isFinished && (
          <motion.div
            key={ball.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-oswald tracking-wider whitespace-nowrap"
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: ball.pulse === 'goal' ? '#00E676' : ball.pulse === 'fire' ? '#FF8C00' : ball.pulse === 'card' ? '#FFC832' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 30,
            }}
          >
            {ball.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Post-match Lineups ─────────────────────────────────────────────────────

function PostMatchLineup({
  title,
  titleColor,
  squadIds,
  formation,
  playerStats,
  bench,
  matchEvents,
  team,
}: {
  title: string
  titleColor: string
  squadIds: string[]
  formation: string
  playerStats: Record<string, PlayerMatchStats>
  bench?: string[]
  matchEvents?: MatchEvent[]
  team?: 'home' | 'away'
}) {
  const formDef = FORMATIONS[formation]

  return (
    <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`font-oswald text-xs uppercase tracking-widest ${titleColor}`}>
          {title}
        </div>
        <div className="font-oswald text-[10px] text-[#5A7090] tracking-wider">
          {formDef?.label ?? formation}
        </div>
      </div>
      <div className="space-y-1">
        {squadIds.slice(0, 11).map((id, i) => {
          const player = getPlayer(id)
          if (!player) return null
          const statsKey = team ? playerStatsKey(team, id) : id
          const stats = playerStats[statsKey]
          const rating = calcRating(statsKey, playerStats)
          const ratingColor = rating >= 8 ? 'text-[#00E676]'
            : rating >= 7 ? 'text-yellow-400'
            : rating < 6 ? 'text-red-400'
            : 'text-[#8A9BBF]'
          const subOutEvent = matchEvents?.find(
            e => e.type === 'substitution' && e.playerId === id && (!team || e.team === team)
          )

          return (
            <div key={id} className={`flex items-center gap-2 py-1 ${subOutEvent ? 'opacity-60' : ''}`}>
              {/* Position tag */}
              <span className="font-oswald text-[9px] text-[#5A7090] w-6 text-center shrink-0">
                {formDef?.slots[i]?.pos ?? player.position}
              </span>

              {/* Photo */}
              <div className="w-7 h-7 rounded-full overflow-hidden bg-[#1A2336] border border-[#2A3346] shrink-0">
                {player.photoUrl ? (
                  <img src={`${import.meta.env.BASE_URL}${player.photoUrl.replace(/^\//, '')}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">
                    {player.emoji}
                  </div>
                )}
              </div>

              {/* Name */}
              <span className="flex-1 text-xs text-white truncate">
                {player.name}
              </span>

              {/* Sub-out indicator */}
              {subOutEvent && (
                <span className="font-oswald text-[10px] text-red-400 shrink-0">
                  ↓ {subOutEvent.minute}'
                </span>
              )}

              {/* Event badges */}
              <div className="flex items-center gap-0.5 shrink-0">
                {stats?.goals ? (
                  <span className="text-[10px]">
                    {'⚽'.repeat(Math.min(stats.goals, 3))}
                    {stats.goals > 3 && <span className="text-[8px] text-[#8A9BBF]">×{stats.goals}</span>}
                  </span>
                ) : null}
                {stats?.greatSaves ? (
                  <span className="text-[10px]">
                    {'🧤'.repeat(Math.min(stats.greatSaves, 2))}
                  </span>
                ) : null}
                {stats?.yellowCards ? <span className="text-[10px]">🟨</span> : null}
                {stats?.redCards ? <span className="text-[10px]">🟥</span> : null}
                {stats?.onFire ? <span className="text-[10px]">🔥</span> : null}
              </div>

              {/* Rating */}
              <span className={`font-oswald text-xs font-bold w-7 text-right shrink-0 ${ratingColor}`}>
                {rating.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bench section */}
      {bench && bench.length > 0 && (
        <>
          <div className="mt-3 pt-3 border-t border-[#1A2336]">
            <div className="font-oswald text-[9px] text-[#5A7090] uppercase tracking-widest mb-2">
              Лава
            </div>
          </div>
          <div className="space-y-1">
            {bench.map(id => {
              const player = getPlayer(id)
              if (!player) return null

              const subEvent = matchEvents?.find(
                e => e.type === 'substitution' && e.subInPlayerId === id && (!team || e.team === team)
              )
              const subMinute = subEvent?.minute
              const wasUsed = !!subEvent

              return (
                <div key={id} className={`flex items-center gap-2 py-1 ${!wasUsed ? 'opacity-40' : ''}`}>
                  <span className="font-oswald text-[9px] text-[#5A7090] w-6 text-center shrink-0">
                    {player.position}
                  </span>
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-[#1A2336] border border-[#2A3346] shrink-0">
                    {player.photoUrl ? (
                      <img src={`${import.meta.env.BASE_URL}${player.photoUrl.replace(/^\//, '')}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">
                        {player.emoji}
                      </div>
                    )}
                  </div>
                  <span className="flex-1 text-xs text-white truncate">
                    {player.name}
                  </span>
                  {wasUsed && (
                    <span className="font-oswald text-[10px] text-[#00E676]">
                      ↑ {subMinute}'
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface Props {
  match: Match
  homeName: string
  awayName: string
  viewerTeam: 'home' | 'away'
  onFinish: () => void
}

export function MatchLive({ match, homeName, awayName, viewerTeam, onFinish }: Props) {
  const [currentMinute, setCurrentMinute] = useState(0)
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([])
  const [scoreHome, setScoreHome] = useState(0)
  const [scoreAway, setScoreAway] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [isHalfTime, setIsHalfTime] = useState(false)
  const [cinematicEvent, setCinematicEvent] = useState<MatchEvent | null>(null)
  const [cinematicPhaseIndex, setCinematicPhaseIndex] = useState(0)
  const [queueDraining, setQueueDraining] = useState(false)
  const cinematicQueueRef = useRef<MatchEvent[]>([])
  const queueTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastProcessedMinute = useRef(0)

  // Cleanup queue timers on unmount
  useEffect(() => () => clearTimeout(queueTimerRef.current), [])

  const tick = useCallback(() => {
    setCurrentMinute(prev => Math.min(prev + 1, 91))
  }, [])

  const startNextFromQueue = useCallback(() => {
    const queue = cinematicQueueRef.current
    if (queue.length === 0) {
      setCinematicEvent(null)
      setQueueDraining(false)
      return
    }
    const next = queue.shift()!
    if (next.phases && next.phases.length > 0 && CINEMATIC_TYPES.has(next.type)) {
      // It's a cinematic event — show overlay
      setCinematicEvent(next)
      setCinematicPhaseIndex(0)
      // Also add to visible events for commentary
      setVisibleEvents(ve => [...ve, next])
    } else {
      // It's a regular event (outcome after cinematic) — process normally
      setVisibleEvents(ve => [...ve, next])
      SOUND_MAP[next.type]?.()
      if (next.type === 'goal') {
        if (next.team === 'home') setScoreHome(s => s + 1)
        else setScoreAway(s => s + 1)
      }
      if (next.type === 'var_review' && next.varOutcome === 'disallowed') {
        if (next.team === 'home') setScoreHome(s => s - 1)
        else setScoreAway(s => s - 1)
      }
      // Process next in queue immediately (with a tiny delay for visual effect)
      queueTimerRef.current = setTimeout(startNextFromQueue, 300)
    }
  }, [])

  const handlePhaseComplete = useCallback(() => {
    if (!cinematicEvent?.phases) return
    const nextPhase = cinematicPhaseIndex + 1
    if (nextPhase < cinematicEvent.phases.length) {
      setCinematicPhaseIndex(nextPhase)
    } else {
      // Cinematic sequence complete — process next from queue
      setCinematicEvent(null)
      setCinematicPhaseIndex(0)
      // Small delay before processing next event
      queueTimerRef.current = setTimeout(startNextFromQueue, 200)
    }
  }, [cinematicEvent, cinematicPhaseIndex, startNextFromQueue])

  useEffect(() => {
    if (currentMinute === 0 || currentMinute <= lastProcessedMinute.current) return
    lastProcessedMinute.current = currentMinute

    if (currentMinute > 90) {
      playFinalWhistle()
      setIsFinished(true)
      return
    }

    const minuteEvents = match.events.filter(e => e.minute === currentMinute)
    if (minuteEvents.length === 0) {
      if (currentMinute === 45) {
        setIsHalfTime(true)
        setTimeout(() => setIsHalfTime(false), 2000)
      }
      return
    }

    // Check if any events are cinematic
    const hasCinematic = minuteEvents.some(ev => ev.phases && ev.phases.length > 0 && CINEMATIC_TYPES.has(ev.type))

    if (hasCinematic) {
      // Queue ALL events for this minute — cinematics play as overlay,
      // others process after their preceding cinematic finishes
      cinematicQueueRef.current = [...cinematicQueueRef.current, ...minuteEvents]
      setQueueDraining(true)
      if (!cinematicEvent) {
        startNextFromQueue()
      }
    } else {
      // No cinematics — process all immediately (existing behavior)
      setVisibleEvents(ve => [...ve, ...minuteEvents])
      for (const ev of minuteEvents) {
        SOUND_MAP[ev.type]?.()
        if (ev.type === 'goal') {
          if (ev.team === 'home') setScoreHome(s => s + 1)
          else setScoreAway(s => s + 1)
        }
        if (ev.type === 'var_review' && ev.varOutcome === 'disallowed') {
          if (ev.team === 'home') setScoreHome(s => s - 1)
          else setScoreAway(s => s - 1)
        }
      }
    }

    if (currentMinute === 45) {
      setIsHalfTime(true)
      setTimeout(() => setIsHalfTime(false), 2000)
    }
  }, [currentMinute, match.events, cinematicEvent, startNextFromQueue])

  useEffect(() => {
    if (isFinished || isHalfTime || currentMinute > 90) return
    if (cinematicEvent || queueDraining) return  // freeze timer during cinematic or queue drain
    const hasEvent = match.events.some(e => e.minute === currentMinute + 1)
    const delay = hasEvent ? 800 : 250
    timerRef.current = setTimeout(tick, delay)
    return () => clearTimeout(timerRef.current)
  }, [currentMinute, isFinished, isHalfTime, tick, match.events, cinematicEvent, queueDraining])

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleEvents])

  // Result from viewer's perspective
  const viewerWon = (viewerTeam === 'home' && match.result === 'home_win') ||
    (viewerTeam === 'away' && match.result === 'away_win')
  const viewerLost = (viewerTeam === 'home' && match.result === 'away_win') ||
    (viewerTeam === 'away' && match.result === 'home_win')
  const resultLabel = viewerWon ? 'ПЕРЕМОГА' : viewerLost ? 'ПОРАЗКА' : 'НІЧИЯ'
  const resultColor = viewerWon ? 'text-[#00E676]' : viewerLost ? 'text-red-400' : 'text-yellow-400'

  // Ball state
  const latestEvent = useMemo(() => {
    if (visibleEvents.length === 0) return null
    return visibleEvents[visibleEvents.length - 1]
  }, [visibleEvents])
  const ballState = getBallState(currentMinute, latestEvent, isHalfTime)

  // Pitch players
  const homePitchPlayers = useMemo(
    () => getLineupPositions(match.challengerSquad.squad, match.challengerSquad.formation, 'home'),
    [match.challengerSquad],
  )
  const awayPitchPlayers = useMemo(
    () => getLineupPositions(match.challengedSquad.squad, match.challengedSquad.formation, 'away'),
    [match.challengedSquad],
  )

  // Player stats from visible events (accumulates during match)
  const playerStats = useMemo(() => buildPlayerStats(visibleEvents), [visibleEvents])
  // Full stats for post-match
  const fullPlayerStats = useMemo(() => buildPlayerStats(match.events), [match.events])

  // ─── Event feed (shared between mobile & desktop) ──────────────────────
  const eventFeed = (
    <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-4 max-h-[30vh] sm:max-h-full overflow-y-auto sm:h-full">
      <div className="font-oswald text-[10px] text-[#5A7090] uppercase tracking-widest mb-2 hidden sm:block">
        Коментарі
      </div>
      {visibleEvents.length === 0 && (
        <div className="text-center text-[#5A7090] text-sm py-4 font-oswald tracking-wider">
          МАТЧ РОЗПОЧАВСЯ...
        </div>
      )}
      <AnimatePresence>
        {visibleEvents.map((ev, i) => (
          <motion.div
            key={`${ev.minute}-${ev.type}-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-2 py-2 text-sm ${
              ev.type === 'goal' ? 'text-white font-bold' : 'text-[#8A9BBF]'
            }`}
          >
            <span className="text-[#5A7090] font-oswald text-xs w-8 shrink-0 pt-0.5">
              {ev.minute}'
            </span>
            <span className="shrink-0">{EVENT_ICONS[ev.type]}</span>
            <span>
              {ev.type === 'substitution' ? (
                <>
                  <span className="text-red-400">↓ {getPlayerName(ev.playerId)}</span>
                  {' '}
                  <span className="text-[#00E676]">↑ {getPlayerName(ev.subInPlayerId ?? '')}</span>
                </>
              ) : ev.type === 'momentum_shift' ? (
                <span className={ev.team === 'home' ? 'text-[#00E676]' : 'text-red-400'}>
                  {ev.team === 'home' ? homeName : awayName} {ev.description}
                </span>
              ) : ev.type === 'var_review' ? (
                <span className={ev.varOutcome === 'confirmed' ? 'text-[#00E676]' : 'text-red-400'}>
                  {ev.description}
                </span>
              ) : (
                <>
                  <span className={ev.team === 'home' ? 'text-[#00E676]' : 'text-red-400'}>
                    {ev.playerId ? getPlayerName(ev.playerId) : (ev.team === 'home' ? homeName : awayName)}
                  </span>
                  {' — '}
                  {ev.description}
                </>
              )}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={eventsEndRef} />
    </div>
  )

  return (
    <div className="max-w-lg sm:max-w-5xl mx-auto px-4 py-6">
      {/* Scoreboard */}
      <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-center gap-5">
          <div className="text-center flex-1">
            <div className="font-oswald text-[10px] sm:text-xs tracking-[0.2em] text-[#00E676] uppercase mb-1 truncate">
              {homeName}
            </div>
            <div className="font-oswald text-4xl sm:text-5xl font-bold text-white">{scoreHome}</div>
          </div>
          <div className="text-center">
            <div className="font-oswald text-sm sm:text-lg text-[#5A7090]">{currentMinute > 90 ? 90 : currentMinute}'</div>
            {isHalfTime && (
              <div className="font-oswald text-xs text-yellow-400 mt-1">HT</div>
            )}
          </div>
          <div className="text-center flex-1">
            <div className="font-oswald text-[10px] sm:text-xs tracking-[0.2em] text-red-400 uppercase mb-1 truncate">
              {awayName}
            </div>
            <div className="font-oswald text-4xl sm:text-5xl font-bold text-white">{scoreAway}</div>
          </div>
        </div>
        <div className="mt-4 h-1 bg-[#1A2336] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#00E676] rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(Math.min(currentMinute, 90) / 90) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      {/* ── During match: Pitch + Commentary ── */}
      {!isFinished && (
        <>
          {/* Desktop: pitch (large) + sidebar commentary */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_280px] gap-4 mb-4">
            <MatchPitch
              ball={ballState}
              isFinished={isFinished}
              homePlayers={homePitchPlayers}
              awayPlayers={awayPitchPlayers}
              playerStats={playerStats}
              showBadges={true}
              cinematicEvent={cinematicEvent}
              cinematicPhaseIndex={cinematicPhaseIndex}
              onPhaseComplete={handlePhaseComplete}
            />
            {eventFeed}
          </div>

          {/* Mobile: pitch stacked above commentary */}
          <div className="sm:hidden">
            <MatchPitch
              ball={ballState}
              isFinished={isFinished}
              homePlayers={homePitchPlayers}
              awayPlayers={awayPitchPlayers}
              playerStats={playerStats}
              showBadges={true}
              cinematicEvent={cinematicEvent}
              cinematicPhaseIndex={cinematicPhaseIndex}
              onPhaseComplete={handlePhaseComplete}
            />
            {eventFeed}
          </div>
        </>
      )}

      {/* ── Full-time result + lineups ── */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Pitch with final state */}
            <MatchPitch
              ball={ballState}
              isFinished={isFinished}
              homePlayers={homePitchPlayers}
              awayPlayers={awayPitchPlayers}
              playerStats={fullPlayerStats}
              showBadges={true}
            />

            {/* Result banner */}
            <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-6 text-center mb-4">
              <div className="font-oswald text-xs tracking-[0.3em] text-[#5A7090] uppercase mb-2">
                Фінальний свисток
              </div>
              <div className={`font-oswald text-3xl sm:text-4xl font-bold ${resultColor} mb-1`}>
                {resultLabel}
              </div>
              <div className="font-oswald text-xl sm:text-2xl text-white mb-4">
                {scoreHome} — {scoreAway}
              </div>
              {((viewerTeam === 'away' && (match.result === 'away_win' || match.result === 'draw')) ||
                (viewerTeam === 'home' && (match.result === 'home_win' || match.result === 'draw'))) && (
                <div className="text-[#00E676] text-sm mb-4">
                  +{match.result === 'draw' ? 50 : 100} 🪙
                </div>
              )}
            </div>

            {/* Team lineups: stacked on mobile, 2 columns on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <PostMatchLineup
                title={homeName}
                titleColor="text-[#00E676]"
                squadIds={match.challengerSquad.squad}
                formation={match.challengerSquad.formation}
                playerStats={fullPlayerStats}
                bench={match.challengerSquad.bench}
                matchEvents={match.events}
                team="home"
              />
              <PostMatchLineup
                title={awayName}
                titleColor="text-red-400"
                squadIds={match.challengedSquad.squad}
                formation={match.challengedSquad.formation}
                playerStats={fullPlayerStats}
                bench={match.challengedSquad.bench}
                matchEvents={match.events}
                team="away"
              />
            </div>

            {/* Continue button */}
            <div className="text-center">
              <button
                onClick={onFinish}
                className="px-6 py-2.5 bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] rounded-xl font-oswald font-bold text-sm tracking-wider hover:bg-[#00E676]/20 transition-colors cursor-pointer"
              >
                ПРОДОВЖИТИ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
