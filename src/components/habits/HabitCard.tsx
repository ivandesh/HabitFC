import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import type { Habit } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { StreakBadge } from '../ui/StreakBadge'
import { CoinIcon } from '../ui/CoinIcon'
import { isCompletedToday, isStreakActive, calculateNewStreak, streakMultiplier } from '../../lib/streaks'
import { computeActiveBonuses, totalBonusPercent } from '../../lib/bonuses'
import { computeCoachHabitBonus, computeCoachChemistryPct, getAssignedCoach } from '../../lib/coachPerks'
import { footballers } from '../../data/footballers'
import { playHabitComplete } from '../../lib/sounds'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  habit: Habit
  onEdit: (habit: Habit) => void
}

interface EarnBreakdown {
  base: number
  afterStreak: number
  streakMult: number
  chemistryPct: number
  chemistryBonus: number
  coachBonus: number
  total: number
}

export function HabitCard({ habit, onEdit }: Props) {
  const completeHabit = useAppStore(state => state.completeHabit)
  const removeHabit = useAppStore(state => state.removeHabit)
  // Select only the slices needed — primitives/arrays so Object.is stays stable
  const { squad, assignedCoach, coachCollection, habits: allHabits } = useAppStore(
    useShallow(state => ({
      squad: state.squad,
      assignedCoach: state.assignedCoach,
      coachCollection: state.coachCollection,
      habits: state.habits,
    }))
  )
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const infoButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!tooltipOpen) return
    function handleClickOutside() { setTooltipOpen(false) }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [tooltipOpen])
  const done = isCompletedToday(habit.lastCompleted)
  const activeStreak = isStreakActive(habit.lastCompleted) ? habit.streak : 0
  const multiplier = streakMultiplier(activeStreak)

  // Full projected reward breakdown — mirrors completeHabit logic in the store
  const partialState = { squad, assignedCoach, coachCollection, habits: allHabits }
  const newStreak = calculateNewStreak(habit.streak, habit.lastCompleted)
  const streakMult = streakMultiplier(newStreak)
  const afterStreak = Math.round(habit.coinValue * streakMult)
  const squadChemPct = totalBonusPercent(computeActiveBonuses(partialState as Parameters<typeof computeActiveBonuses>[0]))
  const coach = getAssignedCoach(partialState as Parameters<typeof getAssignedCoach>[0])
  const squadPlayers = (squad ?? [])
    .filter((id): id is string => id !== null)
    .map(id => footballers.find(f => f.id === id))
    .filter((f): f is typeof footballers[0] => f !== undefined)
  const coachChemPct = coach ? computeCoachChemistryPct(coach, squadPlayers) : 0
  const chemistryPct = squadChemPct + coachChemPct
  const withChemistry = Math.round(afterStreak * (1 + chemistryPct / 100))
  const chemistryBonus = withChemistry - afterStreak
  const coachBonus = computeCoachHabitBonus(partialState as Parameters<typeof computeCoachHabitBonus>[0], habit.id, withChemistry, newStreak)
  const breakdown: EarnBreakdown = {
    base: habit.coinValue,
    afterStreak,
    streakMult,
    chemistryPct,
    chemistryBonus,
    coachBonus,
    total: withChemistry + coachBonus,
  }
  const earned = breakdown.total
  const hasBonus = breakdown.chemistryPct > 0 || breakdown.coachBonus > 0

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col rounded-2xl border transition-all overflow-hidden ${
        done
          ? 'border-[#00E676]/25 bg-[#00E676]/5'
          : 'border-[#1A2336] bg-[#0A0F1A] hover:border-[#2A3A50]'
      }`}
    >
      {/* Top bar: drag handle + edit + delete */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div
          {...attributes}
          {...listeners}
          className="text-[#2A3A50] hover:text-[#5A7090] cursor-grab active:cursor-grabbing touch-none select-none px-1 py-0.5 rounded text-lg transition-colors"
          title="Перетягнути"
        >
          ⠿
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(habit)}
            className="p-1 text-[#2A3A50] hover:text-blue-400 transition-colors cursor-pointer"
            title="Редагувати звичку"
          >
            ✏️
          </button>
          <button
            onClick={() => removeHabit(habit.id)}
            className="p-1 text-[#2A3A50] hover:text-red-400 transition-colors cursor-pointer"
            title="Видалити звичку"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Icon + title */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-1">
        <div className="text-4xl shrink-0">{habit.icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-base leading-snug break-words text-[#E8F0FF]">
            {habit.name}
          </div>
          <div className="mt-1.5">
            {activeStreak > 0
              ? <StreakBadge streak={activeStreak} />
              : <span className="text-xs text-[#3A4A5A]">Немає серії</span>
            }
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-[#1A2336] border-t border-[#1A2336] text-center text-xs bg-[#060A10]">
        <div className="px-2 py-2.5">
          <div className="text-[#3A4A5A] mb-1 font-oswald tracking-wider uppercase text-[10px]">Вартість</div>
          <div className="font-bold text-yellow-400 flex items-center justify-center gap-1">
            <CoinIcon size={12} /> {habit.coinValue}
          </div>
        </div>
        <div className="px-2 py-2.5">
          <div className="text-[#3A4A5A] mb-1 font-oswald tracking-wider uppercase text-[10px]">Бонус</div>
          <div className={`font-bold ${multiplier > 1 ? 'text-orange-400' : 'text-[#3A4A5A]'}`}>
            ×{multiplier}
          </div>
        </div>
        <div className="px-2 py-2.5">
          <div className="text-[#3A4A5A] mb-1 font-oswald tracking-wider uppercase text-[10px]">Заробіток</div>
          <div className="font-bold text-[#00E676] flex items-center justify-center gap-1">
            +{earned}
            {hasBonus && (
              <button
                ref={infoButtonRef}
                onClick={e => {
                  e.stopPropagation()
                  if (!tooltipOpen && infoButtonRef.current) {
                    const rect = infoButtonRef.current.getBoundingClientRect()
                    setTooltipPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX })
                  }
                  setTooltipOpen(v => !v)
                }}
                className="text-[#5A7090] hover:text-[#00E676] transition-colors leading-none cursor-pointer"
                aria-label="Деталі нарахування"
              >
                ⓘ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown tooltip — rendered in portal to escape overflow-hidden */}
      {tooltipOpen && hasBonus && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: tooltipPos.top - 8,
            left: tooltipPos.left,
            transform: 'translate(-75%, -100%)',
            zIndex: 9999,
          }}
          className="bg-[#0D1520] border border-[#1A2336] rounded-xl p-3 text-left shadow-xl w-48"
        >
          <div className="font-oswald text-[10px] tracking-widest text-[#5A7090] uppercase mb-2">Розрахунок</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-[#8A9AB0]">
              <span>База</span>
              <span className="text-yellow-400">{breakdown.base}</span>
            </div>
            {breakdown.streakMult > 1 && (
              <div className="flex justify-between text-[#8A9AB0]">
                <span>Серія ×{breakdown.streakMult}</span>
                <span className="text-orange-400">→ {breakdown.afterStreak}</span>
              </div>
            )}
            {breakdown.chemistryPct > 0 && (
              <div className="flex justify-between text-[#8A9AB0]">
                <span>Хімія +{breakdown.chemistryPct}%</span>
                <span className="text-blue-400">+{breakdown.chemistryBonus}</span>
              </div>
            )}
            {breakdown.coachBonus > 0 && (
              <div className="flex justify-between text-[#8A9AB0]">
                <span>Тренер</span>
                <span className="text-purple-400">+{breakdown.coachBonus}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#1A2336] pt-1 mt-1 font-bold">
              <span className="text-white">Разом</span>
              <span className="text-[#00E676]">+{earned}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Action */}
      <div className="px-4 py-3">
        {done ? (
          <div className="w-full py-2.5 text-center font-oswald font-semibold text-sm uppercase tracking-widest text-[#00E676] bg-[#00E676]/10 rounded-xl border border-[#00E676]/20">
            ✓ Виконано сьогодні
          </div>
        ) : (
          <button
            onClick={() => { completeHabit(habit.id); playHabitComplete() }}
            className="w-full py-2.5 bg-[#00E676] hover:bg-[#00FF87] text-[#04060A] font-oswald font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer text-sm glow-green-btn"
          >
            Готово ✓
          </button>
        )}
      </div>
    </div>
  )
}
