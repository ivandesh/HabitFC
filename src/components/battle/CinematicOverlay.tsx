import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MatchEvent } from '../../types'
import { footballerMap } from '../../data/footballers'
import {
  playWhistleShort,
  playTensionBuild,
  playKickImpact,
  playVarBeep,
  playCrowdRoar,
  playCrowdGroan,
  playCounterattackBuild,
} from '../../lib/sounds'

interface Props {
  event: MatchEvent | null
  phaseIndex: number
  onPhaseComplete: () => void
}

const textShadow = '0 2px 8px rgba(0,0,0,0.8)'

function renderPenalty(phase: string, playerName: string) {
  switch (phase) {
    case 'foul':
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/30">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-oswald text-6xl font-bold text-red-400 uppercase"
            style={{ textShadow }}
          >
            🔴 ПЕНАЛЬТІ!
          </motion.span>
        </div>
      )
    case 'whistle':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
            className="font-oswald text-5xl font-bold text-red-400"
            style={{ textShadow }}
          >
            🔴 ПЕНАЛЬТІ!
          </motion.span>
        </div>
      )
    case 'player_walks_to_spot':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
          <span className="font-oswald text-4xl font-bold text-red-400" style={{ textShadow }}>
            🔴 ПЕНАЛЬТІ!
          </span>
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-oswald text-2xl text-[#E8F0FF] mt-3"
            style={{ textShadow }}
          >
            {playerName}
          </motion.span>
        </div>
      )
    case 'keeper_ready':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="font-oswald text-3xl text-[#E8F0FF]"
            style={{ textShadow }}
          >
            🧤 Воротар готується...
          </motion.span>
        </div>
      )
    case 'kick':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ scale: 0.3 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.3 }}
            className="font-oswald text-7xl font-bold text-[#00E676]"
            style={{ textShadow }}
          >
            ⚡ УДАР!
          </motion.span>
        </div>
      )
    case 'outcome':
      return (
        <div className="absolute inset-0 bg-white/10" />
      )
    default:
      return null
  }
}

function renderFreeKick(phase: string, playerName: string) {
  switch (phase) {
    case 'foul':
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-yellow-900/20">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-oswald text-6xl font-bold text-yellow-400 uppercase"
            style={{ textShadow }}
          >
            ШТРАФНИЙ!
          </motion.span>
        </div>
      )
    case 'wall_lines_up':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-oswald text-3xl text-[#E8F0FF]"
            style={{ textShadow }}
          >
            🧱 Стінка шикується...
          </motion.span>
        </div>
      )
    case 'run_up':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="font-oswald text-3xl text-[#E8F0FF]"
            style={{ textShadow }}
          >
            {playerName} розбігається...
          </motion.span>
        </div>
      )
    case 'kick':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ scale: 0.3 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.3 }}
            className="font-oswald text-7xl font-bold text-[#00E676]"
            style={{ textShadow }}
          >
            ⚡ УДАР!
          </motion.span>
        </div>
      )
    case 'outcome':
      return (
        <div className="absolute inset-0 bg-white/10" />
      )
    default:
      return null
  }
}

function renderCorner(phase: string) {
  switch (phase) {
    case 'ball_out':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-oswald text-6xl font-bold text-[#E8F0FF] uppercase"
            style={{ textShadow }}
          >
            🚩 КУТОВИЙ!
          </motion.span>
        </div>
      )
    case 'corner_setup':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-oswald text-3xl text-[#E8F0FF]"
            style={{ textShadow }}
          >
            Подача з кутового...
          </motion.span>
        </div>
      )
    case 'cross':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="font-oswald text-4xl font-bold text-[#E8F0FF]"
            style={{ textShadow }}
          >
            ↗️ Навіс у штрафну!
          </motion.span>
        </div>
      )
    case 'header':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ scale: 0.3 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.25 }}
            className="font-oswald text-5xl font-bold text-[#00E676]"
            style={{ textShadow }}
          >
            💥 Удар головою!
          </motion.span>
        </div>
      )
    case 'outcome':
      return (
        <div className="absolute inset-0 bg-white/10" />
      )
    default:
      return null
  }
}

function renderCounterattack(phase: string) {
  switch (phase) {
    case 'interception':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ x: -200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="font-oswald text-6xl font-bold text-[#00E676] uppercase"
            style={{ textShadow }}
          >
            ⚡ КОНТРАТАКА!
          </motion.span>
        </div>
      )
    case 'pass_1':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="font-oswald text-4xl text-[#E8F0FF]"
            style={{ textShadow }}
          >
            ➡️ Пас!
          </motion.span>
        </div>
      )
    case 'pass_2':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="font-oswald text-4xl text-[#E8F0FF]"
            style={{ textShadow }}
          >
            ➡️ Ще один!
          </motion.span>
        </div>
      )
    case 'shot':
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ scale: 0.3 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.3 }}
            className="font-oswald text-7xl font-bold text-[#00E676]"
            style={{ textShadow }}
          >
            💥 УДАР!
          </motion.span>
        </div>
      )
    case 'outcome':
      return (
        <div className="absolute inset-0 bg-white/10" />
      )
    default:
      return null
  }
}

function renderVar(phase: string, varOutcome?: 'confirmed' | 'disallowed') {
  switch (phase) {
    case 'celebration_pause':
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1E40AF]/30">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1E40AF] px-8 py-4 rounded-lg"
          >
            <span className="font-oswald text-5xl font-bold text-[#E8F0FF]" style={{ textShadow }}>
              📺 VAR
            </span>
          </motion.div>
        </div>
      )
    case 'var_check':
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1E40AF]/20 overflow-hidden">
          {/* Scanning lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="absolute left-0 right-0 h-px bg-[#E8F0FF]/30"
              initial={{ y: -20 }}
              animate={{ y: ['0%', '400%'] }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                delay: i * 0.3,
                ease: 'linear',
              }}
              style={{ top: `${i * 20}%` }}
            />
          ))}
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="font-oswald text-4xl font-bold text-[#E8F0FF] z-10"
            style={{ textShadow }}
          >
            🔍 ПЕРЕВІРКА...
          </motion.span>
        </div>
      )
    case 'decision':
      if (varOutcome === 'confirmed') {
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-[#00E676]/90 px-12 py-6 rounded-lg"
            >
              <span className="font-oswald text-4xl font-bold text-[#0A0F1A]">
                ✅ ГОЛ ЗАРАХОВАНО!
              </span>
            </motion.div>
          </div>
        )
      }
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-red-600/90 px-12 py-6 rounded-lg"
          >
            <span className="font-oswald text-4xl font-bold text-[#E8F0FF]">
              ❌ ГОЛ СКАСОВАНО!
            </span>
          </motion.div>
        </div>
      )
    default:
      return null
  }
}

function renderPhaseContent(
  type: string,
  phase: string,
  playerName: string,
  varOutcome?: 'confirmed' | 'disallowed',
) {
  switch (type) {
    case 'penalty':
      return renderPenalty(phase, playerName)
    case 'free_kick':
      return renderFreeKick(phase, playerName)
    case 'corner':
      return renderCorner(phase)
    case 'counterattack':
      return renderCounterattack(phase)
    case 'var_review':
      return renderVar(phase, varOutcome)
    default:
      return null
  }
}

export function CinematicOverlay({ event, phaseIndex, onPhaseComplete }: Props) {
  // Sound triggers
  useEffect(() => {
    if (!event?.phases) return
    const phase = event.phases[phaseIndex]?.phase

    switch (phase) {
      case 'foul':
      case 'whistle':
        playWhistleShort()
        break
      case 'player_walks_to_spot':
      case 'wall_lines_up':
      case 'corner_setup':
        playTensionBuild()
        break
      case 'kick':
      case 'shot':
      case 'header':
        playKickImpact()
        break
      case 'var_check':
        playVarBeep()
        break
      case 'decision':
        if (event.varOutcome === 'confirmed') playCrowdRoar()
        else if (event.varOutcome === 'disallowed') playCrowdGroan()
        break
      case 'interception':
        playCounterattackBuild()
        break
    }
  }, [event, phaseIndex])

  // Phase timer
  useEffect(() => {
    if (!event?.phases) return
    const phase = event.phases[phaseIndex]
    if (!phase) return
    const timer = setTimeout(onPhaseComplete, phase.duration * 1000)
    return () => clearTimeout(timer)
  }, [event, phaseIndex, onPhaseComplete])

  if (!event) return null

  const currentPhase = event.phases?.[phaseIndex]?.phase ?? ''
  const playerName = footballerMap.get(event.playerId)?.name ?? ''

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${event.type}-${phaseIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {renderPhaseContent(event.type, currentPhase, playerName, event.varOutcome)}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
