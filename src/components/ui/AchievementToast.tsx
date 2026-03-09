import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { ACHIEVEMENTS } from '../../lib/achievements'
import { playAchievementUnlock } from '../../lib/sounds'

export function AchievementToastManager() {
  const drainPendingUnlock = useAppStore(state => state.drainPendingUnlock)
  const [current, setCurrent] = useState<{ id: string; titleUA: string; icon: string } | null>(null)
  const [queue, setQueue] = useState<string[]>([])

  // Drain store into local queue every 300ms
  useEffect(() => {
    const interval = setInterval(() => {
      const id = drainPendingUnlock()
      if (id) setQueue(q => [...q, id])
    }, 300)
    return () => clearInterval(interval)
  }, [drainPendingUnlock])

  // Show next from queue when idle
  useEffect(() => {
    if (current || queue.length === 0) return
    const [next, ...rest] = queue
    setQueue(rest)
    const def = ACHIEVEMENTS.find(a => a.id === next)
    if (!def) return
    setCurrent({ id: next, titleUA: def.titleUA, icon: def.icon })
    playAchievementUnlock()
    setTimeout(() => setCurrent(null), 4000)
  }, [current, queue])

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-[#0D1520] border border-[#00E676]/40 rounded-2xl px-4 py-3 shadow-2xl max-w-xs"
        >
          <div className="text-2xl shrink-0">{current.icon}</div>
          <div>
            <div className="text-[10px] text-[#00E676] uppercase tracking-widest font-oswald">
              Досягнення розблоковано!
            </div>
            <div className="font-oswald font-bold text-white text-sm">{current.titleUA}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
