import { useState, useEffect, useRef, useCallback } from 'react'
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

    // Variable speed: faster when nothing happens
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
            <div className="font-oswald text-sm text-[#5A7090]">{currentMinute}'</div>
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
            animate={{ width: `${(currentMinute / 90) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      {/* Event feed */}
      <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-4 max-h-[40vh] overflow-y-auto">
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
