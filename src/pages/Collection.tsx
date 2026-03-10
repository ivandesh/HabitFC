import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { footballers } from '../data/footballers'
import { coaches } from '../data/coaches'
import { FootballerCard } from '../components/cards/FootballerCard'
import { FootballerModal } from '../components/cards/FootballerModal'
import { CoachCard } from '../components/cards/CoachCard'
import { getCoachLevel } from '../lib/coachPerks'
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
  const coachCollection = useAppStore(state => state.coachCollection)
  const [tab, setTab] = useState<'players' | 'coaches'>('players')
  const [filter, setFilter] = useState<Rarity | 'all'>('all')
  const [selected, setSelected] = useState<Footballer | null>(null)

  const filtered = footballers.filter(f => filter === 'all' || f.rarity === filter)
  const ownedCount = Object.keys(collection).length
  const pct = Math.round((ownedCount / footballers.length) * 100)
  const ownedCoachCount = Object.keys(coachCollection).filter(id => (coachCollection[id] ?? 0) > 0).length

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 sm:py-8">
      <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
        <div className="min-w-0">
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · Твоя ·
          </div>
          <h1 className="font-oswald text-2xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Колекція
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">
            {ownedCount} / {footballers.length} карток · {pct}% завершено
          </p>
        </div>
        <CoinDisplay />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5 bg-[#0A0F1A] border border-[#1A2336] rounded-xl p-1">
        <button
          onClick={() => setTab('players')}
          className={`flex-1 py-2 rounded-lg font-oswald font-bold text-xs tracking-wider transition-all cursor-pointer ${tab === 'players' ? 'bg-[#00E676] text-[#04060A]' : 'text-[#5A7090] hover:text-white'}`}
        >
          Гравці ({ownedCount}/{footballers.length})
        </button>
        <button
          onClick={() => setTab('coaches')}
          className={`flex-1 py-2 rounded-lg font-oswald font-bold text-xs tracking-wider transition-all cursor-pointer ${tab === 'coaches' ? 'bg-[#FBBF24] text-[#0D0900]' : 'text-[#5A7090] hover:text-white'}`}
        >
          Тренери ({ownedCoachCount}/{coaches.length})
        </button>
      </div>

      {tab === 'players' && (
        <>
          <div className="w-full h-2 bg-[#1A2336] rounded-full overflow-hidden mb-5 sm:mb-7">
            <div
              className="h-full rounded-full transition-all duration-500 glow-green"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #0EA5E9, #00E676, #FBBF24)',
              }}
            />
          </div>

          <div className="flex gap-2 mb-5 sm:mb-7 flex-wrap">
            {RARITIES.map(r => {
              const cfg = filterConfig[r]
              return (
                <button
                  key={r}
                  onClick={() => setFilter(r)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-oswald font-semibold uppercase tracking-wider text-xs transition-all cursor-pointer ${
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
        </>
      )}

      {tab === 'coaches' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {coaches.map(c => {
            const owned = (coachCollection[c.id] ?? 0) > 0
            const level = getCoachLevel(c.id, coachCollection)
            return owned ? (
              <div key={c.id}>
                <CoachCard coach={c} level={level} showPerk />
              </div>
            ) : (
              <div key={c.id} className="border-2 border-[#FBBF24]/15 bg-[#0A0800] rounded-xl p-2 flex flex-col items-center gap-1 select-none min-h-[120px] justify-center">
                <div className="text-3xl opacity-20">📋</div>
                <div className="font-oswald text-xs font-bold text-[#2A3441]">???</div>
                <div className="font-oswald text-[10px] font-bold tracking-wider text-[#FBBF24]/30">ТРЕНЕР</div>
              </div>
            )
          })}
        </div>
      )}

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
