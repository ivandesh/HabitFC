import { useAppStore } from '../../store/useAppStore'
import { CoinIcon } from './CoinIcon'

export function CoinDisplay() {
  const coins = useAppStore(state => state.coins)
  return (
    <div className="flex items-center gap-2 bg-[#0D0900] border border-yellow-400/30 rounded-full px-4 py-2 shrink-0">
      <CoinIcon size={20} />
      <span className="font-oswald font-bold text-yellow-400 text-base tracking-wider">
        {coins.toLocaleString()}
      </span>
    </div>
  )
}
