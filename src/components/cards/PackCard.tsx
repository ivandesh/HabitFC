import type { Pack } from '../../types'
import { CoinIcon } from '../ui/CoinIcon'

interface Props {
  pack: Pack
  onBuy: () => void
  canAfford: boolean
}

const packConfig = {
  basic: {
    emoji: '📦',
    label: 'БАЗОВИЙ',
    border: 'border-[#2D3748]',
    bg: 'bg-[#0D1118]',
    accent: '#64748B',
    accentDim: 'rgba(100,116,139,0.08)',
    buttonBg: 'bg-[#1E2A38] hover:bg-[#2D3D54]',
    buttonText: 'text-[#94A3B8]',
    labelColor: 'text-[#64748B]',
  },
  premium: {
    emoji: '🎁',
    label: 'ПРЕМІУМ',
    border: 'border-blue-500/40',
    bg: 'bg-[#050B1A]',
    accent: '#3B82F6',
    accentDim: 'rgba(59,130,246,0.08)',
    buttonBg: 'bg-blue-700 hover:bg-blue-600',
    buttonText: 'text-white',
    labelColor: 'text-blue-400',
  },
  elite: {
    emoji: '👑',
    label: 'ЕЛІТ',
    border: 'border-yellow-400/50',
    bg: 'bg-[#0D0900]',
    accent: '#FBBF24',
    accentDim: 'rgba(251,191,36,0.07)',
    buttonBg: 'bg-amber-600 hover:bg-amber-500',
    buttonText: 'text-white',
    labelColor: 'text-yellow-400',
  },
}

export function PackCard({ pack, onBuy, canAfford }: Props) {
  const cfg = packConfig[pack.id as keyof typeof packConfig] ?? packConfig.basic

  return (
    <div
      className={`border-2 ${cfg.border} ${cfg.bg} rounded-2xl flex flex-col w-full sm:w-64 overflow-hidden`}
    >
      {/* Header band */}
      <div
        className="px-6 pt-6 pb-4 text-center"
        style={{ background: cfg.accentDim }}
      >
        <div className="text-6xl mb-3">{cfg.emoji}</div>
        <div
          className={`font-oswald text-xs tracking-[0.3em] uppercase mb-1 ${cfg.labelColor}`}
        >
          {cfg.label}
        </div>
        <div className="font-oswald font-bold text-xl text-white uppercase tracking-wide">
          {pack.name}
        </div>
        <div className="text-[#5A7090] text-xs mt-1">{pack.cardCount} карток у пакеті</div>
      </div>

      {/* Odds table */}
      <div className="px-5 py-4 space-y-1.5 border-t border-[#1A2336] flex-1">
        {pack.weights.common > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="font-oswald uppercase tracking-wider text-[#5A7090]">Звичайна</span>
            <span className="font-bold text-[#5A7090]">{pack.weights.common}%</span>
          </div>
        )}
        <div className="flex justify-between items-center text-xs">
          <span className="font-oswald uppercase tracking-wider text-blue-400">Рідкісна</span>
          <span className="font-bold text-blue-400">{pack.weights.rare}%</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-oswald uppercase tracking-wider text-pink-400">Епічна</span>
          <span className="font-bold text-pink-400">{pack.weights.epic}%</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-oswald uppercase tracking-wider text-yellow-400">Легендарна</span>
          <span className="font-bold text-yellow-400">{pack.weights.legendary}%</span>
        </div>
      </div>

      {/* Buy button */}
      <div className="px-5 pb-5">
        <button
          onClick={onBuy}
          disabled={!canAfford}
          className={`w-full py-3 rounded-xl font-oswald font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 ${
            canAfford
              ? `${cfg.buttonBg} ${cfg.buttonText} cursor-pointer`
              : 'bg-[#1A2336] text-[#3A4A5A] opacity-60 cursor-not-allowed'
          }`}
        >
          <CoinIcon size={18} /> {pack.cost} монет
        </button>
        {!canAfford && (
          <div className="text-center text-xs text-[#3A4A5A] mt-2">Недостатньо монет</div>
        )}
      </div>
    </div>
  )
}
