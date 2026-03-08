import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { footballers } from '../data/footballers'
import { FootballerCard } from '../components/cards/FootballerCard'
import { FootballerModal } from '../components/cards/FootballerModal'
import type { Rarity, Footballer } from '../types'
import { CoinDisplay } from '../components/ui/CoinDisplay'

const RARITIES: (Rarity | 'all')[] = ['all', 'legendary', 'epic', 'rare', 'common']

const lockedStyle: Record<Rarity, string> = {
  common:    'border-[#2A3441] bg-[#0A0F1A] glow-common',
  rare:      'border-blue-500/40 bg-[#050B1A] glow-rare',
  epic:      'border-pink-500/40 bg-[#140510] glow-epic',
  legendary: 'border-yellow-400/40 bg-[#0D0900] glow-legendary',
}

const lockedLabel: Record<Rarity, { text: string; color: string }> = {
  common:    { text: 'ЗВИЧАЙНА',   color: 'text-[#5A7090]' },
  rare:      { text: 'РІДКІСНА',   color: 'text-blue-400' },
  epic:      { text: 'ЕПІЧНА',     color: 'text-pink-400' },
  legendary: { text: 'ЛЕГЕНДАРНА', color: 'text-yellow-400' },
}

function LockedCard({ rarity }: { rarity: Rarity }) {
  const style = lockedStyle[rarity]
  const label = lockedLabel[rarity]
  return (
    <div className={`border-2 ${style} rounded-xl p-3 flex flex-col items-center gap-1 select-none`}>
      <div className="w-12 h-12 flex items-center justify-center text-2xl opacity-25">🔒</div>
      <div className="font-oswald text-xs font-bold text-[#2A3441]">???</div>
      <div className={`font-oswald text-[10px] font-bold tracking-wider ${label.color}`}>{label.text}</div>
    </div>
  )
}

const filterConfig: Record<string, { active: string; label: string }> = {
  all:       { active: 'bg-[#00E676] text-[#04060A]', label: 'Усі' },
  legendary: { active: 'bg-yellow-500 text-[#04060A]', label: 'Легендарна' },
  epic:      { active: 'bg-pink-600 text-white', label: 'Епічна' },
  rare:      { active: 'bg-blue-600 text-white', label: 'Рідкісна' },
  common:    { active: 'bg-[#3A4A5A] text-white', label: 'Звичайна' },
}

export function Collection() {
  const collection = useAppStore(state => state.collection)
  const [filter, setFilter] = useState<Rarity | 'all'>('all')
  const [selected, setSelected] = useState<Footballer | null>(null)

  const filtered = footballers.filter(f => filter === 'all' || f.rarity === filter)
  const ownedCount = Object.keys(collection).length
  const pct = Math.round((ownedCount / footballers.length) * 100)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · Твоя ·
          </div>
          <h1 className="font-oswald text-3xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Колекція
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">
            {ownedCount} / {footballers.length} карток · {pct}% завершено
          </p>
        </div>
        <CoinDisplay />
      </div>

      <div className="w-full h-2 bg-[#1A2336] rounded-full overflow-hidden mb-7">
        <div
          className="h-full rounded-full transition-all duration-500 glow-green"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #0EA5E9, #00E676, #FBBF24)',
          }}
        />
      </div>

      <div className="flex gap-2 mb-7 flex-wrap">
        {RARITIES.map(r => {
          const cfg = filterConfig[r]
          return (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-4 py-2 rounded-xl font-oswald font-semibold uppercase tracking-wider text-xs transition-all cursor-pointer ${
                filter === r
                  ? cfg.active
                  : 'bg-[#0A0F1A] border border-[#1A2336] text-[#5A7090] hover:border-[#2A3A50] hover:text-[#E8F0FF]'
              }`}
            >
              {cfg.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {filtered.map(f => {
          const owned = collection[f.id] ?? 0
          return owned > 0 ? (
            <div key={f.id} className="cursor-pointer" onClick={() => setSelected(f)}>
              <FootballerCard footballer={f} owned={owned} mini />
            </div>
          ) : (
            <div key={f.id}>
              <LockedCard rarity={f.rarity} />
            </div>
          )
        })}
      </div>

      {selected && (
        <FootballerModal
          footballer={selected}
          owned={collection[selected.id] ?? 0}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
