import { useAppStore } from '../../store/useAppStore'

export function CoinDisplay() {
  const coins = useAppStore(state => state.coins)
  return (
    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-2">
      <span className="text-xl">🪙</span>
      <span className="font-bold text-yellow-400 text-lg">{coins.toLocaleString()}</span>
    </div>
  )
}
