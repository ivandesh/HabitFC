import type { Coach } from '../../types'

const LEVEL_STARS = ['☆☆☆', '★☆☆', '★★☆', '★★★']

interface CoachCardProps {
  coach: Coach
  level?: number           // 0–3, default 0
  mini?: boolean           // compact grid card
  showPerk?: boolean       // show perk description (default true)
}

function CoachPhoto({ coach }: { coach: Coach }) {
  return coach.photoUrl ? (
    <img
      src={`${import.meta.env.BASE_URL}${coach.photoUrl.replace(/^\//, '')}`}
      alt={coach.name}
      className="w-full h-full object-cover object-top"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-3xl">{coach.emoji}</div>
  )
}

export function CoachCard({ coach, level = 0, mini = false, showPerk = true }: CoachCardProps) {
  const perkDesc = level > 0 ? coach.perk.descUA[level - 1] : coach.perk.descUA[0]

  if (mini) {
    return (
      <div className="border-2 border-[#FBBF24]/40 bg-[#0D0A00] rounded-xl p-2 flex flex-col items-center gap-1 select-none">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 ring-1 ring-[#FBBF24]/50">
          <CoachPhoto coach={coach} />
        </div>
        <div className="font-oswald text-[10px] font-bold text-white text-center leading-tight truncate w-full">
          {coach.name.split(' ').slice(-1)[0]}
        </div>
        <div className="text-[9px] font-oswald text-[#FBBF24] font-bold">
          {level > 0 ? LEVEL_STARS[level] : '🔒'}
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative rounded-2xl border-2 overflow-hidden flex flex-col select-none"
      style={{
        borderColor: '#FBBF24',
        background: 'linear-gradient(155deg, #1a1200 0%, #0D0900 60%, #050300 100%)',
        boxShadow: '0 0 30px rgba(251,191,36,0.25), 0 8px 24px rgba(0,0,0,0.5)',
        width: '100%',
        minHeight: '280px',
      }}
    >
      {/* Header band */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#FBBF24]/20 bg-black/30">
        <span className="font-oswald text-[10px] tracking-widest text-white/50 uppercase">⚽ HABITFC</span>
        <span className="font-oswald text-[10px] tracking-widest text-[#FBBF24] uppercase">ТРЕНЕР</span>
      </div>

      {/* Photo */}
      <div className="relative w-full" style={{ height: '140px' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0D0900]" style={{ zIndex: 1 }} />
        <div className="w-full h-full bg-black/20">
          <CoachPhoto coach={coach} />
        </div>
      </div>

      {/* Name + clubs */}
      <div className="px-3 pt-1 pb-2 flex-1 flex flex-col gap-1.5">
        <div>
          <div className="font-oswald font-bold text-white text-lg leading-tight uppercase tracking-wide">
            {coach.name}
          </div>
          <div className="text-[10px] text-[#5A7090] truncate">
            {coach.clubs.slice(0, 3).join(' · ') || coach.nationality}
          </div>
        </div>

        {showPerk && (
          <div className="mt-auto bg-[#FBBF24]/8 border border-[#FBBF24]/20 rounded-lg px-2.5 py-2">
            <div className="text-[9px] text-[#FBBF24]/60 uppercase tracking-wider font-oswald mb-0.5">Перк</div>
            <div className="text-[11px] text-white/90 leading-tight">{perkDesc}</div>
          </div>
        )}

        {/* Level stars */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[#FBBF24] text-sm tracking-widest">{LEVEL_STARS[level]}</span>
          {level > 0 && (
            <span className="font-oswald text-[10px] text-[#FBBF24]/60 uppercase">Рів. {level}</span>
          )}
        </div>
      </div>
    </div>
  )
}
