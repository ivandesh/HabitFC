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

export function PackOpening() {
  const location = useLocation()
  const navigate = useNavigate()
  const buyPack = useAppStore(state => state.buyPack)
  const collection = useAppStore(state => state.collection)
  const state = location.state as LocationState | null

  const [phase, setPhase] = useState<'confirm' | 'revealing' | 'done'>('confirm')
  const [revealed, setRevealed] = useState<number>(0)
  const [totalRefund, setTotalRefund] = useState(0)
  const [cardRefunds, setCardRefunds] = useState<Record<number, number>>({})

  if (!state?.pack || !state?.cards) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-400">Пакет не обрано.</p>
        <button onClick={() => navigate('/shop')} className="px-6 py-3 bg-blue-600 rounded-xl font-bold cursor-pointer">До магазину</button>
      </div>
    )
  }

  const { pack, cards } = state

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

    // Execute purchase
    const result = buyPack(pack.cost, cards)
    setTotalRefund(result.refund)
    setPhase('revealing')

    let count = 0
    const interval = setInterval(() => {
      count++
      setRevealed(count)
      if (count >= cards.length) {
        clearInterval(interval)
        setTimeout(() => setPhase('done'), 600)
      }
    }, 900)
  }

  if (phase === 'confirm') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-7xl">📦</div>
        <h1 className="text-3xl font-bold">{pack.name}</h1>
        <p className="text-gray-400 text-lg flex items-center gap-2">{pack.cardCount} карток за <span className="text-yellow-400 font-bold flex items-center gap-1"><CoinIcon size={18} />{pack.cost}</span></p>
        <div className="flex gap-4">
          <button onClick={() => navigate('/shop')} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold cursor-pointer">Скасувати</button>
          <button onClick={startOpening} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold cursor-pointer text-lg">Відкрити пакет!</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-8">
      <h1 className="text-2xl font-bold">Відкриваємо {pack.name}</h1>
      <div className="flex flex-wrap gap-4 justify-center max-w-4xl">
        {cards.map((card, i) => (
          <div key={i} className="relative">
            <AnimatePresence mode="wait">
              {i < revealed ? (
                <motion.div
                  key="card"
                  initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className="relative"
                >
                  <FootballerCard footballer={card} />
                  {cardRefunds[i] !== undefined && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: -20 }}
                      className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap z-10"
                    >
                      +{cardRefunds[i]} повернення
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  className="w-52 h-72 bg-gray-800 border-2 border-gray-600 rounded-2xl flex items-center justify-center"
                >
                  <span className="text-6xl">❓</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {phase === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          {totalRefund > 0 && (
            <p className="text-yellow-400 font-semibold text-lg flex items-center gap-2">Повернення за дублікати: +{totalRefund} <CoinIcon size={18} /></p>
          )}
          <div className="flex gap-4">
            <button onClick={() => navigate('/shop')} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold cursor-pointer">Назад до магазину</button>
            <button onClick={() => navigate('/collection')} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold cursor-pointer">Переглянути колекцію</button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
