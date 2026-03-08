import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { packs } from '../data/packs'
import { openPack } from '../lib/gacha'
import { PackCard } from '../components/cards/PackCard'
import { CoinDisplay } from '../components/ui/CoinDisplay'

export function Shop() {
  const coins = useAppStore(state => state.coins)
  const navigate = useNavigate()

  function handleBuy(packId: string) {
    const pack = packs.find(p => p.id === packId)
    if (!pack || coins < pack.cost) return
    const cards = openPack(pack)
    navigate('/open', { state: { pack, cards } })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Магазин карток</h1>
          <p className="text-gray-400 mt-1">Витрачай монети на пакети карток</p>
        </div>
        <CoinDisplay />
      </div>

      <div className="flex flex-wrap gap-6 justify-center">
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
