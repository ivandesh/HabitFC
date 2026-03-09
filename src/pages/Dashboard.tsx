import { CoinDisplay } from '../components/ui/CoinDisplay'
import { HabitList } from '../components/habits/HabitList'
import { useAppStore } from '../store/useAppStore'
import { footballers } from '../data/footballers'

export function Dashboard() {
  const collection = useAppStore(state => state.collection)
  const owned = Object.keys(collection).length
  const total = footballers.length
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-8 space-y-5 sm:space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · Панель керування ·
          </div>
          <h1 className="font-oswald text-2xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Трекер Звичок
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">
            Виконуй звички, заробляй монети та збирай картки
          </p>
        </div>
        <CoinDisplay />
      </div>

      <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-oswald text-xs tracking-[0.2em] text-[#5A7090] uppercase">
            Прогрес Колекції
          </span>
          <span className="font-oswald font-bold text-[#00E676] text-sm">
            {owned} / {total} · {pct}%
          </span>
        </div>
        <div className="w-full h-2 bg-[#1A2336] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 glow-green"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #0EA5E9, #00E676)',
            }}
          />
        </div>
      </div>

      <HabitList />
    </div>
  )
}
