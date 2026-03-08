import { motion, AnimatePresence } from 'framer-motion'
import type { Footballer } from '../../types'

interface Props {
  footballer: Footballer
  owned: number
  onClose: () => void
}

const rarityConfig = {
  common:    { border: 'border-gray-400',   bg: 'bg-gray-900',    glow: 'glow-common',    label: 'ЗВИЧАЙНА',   labelColor: 'text-gray-300',   bar: 'bg-gray-400' },
  rare:      { border: 'border-blue-400',   bg: 'bg-blue-950',    glow: 'glow-rare',      label: 'РІДКІСНА',   labelColor: 'text-blue-300',   bar: 'bg-blue-400' },
  epic:      { border: 'border-purple-400', bg: 'bg-purple-950',  glow: 'glow-epic',      label: 'ЕПІЧНА',     labelColor: 'text-purple-300', bar: 'bg-purple-400' },
  legendary: { border: 'border-yellow-300', bg: 'bg-yellow-950',  glow: 'glow-legendary', label: 'ЛЕГЕНДАРНА', labelColor: 'text-yellow-300', bar: 'bg-yellow-400' },
}

const statLabels: Record<string, string> = {
  pace: 'Швидкість',
  shooting: 'Удар',
  passing: 'Пас',
  dribbling: 'Дриблінг',
}

function StatBar({ label, value, barColor }: { label: string; value: number; barColor: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-400 text-sm w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-white font-bold text-sm w-8 text-right">{value}</span>
    </div>
  )
}

export function FootballerModal({ footballer, owned, onClose }: Props) {
  const cfg = rarityConfig[footballer.rarity]
  const stats = footballer.stats

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={`relative border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} rounded-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4`}
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.4 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors cursor-pointer text-lg leading-none"
          >
            ✕
          </button>

          <div className={`text-xs font-bold tracking-widest ${cfg.labelColor}`}>{cfg.label}</div>

          {footballer.photoUrl ? (
            <img
              src={footballer.photoUrl}
              alt={footballer.name}
              className="w-36 h-36 object-contain rounded-full bg-black/30"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="text-8xl">{footballer.emoji}</div>
          )}

          <div className="text-center">
            <div className="font-bold text-2xl">{footballer.name}</div>
            <div className="text-gray-400 mt-1">{footballer.club}</div>
            <div className="text-gray-500 text-sm">{footballer.nationality}</div>
          </div>

          {owned > 0 && (
            <div className="text-sm text-gray-400">
              У колекції: <span className="text-white font-bold">{owned}x</span>
            </div>
          )}

          <div className="w-full space-y-2 pt-2 border-t border-white/10">
            {Object.entries(stats).map(([key, val]) => (
              <StatBar key={key} label={statLabels[key] ?? key} value={val} barColor={cfg.bar} />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
