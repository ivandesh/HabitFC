import { useAppStore } from '../../store/useAppStore'
import { CoinIcon } from './CoinIcon'

export function CoinDisplay() {
  const coins = useAppStore(state => state.coins)
  return (
    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1.5 shrink-0">
      <CoinIcon size={20} />
      <span className="font-bold text-yellow-400 text-base">{coins.toLocaleString()}</span>
    </div>
  )
}
