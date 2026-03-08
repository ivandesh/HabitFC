import type { Footballer } from '../../types'

interface Props {
  footballer: Footballer
  owned?: number
  mini?: boolean
}

const rarityConfig = {
  common:    { border: 'border-gray-400',    bg: 'bg-gray-800',    glow: 'glow-common',    label: 'ЗВИЧАЙНА',  labelColor: 'text-gray-300' },
  rare:      { border: 'border-blue-400',    bg: 'bg-blue-950',    glow: 'glow-rare',      label: 'РІДКІСНА',  labelColor: 'text-blue-300' },
  epic:      { border: 'border-purple-400',  bg: 'bg-purple-950',  glow: 'glow-epic',      label: 'ЕПІЧНА',    labelColor: 'text-purple-300' },
  legendary: { border: 'border-yellow-300',  bg: 'bg-yellow-950',  glow: 'glow-legendary', label: 'ЛЕГЕНДАРНА', labelColor: 'text-yellow-300' },
}

export function FootballerCard({ footballer, owned, mini = false }: Props) {
  const cfg = rarityConfig[footballer.rarity]

  if (mini) {
    return (
      <div className={`relative border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} rounded-xl p-3 flex flex-col items-center gap-1 cursor-default transition-transform hover:scale-105`}>
        {footballer.photoUrl ? (
          <img
            src={footballer.photoUrl}
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
    <div className={`border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} rounded-2xl p-5 flex flex-col items-center gap-3 w-52`}>
      <div className={`text-xs font-bold tracking-widest ${cfg.labelColor}`}>{cfg.label}</div>
      {footballer.photoUrl ? (
        <img
          src={footballer.photoUrl}
          alt={footballer.name}
          className="w-24 h-24 object-contain rounded-full bg-black/30"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="text-7xl">{footballer.emoji}</div>
      )}
      <div className="text-center">
        <div className="font-bold text-lg leading-tight">{footballer.name}</div>
        <div className="text-sm text-gray-400">{footballer.club}</div>
        <div className="text-xs text-gray-500">{footballer.nationality}</div>
      </div>
      <div className="w-full grid grid-cols-2 gap-1 text-xs">
        <div className="flex justify-between bg-gray-900/50 rounded px-2 py-1">
          <span className="text-gray-500">PAC</span>
          <span className="font-bold">{footballer.stats.pace}</span>
        </div>
        <div className="flex justify-between bg-gray-900/50 rounded px-2 py-1">
          <span className="text-gray-500">SHO</span>
          <span className="font-bold">{footballer.stats.shooting}</span>
        </div>
        <div className="flex justify-between bg-gray-900/50 rounded px-2 py-1">
          <span className="text-gray-500">PAS</span>
          <span className="font-bold">{footballer.stats.passing}</span>
        </div>
        <div className="flex justify-between bg-gray-900/50 rounded px-2 py-1">
          <span className="text-gray-500">DRI</span>
          <span className="font-bold">{footballer.stats.dribbling}</span>
        </div>
      </div>
    </div>
  )
}
