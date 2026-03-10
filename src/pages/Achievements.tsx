import { useState, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ACHIEVEMENTS } from '../lib/achievements'
import { CoinDisplay } from '../components/ui/CoinDisplay'
import type { AppState } from '../types'

type Category = 'all' | 'habits' | 'collection' | 'team' | 'memes'

const TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'habits', label: 'Звички' },
  { key: 'collection', label: 'Колекція' },
  { key: 'team', label: 'Команда' },
  { key: 'memes', label: 'Меми' },
]

export function Achievements() {
  const achievements = useAppStore(state => state.achievements)
  const totalCompletions = useAppStore(state => state.totalCompletions)
  const collection = useAppStore(state => state.collection)
  const squad = useAppStore(state => state.squad)
  const coachCollection = useAppStore(state => state.coachCollection)
  const assignedCoach = useAppStore(state => state.assignedCoach)
  const progressState = useMemo(
    () => ({ achievements, totalCompletions, collection, squad, coachCollection, assignedCoach } as AppState),
    [achievements, totalCompletions, collection, squad, coachCollection, assignedCoach]
  )
  const [tab, setTab] = useState<Category>('all')

  const filtered = ACHIEVEMENTS.filter(a => tab === 'all' || a.category === tab)
  const totalUnlocked = Object.keys(achievements).length
  const total = ACHIEVEMENTS.length

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · Досягнення ·
          </div>
          <h1 className="font-oswald text-2xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Трофеї
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">
            {totalUnlocked} / {total} розблоковано
          </p>
        </div>
        <CoinDisplay />
      </div>

      {/* Overall progress bar */}
      <div className="w-full h-2 bg-[#1A2336] rounded-full overflow-hidden mb-6">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.round((totalUnlocked / total) * 100)}%`,
            background: 'linear-gradient(90deg, #0EA5E9, #00E676)',
          }}
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-5 sm:mb-6 bg-[#0A0F1A] border border-[#1A2336] rounded-xl p-1 overflow-x-auto hide-scrollbar">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg font-oswald font-bold text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? 'bg-[#00E676] text-[#04060A]'
                : 'text-[#5A7090] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(a => {
          const unlocked = !!achievements[a.id]
          const progress = a.progressFn?.(progressState)

          return (
            <div
              key={a.id}
              className={`flex items-center gap-4 rounded-2xl border px-4 py-4 transition-all ${
                unlocked
                  ? 'bg-[#0A1A12] border-[#00E676]/30'
                  : 'bg-[#0A0F1A] border-[#1A2336]'
              }`}
            >
              <div className={`text-3xl shrink-0 ${!unlocked ? 'grayscale opacity-50' : ''}`}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-oswald font-bold text-sm ${unlocked ? 'text-white' : 'text-[#7A8A9A]'}`}>
                  {a.titleUA}
                </div>
                <div className={`text-xs mt-0.5 ${unlocked ? 'text-[#5A7090]' : 'text-[#4A5A6A]'}`}>
                  {unlocked ? a.descUA : '???'}
                </div>
                {progress && !unlocked && (
                  <div className="mt-2">
                    <div className="text-[10px] text-[#5A7090] mb-1">
                      {progress.current} / {progress.total}
                    </div>
                    <div className="w-full h-1.5 bg-[#1A2336] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#00E676]/60"
                        style={{ width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
                {unlocked && achievements[a.id] && (
                  <div className="text-[10px] text-[#00E676]/60 mt-1">
                    {new Date(achievements[a.id].unlockedAt).toLocaleDateString('uk-UA')}
                  </div>
                )}
              </div>
              {unlocked && (
                <div className="shrink-0 w-6 h-6 rounded-full bg-[#00E676]/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#00E676]" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
