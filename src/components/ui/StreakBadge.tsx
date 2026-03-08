interface Props {
  streak: number
}

export function StreakBadge({ streak }: Props) {
  if (streak === 0) return null

  const color =
    streak >= 30 ? 'text-red-400 bg-red-400/10 border-red-400/30' :
    streak >= 7  ? 'text-orange-400 bg-orange-400/10 border-orange-400/30' :
    streak >= 3  ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' :
                   'text-gray-400 bg-gray-400/10 border-gray-400/30'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold border rounded-full px-2 py-0.5 ${color}`}>
      🔥 {streak}
    </span>
  )
}
