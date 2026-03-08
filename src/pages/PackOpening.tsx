import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Footballer, Pack } from '../types'
import { useAppStore } from '../store/useAppStore'
import { FootballerCard } from '../components/cards/FootballerCard'
import { CoinIcon } from '../components/ui/CoinIcon'

interface LocationState {
  pack: Pack
  cards: Footballer[]
}

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
      className="relative w-52 rounded-2xl border-2 overflow-hidden flex flex-col select-none"
      style={{
        background: theme.gradient,
        borderColor: theme.border,
        boxShadow: `0 0 60px ${theme.glowColor}, 0 20px 40px rgba(0,0,0,0.5)`,
        minHeight: '20rem',
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
          <div className="font-oswald text-2xl text-white uppercase tracking-wide leading-tight">
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
      className="w-52 h-80 rounded-2xl border-2 overflow-hidden flex flex-col"
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
          className="relative z-10 text-6xl"
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

// ─── Flip card (no slide — slide handled by parent slot) ─────────────────────
function FlipCard({
  footballer,
  flipped,
  refund,
  packId,
}: {
  footballer: Footballer
  flipped: boolean
  refund?: number
  packId: string
}) {
  return (
    <div className="relative" style={{ perspective: 1100, width: '13rem', height: '20rem' }}>
      {/* 3D flip wrapper */}
      <motion.div
        style={{ transformStyle: 'preserve-3d', width: '13rem', height: '20rem' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.65, ease: [0.645, 0.045, 0.355, 1.0] }}
      >
        {/* Back face */}
        <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>
          <CardBack packId={packId} />
        </div>

        {/* Front face */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            borderRadius: '1rem',
          }}
        >
          <FootballerCard footballer={footballer} />
        </div>
      </motion.div>

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
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PackOpening() {
  const location = useLocation()
  const navigate = useNavigate()
  const buyPack = useAppStore(state => state.buyPack)
  const collection = useAppStore(state => state.collection)
  const state = location.state as LocationState | null

  const [phase, setPhase] = useState<Phase>('confirm')
  const [revealed, setRevealed] = useState(0)
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const [totalRefund, setTotalRefund] = useState(0)
  const [cardRefunds, setCardRefunds] = useState<Record<number, number>>({})

  if (!state?.pack || !state?.cards) {
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

  const { pack, cards } = state
  const theme = getTheme(pack.id)

  function startOpening() {
    // Compute per-card refunds BEFORE purchase
    const perCardRefunds: Record<number, number> = {}
    const tempOwned: Record<string, number> = { ...collection }
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      if ((tempOwned[card.id] ?? 0) > 0) {
        const refundMap: Record<string, number> = { common: 5, rare: 15, epic: 40, legendary: 100 }
        perCardRefunds[i] = refundMap[card.rarity]
      }
      tempOwned[card.id] = (tempOwned[card.id] ?? 0) + 1
    }
    setCardRefunds(perCardRefunds)

    const result = buyPack(pack.cost, cards)
    setTotalRefund(result.refund)

    // Phase 1: shake the pack
    setPhase('opening')

    // Phase 2: after shake + burst, start sliding cards in
    setTimeout(() => {
      setPhase('revealing')

      let count = 0
      const interval = setInterval(() => {
        count++
        setRevealed(count)

        // Flip each card 700ms after it slides in
        const idx = count - 1
        setTimeout(() => {
          setFlipped(prev => new Set([...prev, idx]))
        }, 700)

        if (count >= cards.length) {
          clearInterval(interval)
          setTimeout(() => setPhase('done'), 1000)
        }
      }, 1400)
    }, 1000) // 1s for pack opening animation
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-10 gap-8 relative overflow-hidden">

      {/* ── Pack area (confirm + opening) ─────────────────────── */}
      <AnimatePresence>
        {(phase === 'confirm' || phase === 'opening') && (
          <motion.div
            key="pack-area"
            className="flex flex-col items-center gap-6"
            exit={{ scale: 1.4, opacity: 0, y: -60, transition: { duration: 0.45, ease: 'easeIn' } }}
          >
            {/* Floating idle / shake-on-open */}
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

            {/* Confirm controls */}
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
      </AnimatePresence>

      {/* ── White flash on opening ─────────────────────────────── */}
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

      {/* ── Revealed cards sliding in ──────────────────────────── */}
      {(phase === 'revealing' || phase === 'done') && (
        <>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
              · Відкриваємо ·
            </div>
            <h1 className="font-oswald text-3xl sm:text-4xl font-bold uppercase tracking-wide text-white leading-none">
              {pack.name}
            </h1>
          </motion.div>

          {/* Cards row — all slots pre-allocated to prevent layout jumps */}
          <div className="flex flex-wrap gap-5 justify-center max-w-5xl">
            {cards.map((card, i) => (
              <div key={i} style={{ width: '13rem', height: '20rem', position: 'relative' }}>
                {i < revealed && (
                  <motion.div
                    style={{ position: 'absolute', inset: 0 }}
                    initial={{ y: -320, opacity: 0, scale: 0.85 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                  >
                    <FlipCard
                      footballer={card}
                      flipped={flipped.has(i)}
                      refund={cardRefunds[i]}
                      packId={pack.id}
                    />
                  </motion.div>
                )}
              </div>
            ))}
          </div>

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
                    className="text-yellow-400 font-semibold text-lg flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 px-5 py-2 rounded-xl"
                  >
                    Повернення за дублікати: +{totalRefund} <CoinIcon size={18} />
                  </motion.p>
                )}
                <div className="flex gap-4">
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
        </>
      )}
    </div>
  )
}
