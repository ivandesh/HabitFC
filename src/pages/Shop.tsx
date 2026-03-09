import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { packs } from '../data/packs'
import { openPack } from '../lib/gacha'
import { PackCard } from '../components/cards/PackCard'
import { CoinDisplay } from '../components/ui/CoinDisplay'

export function Shop() {
  const coins = useAppStore(state => state.coins)
  const pityCounters = useAppStore(state => state.pityCounters)
  const navigate = useNavigate()

  function handleBuy(packId: string) {
    const pack = packs.find(p => p.id === packId)
    if (!pack || coins < pack.cost) return
    const pityCounter = pityCounters[pack.id] ?? 0
    const { cards, nextPityCounter } = openPack(pack, pityCounter)
    navigate('/open', { state: { pack, cards, nextPityCounter } })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-8">
      <div className="flex items-start justify-between gap-3 mb-6 sm:mb-10">
        <div className="min-w-0">
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · Придбай пакет ·
          </div>
          <h1 className="font-oswald text-2xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Магазин карток
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">Витрачай монети на пакети карток</p>
        </div>
        <CoinDisplay />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-5 justify-center items-stretch">
        {packs.map(pack => (
          <PackCard
            key={pack.id}
            pack={pack}
            canAfford={coins >= pack.cost}
            onBuy={() => handleBuy(pack.id)}
          />
        ))}
      </div>
    </div>
  )
}
