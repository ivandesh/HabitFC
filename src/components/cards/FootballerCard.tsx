import type { Footballer, Position } from '../../types'
import { rarityConfig } from '../../lib/rarityConfig'

const POS_UA: Record<Position, string> = { GK: 'ВОР', DEF: 'ЗАХ', MID: 'ПЗА', FWD: 'НАП' }

interface Props {
  footballer: Footballer
  owned?: number
  mini?: boolean
}

export function FootballerCard({ footballer, owned, mini = false }: Props) {
  const cfg = rarityConfig[footballer.rarity]

  if (mini) {
    return (
      <div className={`relative border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} rounded-xl p-3 flex flex-col items-center gap-1 cursor-default transition-transform hover:scale-105`}>
        {footballer.photoUrl ? (
          <img
            src={`${import.meta.env.BASE_URL}${footballer.photoUrl.replace(/^\//, '')}`}
            alt={footballer.name}
            className="w-12 h-12 object-contain rounded-full bg-black/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="text-4xl">{footballer.emoji}</div>
        )}
        <div className="text-xs font-bold text-center leading-tight">{footballer.name}</div>
        <div className={`text-xs font-bold ${cfg.labelColor}`}>{cfg.label}</div>
        {owned !== undefined && owned > 1 && (
          <div className="absolute top-1 right-1 bg-gray-700 text-gray-300 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {owned}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} rounded-2xl p-2 sm:p-4 flex flex-col items-center gap-1 sm:gap-2 w-full h-full`}>
      <div className={`text-xs font-bold tracking-widest ${cfg.labelColor}`}>{cfg.label}</div>
      {footballer.photoUrl ? (
        <img
          src={`${import.meta.env.BASE_URL}${footballer.photoUrl.replace(/^\//, '')}`}
          alt={footballer.name}
          className="w-14 h-14 sm:w-20 sm:h-20 object-contain rounded-full bg-black/30"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="text-4xl sm:text-6xl">{footballer.emoji}</div>
      )}
      <div className="text-center">
        <div className="font-bold text-sm sm:text-lg leading-tight">{footballer.name}</div>
        <div className="text-xs sm:text-sm text-gray-400">{footballer.club}</div>
        <div className="text-[10px] sm:text-xs text-gray-500">{footballer.nationality}</div>
        <div className="text-[10px] sm:text-xs font-oswald font-bold text-gray-400 mt-0.5">{POS_UA[footballer.position]}</div>
      </div>
      <div className="w-full grid grid-cols-2 gap-1 text-xs">
        <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
          <span className="text-gray-500">PAC</span>
          <span className="font-bold">{footballer.stats.pace}</span>
        </div>
        <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
          <span className="text-gray-500">SHO</span>
          <span className="font-bold">{footballer.stats.shooting}</span>
        </div>
        <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
          <span className="text-gray-500">PAS</span>
          <span className="font-bold">{footballer.stats.passing}</span>
        </div>
        <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
          <span className="text-gray-500">DRI</span>
          <span className="font-bold">{footballer.stats.dribbling}</span>
        </div>
      </div>
    </div>
  )
}
