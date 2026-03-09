import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { ACHIEVEMENTS } from '../../lib/achievements'
import { playAchievementUnlock } from '../../lib/sounds'

export function AchievementToastManager() {
  const drainPendingUnlock = useAppStore(state => state.drainPendingUnlock)
  const [current, setCurrent] = useState<{ id: string; titleUA: string; icon: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRef = useRef<{ id: string; titleUA: string; icon: string } | null>(null)

  useEffect(() => {
    currentRef.current = current
  })

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentRef.current) return
      const id = drainPendingUnlock()
      if (!id) return
      const def = ACHIEVEMENTS.find(a => a.id === id)
      if (!def) return
      const toast = { id, titleUA: def.titleUA, icon: def.icon }
      setCurrent(toast)
      playAchievementUnlock()
      timerRef.current = setTimeout(() => setCurrent(null), 4000)
    }, 300)
    return () => {
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [drainPendingUnlock])

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-14 sm:top-4 right-3 sm:right-4 left-3 sm:left-auto z-50 flex items-center gap-3 bg-[#0D1520] border border-[#00E676]/40 rounded-2xl px-4 py-3 shadow-2xl sm:max-w-xs"
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
