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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Трекер Звичок</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">Виконуй звички, заробляй монети та збирай картки</p>
        </div>
        <CoinDisplay />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Прогрес Колекції</span>
          <span className="text-sm font-bold text-purple-400">{owned}/{total} ({pct}%)</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <HabitList />
    </div>
  )
}
