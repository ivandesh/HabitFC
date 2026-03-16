import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import type { Footballer, Pack, Coach } from '../types'
import { useAppStore } from '../store/useAppStore'
import { FootballerCard } from '../components/cards/FootballerCard'
import { CoachCard } from '../components/cards/CoachCard'
import { CoinIcon } from '../components/ui/CoinIcon'
import { playPackOpen, playCardSlide, playCardFlip } from '../lib/sounds'
import { duplicateRefund, PITY_THRESHOLD, PITY_INCREMENT, PITY_CAP } from '../lib/gacha'
import { coachPack } from '../data/coachPack'

type LocationState =
  | { type: 'footballer'; pack: Pack; cards: Footballer[]; pityCounter: number; nextPityCounter: number }
  | { type: 'coach'; coach: Coach }

type Phase = 'confirm' | 'opening' | 'revealing' | 'done'

// ─── Pack theme config ────────────────────────────────────────────────────────
const packTheme = {
  basic: {
    gradient: 'linear-gradient(155deg, #475569 0%, #1e293b 55%, #0f172a 100%)',
    border: '#475569',
    accent: '#94A3B8',
    glowColor: 'rgba(100,116,139,0.7)',
    shimmer: 'rgba(148,163,184,0.35)',
    label: 'БАЗОВИЙ',
    emoji: '📦',
  },
  premium: {
    gradient: 'linear-gradient(155deg, #3b82f6 0%, #1d4ed8 55%, #1e3a8a 100%)',
    border: '#3b82f6',
    accent: '#93C5FD',
    glowColor: 'rgba(59,130,246,0.8)',
    shimmer: 'rgba(96,165,250,0.45)',
    label: 'ПРЕМІУМ',
    emoji: '🎁',
  },
  elite: {
    gradient: 'linear-gradient(155deg, #fbbf24 0%, #d97706 55%, #78350f 100%)',
    border: '#d97706',
    accent: '#FDE68A',
    glowColor: 'rgba(251,191,36,0.9)',
    shimmer: 'rgba(252,211,77,0.55)',
    label: 'ЕЛІТ',
    emoji: '👑',
  },
} as const

type ThemeKey = keyof typeof packTheme

function getTheme(packId: string) {
  return packTheme[(packId as ThemeKey) in packTheme ? (packId as ThemeKey) : 'basic']
}

// ─── Pack visual (confirm screen) ─────────────────────────────────────────────
function PackVisual({ pack }: { pack: Pack }) {
  const theme = getTheme(pack.id)
  return (
    <div
      className="relative w-44 sm:w-52 min-h-[17rem] sm:min-h-[20rem] rounded-2xl border-2 overflow-hidden flex flex-col select-none"
      style={{
        background: theme.gradient,
        borderColor: theme.border,
        boxShadow: `0 0 60px ${theme.glowColor}, 0 20px 40px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Shimmer streak */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl z-10">
        <motion.div
          className="absolute top-0 bottom-0 w-10 -skew-x-12"
          style={{ background: `linear-gradient(to right, transparent, ${theme.shimmer}, transparent)` }}
          animate={{ left: ['-15%', '130%'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
        />
      </div>

      {/* Header band */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b z-20"
        style={{ background: 'rgba(0,0,0,0.35)', borderColor: `${theme.border}55` }}
      >
        <span className="font-oswald text-xs tracking-widest text-white/60 uppercase">⚽ HABITFC</span>
        <span className="font-oswald text-xs tracking-widest uppercase" style={{ color: theme.accent }}>
          {theme.label}
        </span>
      </div>

      {/* Center visual */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 relative z-20">
        {/* Diagonal stripe bg */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(255,255,255,0.04) 18px, rgba(255,255,255,0.04) 19px)`,
          }}
        />
        <div
          className="relative z-10 text-7xl"
          style={{ filter: `drop-shadow(0 0 28px ${theme.accent})` }}
        >
          {theme.emoji}
        </div>
        <div className="relative z-10 text-center">
          <div className="font-oswald text-lg sm:text-2xl text-white uppercase tracking-wide leading-tight">
            {pack.name}
          </div>
          <div className="font-oswald text-sm mt-1" style={{ color: theme.accent }}>
            {pack.cardCount} карток
          </div>
        </div>
      </div>

      {/* Odds table */}
      <div
        className="px-4 py-3 border-t z-20 grid grid-cols-2 gap-x-4 gap-y-1"
        style={{ background: 'rgba(0,0,0,0.4)', borderColor: `${theme.border}55` }}
      >
        {pack.weights.common > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-oswald text-[10px] tracking-wider text-gray-500 uppercase">Звичайна</span>
            <span className="text-[10px] font-bold text-gray-400">{pack.weights.common}%</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-oswald text-[10px] tracking-wider text-blue-400 uppercase">Рідкісна</span>
          <span className="text-[10px] font-bold text-blue-400">{pack.weights.rare}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-oswald text-[10px] tracking-wider text-pink-400 uppercase">Епічна</span>
          <span className="text-[10px] font-bold text-pink-400">{pack.weights.epic}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-oswald text-[10px] tracking-wider text-yellow-400 uppercase">Легендарна</span>
          <span className="text-[10px] font-bold text-yellow-400">{pack.weights.legendary}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Card back design (shown before flip) ────────────────────────────────────
function CardBack({ packId }: { packId: string }) {
  const theme = getTheme(packId)
  return (
    <div
      className="w-full h-full rounded-2xl border-2 overflow-hidden flex flex-col"
      style={{
        background: theme.gradient,
        borderColor: theme.border,
        boxShadow: `0 0 24px ${theme.glowColor}`,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ background: 'rgba(0,0,0,0.3)', borderColor: `${theme.border}44` }}
      >
        <span className="font-oswald text-[10px] tracking-widest text-white/50 uppercase">HABITFC</span>
        <span className="text-xs">⚽</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 relative">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 12px, rgba(255,255,255,0.03) 12px, rgba(255,255,255,0.03) 13px)`,
          }}
        />
        <div
          className="relative z-10 text-5xl sm:text-6xl"
          style={{ filter: `drop-shadow(0 0 20px ${theme.accent})` }}
        >
          ⚽
        </div>
        <div
          className="relative z-10 font-oswald text-xs tracking-[0.3em] uppercase"
          style={{ color: theme.accent }}
        >
          {theme.label}
        </div>
      </div>

      <div
        className="px-3 py-2 border-t text-center"
        style={{ background: 'rgba(0,0,0,0.3)', borderColor: `${theme.border}44` }}
      >
        <div className="font-oswald text-[9px] tracking-widest text-white/30 uppercase">Картки Футболістів</div>
      </div>
    </div>
  )
}

// Responsive card dimensions — scale down on mobile via CSS clamp
// On 375 px screen: ~158 × 243 px; on 768 px+ clamped to 12 × 18.5 rem
const CARD_W = 'clamp(8rem, 42vw, 12rem)'
const CARD_H = 'clamp(12rem, 65vw, 18.5rem)'

// ─── Flip card (no slide — slide handled by parent slot) ─────────────────────
function FlipCard({
  footballer,
  flipped,
  refund,
  packId,
  onClick,
}: {
  footballer: Footballer
  flipped: boolean
  refund?: number
  packId: string
  onClick?: () => void
}) {
  return (
    <motion.div
      className="relative"
      style={{ perspective: 1050, WebkitPerspective: 1050, width: CARD_W, height: CARD_H, cursor: flipped ? 'default' : 'pointer' }}
      whileHover={!flipped ? { scale: 1.04 } : {}}
      transition={{ duration: 0.15 }}
      onClick={!flipped ? onClick : undefined}
    >
      {/* 3D flip wrapper — CSS transition instead of Framer Motion so Safari compositor handles backface-visibility correctly */}
      <div
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          width: CARD_W,
          height: CARD_H,
          transition: 'transform 0.65s cubic-bezier(0.645, 0.045, 0.355, 1.0)',
          WebkitTransition: '-webkit-transform 0.65s cubic-bezier(0.645, 0.045, 0.355, 1.0)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          WebkitTransform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
        }}
      >
        {/* Back face — hidden after flip via visibility (iOS Safari ignores backface-visibility) */}
        <div style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          position: 'absolute',
          inset: 0,
          visibility: flipped ? 'hidden' : 'visible',
          transition: 'visibility 0s 0.325s',
        }}>
          <CardBack packId={packId} />
        </div>

        {/* Front face — hidden before flip via visibility (iOS Safari ignores backface-visibility) */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            WebkitTransform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            borderRadius: '1rem',
            visibility: flipped ? 'visible' : 'hidden',
            transition: 'visibility 0s 0.325s',
          }}
        >
          <FootballerCard footballer={footballer} />
        </div>
      </div>

      {/* Tap to reveal hint */}
      <AnimatePresence>
        {!flipped && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-end pb-5 z-30 pointer-events-none"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="font-oswald text-[11px] tracking-[0.2em] uppercase text-white/60"
            >
              Натисніть
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate refund badge */}
      <AnimatePresence>
        {refund !== undefined && flipped && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: -10 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap z-20 shadow-lg"
          >
            +{refund} монет
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Deck (stacked face-down cards) ──────────────────────────────────────────
function Deck({ pack, remaining, nextIndex, onDeal }: {
  pack: Pack
  remaining: number
  nextIndex: number
  onDeal: () => void
}) {
  const shadowCount = Math.min(remaining - 1, 3)
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        className="relative cursor-pointer"
        style={{ width: CARD_W, height: CARD_H }}
        whileHover={{ y: -8 }}
        transition={{ duration: 0.18 }}
        onClick={onDeal}
      >
        {/* Shadow cards peeking below */}
        {Array.from({ length: shadowCount }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: (shadowCount - i) * 6,
            left: 0, right: 0,
            zIndex: i + 1,
            opacity: 0.6 + i * 0.1,
          }}>
            <CardBack packId={pack.id} />
          </div>
        ))}

        {/* Top card — key forces unmount/remount so layoutId animation fires every time */}
        <motion.div
          key={nextIndex}
          layoutId={`card-${nextIndex}`}
          style={{ position: 'relative', zIndex: shadowCount + 1, width: CARD_W, height: CARD_H }}
        >
          <CardBack packId={pack.id} />
        </motion.div>

        {/* Tap hint */}
        <motion.div
          className="absolute inset-0 flex items-end justify-center pb-5 pointer-events-none"
          style={{ zIndex: shadowCount + 2 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="font-oswald text-[11px] tracking-[0.2em] uppercase text-white/60">
            Натисніть
          </span>
        </motion.div>
      </motion.div>

      <div className="font-oswald text-xs tracking-[0.25em] text-white/40 uppercase">
        {remaining} {remaining === 1 ? 'картка' : remaining < 5 ? 'картки' : 'карток'}
      </div>
    </div>
  )
}

function normalizeState(raw: unknown): LocationState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (s.type === 'coach' && typeof s.coach === 'object' && s.coach !== null) {
    return { type: 'coach', coach: s.coach } as LocationState
  }
  if (s.pack && Array.isArray(s.cards)) {
    return {
      type: 'footballer',
      pack: s.pack,
      cards: s.cards,
      pityCounter: typeof s.pityCounter === 'number' ? s.pityCounter : 0,
      nextPityCounter: typeof s.nextPityCounter === 'number' ? s.nextPityCounter : 0,
    } as LocationState
  }
  return null
}

// ─── Coach pack opening component ────────────────────────────────────────────
function CoachPackOpening({ coach }: { coach: Coach }) {
  const navigate = useNavigate()
  const buyCoachPack = useAppStore(state => state.buyCoachPack)
  const pushPendingUnlock = useAppStore(state => state.pushPendingUnlock)
  const coins = useAppStore(state => state.coins)

  const [phase, setPhase] = useState<'confirm' | 'opening' | 'revealed'>('confirm')
  const [result, setResult] = useState<{ isLevelUp: boolean; newLevel: number; refundCoins: number } | null>(null)

  function handleOpen() {
    if (coins < coachPack.cost) { navigate('/shop'); return }
    setPhase('opening')
    playPackOpen()
    setTimeout(() => {
      const res = buyCoachPack(coach.id, coachPack.cost)
      setResult(res)
      for (const id of res.newUnlockIds) pushPendingUnlock(id)
      setTimeout(() => setPhase('revealed'), 300)
    }, 1000)
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-10 gap-6">
      <AnimatePresence mode="wait">
        {phase !== 'revealed' && (
          <motion.div
            key="confirm"
            className="flex flex-col items-center gap-6"
            exit={{ scale: 1.4, opacity: 0, y: -60, transition: { duration: 0.4 } }}
          >
            {/* Coach pack visual */}
            <motion.div
              animate={
                phase === 'opening'
                  ? { x: [0, -14, 14, -10, 10, -6, 6, 0], transition: { duration: 0.55 } }
                  : { y: [0, -8, 0], transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } }
              }
            >
              <div
                className="w-44 min-h-[17rem] rounded-2xl border-2 flex flex-col items-center justify-center gap-4 relative overflow-hidden"
                style={{
                  borderColor: '#FBBF24',
                  background: 'linear-gradient(155deg, #1a1200 0%, #0D0900 60%, #050300 100%)',
                  boxShadow: '0 0 60px rgba(251,191,36,0.4)',
                }}
              >
                <div className="text-7xl" style={{ filter: 'drop-shadow(0 0 28px #FBBF24)' }}>📋</div>
                <div className="text-center px-3">
                  <div className="font-oswald text-lg text-white uppercase tracking-wide">Тренерський Пакет</div>
                  <div className="font-oswald text-sm text-[#FBBF24] mt-1">1 тренер</div>
                </div>
              </div>
            </motion.div>

            {phase === 'confirm' && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-gray-400 text-sm flex items-center gap-2">
                  1 тренер за <span className="font-bold text-[#FBBF24] flex items-center gap-1"><CoinIcon size={16} />{coachPack.cost}</span>
                </p>
                <div className="flex gap-3">
                  <button onClick={() => navigate('/shop')} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer text-sm">
                    Скасувати
                  </button>
                  <button
                    onClick={handleOpen}
                    className="px-7 py-2.5 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer text-sm"
                    style={{ background: 'linear-gradient(135deg, #FBBF24, #D97706)', color: '#0D0900' }}
                  >
                    Відкрити! ✨
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {phase === 'revealed' && result && (
          <motion.div
            key="revealed"
            className="flex flex-col items-center gap-6 w-full max-w-xs"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center">
              <div className="font-oswald text-xs tracking-[0.25em] text-[#FBBF24] uppercase mb-1">
                {result.refundCoins > 0 ? '· Дублікат! ·' : result.isLevelUp ? '· Підвищення рівня! ·' : '· Новий тренер! ·'}
              </div>
              <h1 className="font-oswald text-3xl font-bold uppercase tracking-wide text-white">
                {coach.name}
              </h1>
            </div>

            <div style={{ width: '180px' }}>
              <CoachCard coach={coach} level={result.newLevel} />
            </div>

            {result.isLevelUp && (
              <div className="text-[#FBBF24] font-semibold text-sm bg-[#FBBF24]/10 border border-[#FBBF24]/30 px-4 py-2 rounded-xl">
                Перк підвищено до рівня {result.newLevel}!
              </div>
            )}
            {result.refundCoins > 0 && (
              <div className="text-yellow-400 font-semibold text-sm flex items-center gap-1">
                +{result.refundCoins} <CoinIcon size={16} /> (максимальний рівень)
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button onClick={() => navigate('/shop')} className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer">
                Магазин
              </button>
              <button onClick={() => navigate('/team')} className="flex-1 px-6 py-3 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer" style={{ background: 'linear-gradient(135deg, #FBBF24, #D97706)', color: '#0D0900' }}>
                До команди
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PackOpening() {
  const location = useLocation()
  const navigate = useNavigate()
  const buyPack = useAppStore(state => state.buyPack)
  const pushPendingUnlock = useAppStore(state => state.pushPendingUnlock)
  const collection = useAppStore(state => state.collection)
  const locationState = normalizeState(location.state)

  const [phase, setPhase] = useState<Phase>('confirm')
  const [revealed, setRevealed] = useState(0)
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const [totalRefund, setTotalRefund] = useState(0)
  const [cardRefunds, setCardRefunds] = useState<Record<number, number>>({})
  const pendingAchievements = useRef<string[]>([])

  if (!locationState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-400">Пакет не обрано.</p>
        <button
          onClick={() => navigate('/shop')}
          className="px-6 py-3 bg-blue-600 rounded-xl font-bold cursor-pointer"
        >
          До магазину
        </button>
      </div>
    )
  }

  if (locationState.type === 'coach') {
    return <CoachPackOpening coach={locationState.coach} />
  }

  const { pack, cards, pityCounter, nextPityCounter } = locationState
  const theme = getTheme(pack.id)

  function startOpening() {
    // Compute per-card refunds BEFORE purchase
    const perCardRefunds: Record<number, number> = {}
    const tempOwned: Record<string, number> = { ...collection }
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      if ((tempOwned[card.id] ?? 0) > 0) {
        perCardRefunds[i] = duplicateRefund(card.rarity)
      }
      tempOwned[card.id] = (tempOwned[card.id] ?? 0) + 1
    }
    setCardRefunds(perCardRefunds)

    const result = buyPack(pack.cost, cards, pack.id, nextPityCounter)
    setTotalRefund(result.refund)
    pendingAchievements.current = [...result.newUnlockIds]

    // Phase 1: shake the pack
    setPhase('opening')
    playPackOpen()

    // Phase 2: show the deck — user deals cards manually
    setTimeout(() => setPhase('revealing'), 1000)
  }

  function drainOneAchievement() {
    const id = pendingAchievements.current.shift()
    if (id) pushPendingUnlock(id)
  }

  function dealCard() {
    if (revealed >= cards.length) return
    const idx = revealed
    setRevealed(prev => prev + 1)
    playCardSlide()
    // Auto-flip after the layout animation lands
    setTimeout(() => {
      setFlipped(prev => {
        const next = new Set([...prev, idx])
        if (next.size === cards.length) setTimeout(() => setPhase('done'), 600)
        return next
      })
      playCardFlip(cards[idx].rarity)
      drainOneAchievement()
    }, 450)
  }

  function handleFlipCard(idx: number) {
    if (flipped.has(idx)) return
    const next = new Set([...flipped, idx])
    setFlipped(next)
    playCardFlip(cards[idx].rarity)
    drainOneAchievement()
    if (next.size === cards.length) {
      setTimeout(() => setPhase('done'), 600)
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 sm:py-10 gap-6 sm:gap-8 relative" style={{ overflow: 'clip' }}>

      {/* ── White flash — fixed, no layout impact ──────────────── */}
      <AnimatePresence>
        {phase === 'opening' && (
          <motion.div
            key="flash"
            className="fixed inset-0 pointer-events-none z-50"
            style={{ background: `radial-gradient(ellipse at center, ${theme.shimmer}, transparent 70%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1.0, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, times: [0, 0.6, 0.8, 1] }}
          />
        )}
      </AnimatePresence>

      {/* ── Main content: pack → cards, no simultaneous render ─── */}
      <AnimatePresence mode="wait">

        {/* Pack area (confirm + opening) */}
        {(phase === 'confirm' || phase === 'opening') && (
          <motion.div
            key="pack-area"
            className="flex flex-col items-center gap-6"
            exit={{ scale: 1.4, opacity: 0, y: -60, transition: { duration: 0.4, ease: 'easeIn' } }}
          >
            <motion.div
              animate={
                phase === 'opening'
                  ? {
                      x: [0, -14, 14, -10, 10, -6, 6, -3, 3, 0],
                      transition: { duration: 0.55, ease: 'easeInOut' },
                    }
                  : {
                      y: [0, -10, 0],
                      transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
                    }
              }
            >
              <PackVisual pack={pack} />
            </motion.div>

            <AnimatePresence>
              {phase === 'confirm' && (
                <motion.div
                  key="controls"
                  className="flex flex-col items-center gap-4"
                  exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
                >
                  <p className="text-gray-400 text-sm flex items-center gap-2">
                    {pack.cardCount} карток за{' '}
                    <span className="font-bold flex items-center gap-1" style={{ color: theme.accent }}>
                      <CoinIcon size={16} />
                      {pack.cost}
                    </span>
                  </p>

                  {/* Pity indicator */}
                  {(() => {
                    const effectiveLegendary = Math.min(
                      pack.weights.legendary + Math.max(0, pityCounter - PITY_THRESHOLD) * PITY_INCREMENT,
                      PITY_CAP,
                    )
                    const isPityActive = pityCounter > PITY_THRESHOLD
                    const maxBar = PITY_THRESHOLD + Math.ceil((PITY_CAP - pack.weights.legendary) / PITY_INCREMENT)
                    const barFill = Math.min(pityCounter / maxBar, 1)
                    return (
                      <div className="flex flex-col items-center gap-1.5 w-48">
                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isPityActive ? 'bg-yellow-400' : 'bg-gray-600'}`}
                            style={{ width: `${barFill * 100}%` }}
                          />
                        </div>
                        {isPityActive ? (
                          <div className="text-xs text-yellow-400 font-oswald tracking-wider">
                            🔥 Підвищений шанс: {effectiveLegendary}%
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 font-oswald tracking-wider">
                            Без легенди: {pityCounter} пакетів
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/shop')}
                      className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer transition-colors text-sm"
                    >
                      Скасувати
                    </button>
                    <button
                      onClick={startOpening}
                      className="px-7 py-2.5 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer text-sm transition-all hover:scale-105 hover:brightness-110 active:scale-95"
                      style={{
                        background: theme.gradient,
                        border: `2px solid ${theme.border}`,
                        color: 'white',
                        boxShadow: `0 0 20px ${theme.glowColor}`,
                      }}
                    >
                      Відкрити пакет! ✨
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Cards area (revealing + done) */}
        {(phase === 'revealing' || phase === 'done') && (
          <motion.div
            key="cards-area"
            className="flex flex-col items-center gap-5 sm:gap-8 w-full"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="text-center">
              <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
                {revealed < cards.length
                  ? `· ${cards.length - revealed} карток залишилось ·`
                  : flipped.size < cards.length
                  ? `· Відкрито ${flipped.size} / ${cards.length} ·`
                  : '· Всі картки відкрито ·'}
              </div>
              <h1 className="font-oswald text-xl sm:text-4xl font-bold uppercase tracking-wide text-white leading-none">
                {pack.name}
              </h1>
            </div>

            <LayoutGroup>
              {/* Deck — visible while cards remain */}
              <AnimatePresence>
                {revealed < cards.length && (
                  <motion.div
                    key="deck"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.25 } }}
                  >
                    <Deck
                      pack={pack}
                      remaining={cards.length - revealed}
                      nextIndex={revealed}
                      onDeal={dealCard}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Row of dealt cards — scrollable on mobile */}
              {revealed > 0 && (
                <div
                  className="flex flex-nowrap gap-2 sm:gap-3 py-4 w-full px-4 sm:justify-center overflow-x-auto hide-scrollbar"
                  style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
                >
                  {cards.slice(0, revealed).map((card, i) => (
                    <motion.div
                      key={i}
                      layoutId={`card-${i}`}
                      style={{ width: CARD_W, height: CARD_H, flexShrink: 0, scrollSnapAlign: 'center' }}
                    >
                      <FlipCard
                        footballer={card}
                        flipped={flipped.has(i)}
                        refund={cardRefunds[i]}
                        packId={pack.id}
                        onClick={() => handleFlipCard(i)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </LayoutGroup>

            {/* Done controls */}
            <AnimatePresence>
              {phase === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col items-center gap-4"
                >
                  {totalRefund > 0 && (
                    <motion.p
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-yellow-400 font-semibold text-sm sm:text-lg flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 px-4 py-2 rounded-xl"
                    >
                      Повернення за дублікати: +{totalRefund} <CoinIcon size={18} />
                    </motion.p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                    <button
                      onClick={() => navigate('/shop')}
                      className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      Назад до магазину
                    </button>
                    <button
                      onClick={() => navigate('/collection')}
                      className="px-6 py-3 bg-pink-600 hover:bg-pink-500 rounded-xl font-oswald font-bold uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      Переглянути колекцію
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
