import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { footballers } from '../data/footballers'
import { FootballerCard } from '../components/cards/FootballerCard'
import { FootballerModal } from '../components/cards/FootballerModal'
import type { Rarity, Footballer } from '../types'
import { CoinDisplay } from '../components/ui/CoinDisplay'

const RARITIES: (Rarity | 'all')[] = ['all', 'legendary', 'epic', 'rare', 'common']

const lockedStyle: Record<Rarity, string> = {
  common:    'border-gray-500 bg-gray-900 glow-common',
  rare:      'border-blue-500 bg-blue-950 glow-rare',
  epic:      'border-purple-500 bg-purple-950 glow-epic',
  legendary: 'border-yellow-400 bg-yellow-950 glow-legendary',
}

const lockedLabel: Record<Rarity, { text: string; color: string }> = {
  common:    { text: 'ЗВИЧАЙНА',   color: 'text-gray-400' },
  rare:      { text: 'РІДКІСНА',   color: 'text-blue-400' },
  epic:      { text: 'ЕПІЧНА',     color: 'text-purple-400' },
  legendary: { text: 'ЛЕГЕНДАРНА', color: 'text-yellow-400' },
}

function LockedCard({ rarity }: { rarity: Rarity }) {
  const style = lockedStyle[rarity]
  const label = lockedLabel[rarity]
  return (
    <div className={`border-2 ${style} rounded-xl p-3 flex flex-col items-center gap-1 select-none`}>
      <div className="w-12 h-12 flex items-center justify-center text-2xl opacity-40">🔒</div>
      <div className="text-xs font-bold text-gray-600">???</div>
      <div className={`text-xs font-bold ${label.color}`}>{label.text}</div>
    </div>
  )
}

export function Collection() {
  const collection = useAppStore(state => state.collection)
  const [filter, setFilter] = useState<Rarity | 'all'>('all')
  const [selected, setSelected] = useState<Footballer | null>(null)

  const filtered = footballers.filter(f => filter === 'all' || f.rarity === filter)
  const ownedCount = Object.keys(collection).length
  const pct = Math.round((ownedCount / footballers.length) * 100)

  const filterColors: Record<string, string> = {
    all: 'bg-gray-700',
    legendary: 'bg-yellow-600',
    epic: 'bg-purple-600',
    rare: 'bg-blue-600',
    common: 'bg-gray-600',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Моя Колекція</h1>
          <p className="text-gray-400 mt-1 text-sm">{ownedCount}/{footballers.length} карток ({pct}% завершено)</p>
        </div>
        <CoinDisplay />
      </div>

      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-gradient-to-r from-purple-600 to-yellow-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {RARITIES.map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-4 py-2 rounded-xl font-semibold capitalize transition-all cursor-pointer ${filter === r ? filterColors[r] + ' text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {r === 'all' ? 'Усі' : r}
          </button>
        ))}
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
