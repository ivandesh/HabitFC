import type { Pack } from '../../types'
import { CoinIcon } from '../ui/CoinIcon'

interface Props {
  pack: Pack
  onBuy: () => void
  canAfford: boolean
}

const packConfig = {
  basic:   { emoji: '📦', color: 'border-gray-500 bg-gray-800/50',    buttonColor: 'bg-gray-600 hover:bg-gray-500' },
  premium: { emoji: '🎁', color: 'border-blue-500 bg-blue-950/50',    buttonColor: 'bg-blue-600 hover:bg-blue-500' },
  elite:   { emoji: '👑', color: 'border-yellow-400 bg-yellow-950/50', buttonColor: 'bg-yellow-600 hover:bg-yellow-500' },
}

export function PackCard({ pack, onBuy, canAfford }: Props) {
  const cfg = packConfig[pack.id as keyof typeof packConfig] ?? packConfig.basic

  return (
    <div className={`border-2 ${cfg.color} rounded-2xl p-6 flex flex-col items-center gap-4 w-full sm:w-64`}>
      <div className="text-6xl">{cfg.emoji}</div>
      <div className="text-center">
        <div className="font-bold text-xl">{pack.name}</div>
        <div className="text-gray-400 text-sm mt-1">{pack.cardCount} карток у пакеті</div>
      </div>
      <div className="w-full text-sm text-gray-400 space-y-1">
        {pack.weights.common > 0 && <div className="flex justify-between"><span>Звичайна</span><span>{pack.weights.common}%</span></div>}
        <div className="flex justify-between"><span className="text-blue-400">Рідкісна</span><span>{pack.weights.rare}%</span></div>
        <div className="flex justify-between"><span className="text-purple-400">Епічна</span><span>{pack.weights.epic}%</span></div>
        <div className="flex justify-between"><span className="text-yellow-400">Легендарна</span><span>{pack.weights.legendary}%</span></div>
      </div>
      <button
        onClick={onBuy}
        disabled={!canAfford}
        className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${canAfford ? cfg.buttonColor + ' cursor-pointer' : 'bg-gray-700 opacity-50 cursor-not-allowed'}`}
      >
        <CoinIcon size={18} /> {pack.cost} монет
      </button>
    </div>
  )
}
