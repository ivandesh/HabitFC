import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { packs } from '../data/packs'
import { openPack } from '../lib/gacha'
import { PackCard } from '../components/cards/PackCard'
import { CoinDisplay } from '../components/ui/CoinDisplay'
import { coaches } from '../data/coaches'
import { coachPack } from '../data/coachPack'
import { CoinIcon } from '../components/ui/CoinIcon'

export function Shop() {
  const coins = useAppStore(state => state.coins)
  const pityCounters = useAppStore(state => state.pityCounters)
  const navigate = useNavigate()

  function handleBuyCoachPack() {
    if (coins < coachPack.cost) return
    const coach = coaches[Math.floor(Math.random() * coaches.length)]
    navigate('/open', { state: { type: 'coach', coach } })
  }

  function handleBuy(packId: string) {
    const pack = packs.find(p => p.id === packId)
    if (!pack || coins < pack.cost) return
    const pityCounter = pityCounters[pack.id] ?? 0
    const { cards, nextPityCounter } = openPack(pack, pityCounter)
    navigate('/open', { state: { pack, cards, pityCounter, nextPityCounter } })
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

      {/* Coach pack section */}
      <div className="mt-8 sm:mt-10">
        <div className="font-oswald text-xs tracking-[0.25em] text-[#FBBF24] uppercase mb-3">
          · Тренери ·
        </div>
        <div className="flex justify-center">
          <div
            className="relative rounded-2xl border-2 overflow-hidden p-5 flex flex-col items-center gap-4 max-w-xs w-full"
            style={{
              borderColor: '#FBBF24',
              background: 'linear-gradient(155deg, #1a1200 0%, #0D0900 70%, #050300 100%)',
              boxShadow: '0 0 40px rgba(251,191,36,0.2)',
            }}
          >
            <div className="text-6xl" style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.6))' }}>
              {coachPack.emoji}
            </div>
            <div className="text-center">
              <div className="font-oswald text-xl font-bold text-white uppercase tracking-wide">
                {coachPack.name}
              </div>
              <div className="text-[#FBBF24]/70 text-sm mt-1">1 тренер · унікальний перк</div>
              <div className="text-xs text-[#5A7090] mt-0.5">Дублікат = підвищення рівня перку</div>
            </div>
            <div className="flex items-center gap-1.5 text-lg font-oswald font-bold text-[#FBBF24]">
              <CoinIcon size={20} />
              {coachPack.cost}
            </div>
            <button
              onClick={handleBuyCoachPack}
              disabled={coins < coachPack.cost}
              className={`w-full py-3 rounded-xl font-oswald font-bold uppercase tracking-wider text-sm transition-all ${
                coins >= coachPack.cost
                  ? 'cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: 'linear-gradient(135deg, #FBBF24, #D97706)',
                color: '#0D0900',
              }}
            >
              {coins >= coachPack.cost ? 'Купити тренера' : 'Недостатньо монет'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
