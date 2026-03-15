import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Match, MatchEvent } from '../../types'
import { footballers } from '../../data/footballers'
import {
  playGoal, playYellowCard, playRedCard,
  playNearMiss, playGreatSave, playFinalWhistle,
} from '../../lib/sounds'

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽', yellow_card: '🟨', red_card: '🟥',
  near_miss: '💨', great_save: '🧤', on_fire: '🔥', momentum_shift: '🔄',
}

const SOUND_MAP: Record<string, (() => void) | undefined> = {
  goal: playGoal,
  yellow_card: playYellowCard,
  red_card: playRedCard,
  near_miss: playNearMiss,
  great_save: playGreatSave,
}

function getPlayerName(id: string): string {
  return footballers.find(f => f.id === id)?.name ?? 'Гравець'
}

// ─── Pitch ball position logic ──────────────────────────────────────────────

interface BallState {
  x: number  // 0-100 (left to right)
  y: number  // 0-100 (top to bottom)
  pulse: 'none' | 'goal' | 'danger' | 'card' | 'fire'
  label: string
}

/** Simple seeded random for ball drift — deterministic per minute */
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
  // Half-time: ball at center
  if (isHalfTime) {
    return { x: 50, y: 50, pulse: 'none', label: 'Перерва' }
  }

  // If there's a current event, position ball accordingly
  if (latestEvent && latestEvent.minute === currentMinute) {
    const ev = latestEvent
    // Home attacks right, away attacks left
    const attacksRight = ev.team === 'home'

    switch (ev.type) {
      case 'goal':
        return {
          x: attacksRight ? 93 : 7,
          y: 45 + minuteRand(currentMinute, 1) * 10,
          pulse: 'goal',
          label: `⚽ ГОЛ!`,
        }
      case 'near_miss':
        return {
          x: attacksRight ? 88 : 12,
          y: 20 + minuteRand(currentMinute, 2) * 60,
          pulse: 'danger',
          label: getPlayerName(ev.playerId),
        }
      case 'great_save': {
        // great_save team = the keeper's team, the attacking team is the opposite
        const keeperSide = ev.team === 'home'
        return {
          x: keeperSide ? 10 : 90,
          y: 40 + minuteRand(currentMinute, 3) * 20,
          pulse: 'danger',
          label: `🧤 ${getPlayerName(ev.playerId)}`,
        }
      }
      case 'yellow_card':
      case 'red_card':
        return {
          x: 35 + minuteRand(currentMinute, 4) * 30,
          y: 25 + minuteRand(currentMinute, 5) * 50,
          pulse: 'card',
          label: `${ev.type === 'red_card' ? '🟥' : '🟨'} ${getPlayerName(ev.playerId)}`,
        }
      case 'on_fire':
        return {
          x: attacksRight ? 60 + minuteRand(currentMinute, 6) * 25 : 15 + minuteRand(currentMinute, 6) * 25,
          y: 25 + minuteRand(currentMinute, 7) * 50,
          pulse: 'fire',
          label: `🔥 ${getPlayerName(ev.playerId)}`,
        }
      case 'momentum_shift':
        return {
          x: attacksRight ? 62 : 38,
          y: 45 + minuteRand(currentMinute, 8) * 10,
          pulse: 'none',
          label: ev.team === 'home' ? '→ Тиск' : '← Тиск',
        }
    }
  }

  // Default: ball drifts around midfield area
  const driftX = 30 + minuteRand(currentMinute, 10) * 40
  const driftY = 20 + minuteRand(currentMinute, 11) * 60
  return { x: driftX, y: driftY, pulse: 'none', label: '' }
}

// ─── Pitch Component ────────────────────────────────────────────────────────

function MatchPitch({
  ball,
  isFinished,
}: {
  ball: BallState
  isFinished: boolean
}) {
  const pulseColor = ball.pulse === 'goal' ? 'rgba(0,230,118,0.8)'
    : ball.pulse === 'danger' ? 'rgba(255,107,107,0.6)'
    : ball.pulse === 'card' ? 'rgba(255,200,50,0.6)'
    : ball.pulse === 'fire' ? 'rgba(255,140,0,0.7)'
    : 'rgba(255,255,255,0.3)'

  const showRipple = ball.pulse !== 'none'

  return (
    <div className="relative w-full rounded-xl overflow-hidden mb-4 border border-[#1A4D2E]/60"
         style={{ aspectRatio: '2.2 / 1', background: 'linear-gradient(180deg, #1a6b32 0%, #15572a 100%)' }}>
      {/* Pitch stripe pattern */}
      <div className="absolute inset-0 opacity-[0.07]"
           style={{
             backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 9%, rgba(255,255,255,1) 9%, rgba(255,255,255,1) 10%)',
           }} />

      {/* Field markings — SVG overlay */}
      <svg viewBox="0 0 200 90" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* Outline */}
        <rect x="2" y="2" width="196" height="86" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        {/* Halfway line */}
        <line x1="100" y1="2" x2="100" y2="88" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        {/* Center circle */}
        <circle cx="100" cy="45" r="14" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <circle cx="100" cy="45" r="1" fill="rgba(255,255,255,0.25)" />
        {/* Left penalty box */}
        <rect x="2" y="22" width="22" height="46" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <rect x="2" y="32" width="8" height="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        {/* Right penalty box */}
        <rect x="176" y="22" width="22" height="46" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <rect x="190" y="32" width="8" height="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        {/* Left goal */}
        <rect x="0" y="37" width="2" height="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        {/* Right goal */}
        <rect x="198" y="37" width="2" height="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        {/* Corner arcs */}
        <path d="M 2,6 A 4,4 0 0 1 6,2" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <path d="M 194,2 A 4,4 0 0 1 198,6" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <path d="M 2,84 A 4,4 0 0 0 6,88" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <path d="M 194,88 A 4,4 0 0 0 198,84" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      </svg>

      {/* Goal net flash on goal */}
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

      {/* Ball ripple effect */}
      <AnimatePresence>
        {showRipple && (
          <motion.div
            key={`ripple-${ball.x}-${ball.y}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${ball.x}%`,
              top: `${ball.y}%`,
              transform: 'translate(-50%, -50%)',
              border: `2px solid ${pulseColor}`,
            }}
            initial={{ width: 8, height: 8, opacity: 0.8 }}
            animate={{ width: 40, height: 40, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Ball */}
      {!isFinished && (
        <motion.div
          className="absolute pointer-events-none"
          style={{ transform: 'translate(-50%, -50%)' }}
          animate={{
            left: `${ball.x}%`,
            top: `${ball.y}%`,
          }}
          transition={{
            type: 'spring',
            stiffness: ball.pulse === 'goal' ? 300 : 120,
            damping: ball.pulse === 'goal' ? 20 : 18,
            mass: 0.8,
          }}
        >
          {/* Ball glow */}
          <div
            className="absolute rounded-full"
            style={{
              width: 18, height: 18,
              left: -3, top: -3,
              background: `radial-gradient(circle, ${pulseColor} 0%, transparent 70%)`,
              opacity: showRipple ? 0.7 : 0.3,
            }}
          />
          {/* Ball dot */}
          <div
            className="rounded-full"
            style={{
              width: 10, height: 10,
              background: 'radial-gradient(circle at 35% 35%, #fff 0%, #ddd 50%, #aaa 100%)',
              boxShadow: `0 0 6px rgba(255,255,255,0.5), 0 0 ${showRipple ? 12 : 4}px ${pulseColor}`,
            }}
          />
        </motion.div>
      )}

      {/* Status label at bottom */}
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
              background: 'rgba(0,0,0,0.55)',
              color: ball.pulse === 'goal' ? '#00E676'
                : ball.pulse === 'fire' ? '#FF8C00'
                : ball.pulse === 'card' ? '#FFC832'
                : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {ball.label}
          </motion.div>
        )}
      </AnimatePresence>
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
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastProcessedMinute = useRef(0)

  const tick = useCallback(() => {
    setCurrentMinute(prev => Math.min(prev + 1, 91))
  }, [])

  // Process events as a side effect of minute changes — runs once per minute
  useEffect(() => {
    if (currentMinute === 0 || currentMinute <= lastProcessedMinute.current) return
    lastProcessedMinute.current = currentMinute

    if (currentMinute > 90) {
      playFinalWhistle()
      setIsFinished(true)
      return
    }

    const minuteEvents = match.events.filter(e => e.minute === currentMinute)
    if (minuteEvents.length > 0) {
      setVisibleEvents(ve => [...ve, ...minuteEvents])
      for (const ev of minuteEvents) {
        SOUND_MAP[ev.type]?.()
        if (ev.type === 'goal') {
          if (ev.team === 'home') setScoreHome(s => s + 1)
          else setScoreAway(s => s + 1)
        }
      }
    }

    if (currentMinute === 45) {
      setIsHalfTime(true)
      setTimeout(() => setIsHalfTime(false), 1500)
    }
  }, [currentMinute, match.events])

  useEffect(() => {
    if (isFinished || isHalfTime || currentMinute > 90) return

    const hasEvent = match.events.some(e => e.minute === currentMinute + 1)
    const delay = hasEvent ? 800 : 250

    timerRef.current = setTimeout(tick, delay)
    return () => clearTimeout(timerRef.current)
  }, [currentMinute, isFinished, isHalfTime, tick, match.events])

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleEvents])

  // Determine result from the viewer's perspective
  const viewerWon = (viewerTeam === 'home' && match.result === 'home_win') ||
    (viewerTeam === 'away' && match.result === 'away_win')
  const viewerLost = (viewerTeam === 'home' && match.result === 'away_win') ||
    (viewerTeam === 'away' && match.result === 'home_win')

  const resultLabel = viewerWon ? 'ПЕРЕМОГА' : viewerLost ? 'ПОРАЗКА' : 'НІЧИЯ'
  const resultColor = viewerWon ? 'text-[#00E676]' : viewerLost ? 'text-red-400' : 'text-yellow-400'

  // Latest event for the pitch
  const latestEvent = useMemo(() => {
    if (visibleEvents.length === 0) return null
    return visibleEvents[visibleEvents.length - 1]
  }, [visibleEvents])

  const ballState = getBallState(currentMinute, latestEvent, isHalfTime)

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Scoreboard */}
      <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-center gap-5">
          <div className="text-center flex-1">
            <div className="font-oswald text-[10px] tracking-[0.2em] text-[#00E676] uppercase mb-1 truncate">
              {homeName}
            </div>
            <div className="font-oswald text-4xl font-bold text-white">{scoreHome}</div>
          </div>
          <div className="text-center">
            <div className="font-oswald text-sm text-[#5A7090]">{currentMinute > 90 ? 90 : currentMinute}'</div>
            {isHalfTime && (
              <div className="font-oswald text-xs text-yellow-400 mt-1">HT</div>
            )}
          </div>
          <div className="text-center flex-1">
            <div className="font-oswald text-[10px] tracking-[0.2em] text-red-400 uppercase mb-1 truncate">
              {awayName}
            </div>
            <div className="font-oswald text-4xl font-bold text-white">{scoreAway}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-[#1A2336] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#00E676] rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(Math.min(currentMinute, 90) / 90) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      {/* Animated Pitch */}
      <MatchPitch ball={ballState} isFinished={isFinished} />

      {/* Event feed */}
      <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-4 max-h-[35vh] overflow-y-auto">
        {visibleEvents.length === 0 && !isFinished && (
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
                {ev.type === 'momentum_shift' ? (
                  <span className={ev.team === 'home' ? 'text-[#00E676]' : 'text-red-400'}>
                    {ev.team === 'home' ? homeName : awayName} {ev.description}
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

      {/* Full-time result */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-6 text-center"
          >
            <div className="font-oswald text-xs tracking-[0.3em] text-[#5A7090] uppercase mb-2">
              Фінальний свисток
            </div>
            <div className={`font-oswald text-3xl font-bold ${resultColor} mb-1`}>
              {resultLabel}
            </div>
            <div className="font-oswald text-xl text-white mb-4">
              {scoreHome} — {scoreAway}
            </div>
            {match.coinsAwardedTo.length > 0 && (
              <div className="text-[#00E676] text-sm mb-4">
                +{match.result === 'draw' ? 50 : 100} 🪙
              </div>
            )}
            <button
              onClick={onFinish}
              className="px-6 py-2.5 bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] rounded-xl font-oswald font-bold text-sm tracking-wider hover:bg-[#00E676]/20 transition-colors cursor-pointer"
            >
              ПРОДОВЖИТИ
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
