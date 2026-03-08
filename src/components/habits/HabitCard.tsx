import type { Habit } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { StreakBadge } from '../ui/StreakBadge'
import { isCompletedToday, streakMultiplier } from '../../lib/streaks'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  habit: Habit
}

export function HabitCard({ habit }: Props) {
  const completeHabit = useAppStore(state => state.completeHabit)
  const removeHabit = useAppStore(state => state.removeHabit)
  const done = isCompletedToday(habit.lastCompleted)
  const multiplier = streakMultiplier(habit.streak)
  const earned = Math.round(habit.coinValue * multiplier)

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
      className={`flex flex-col rounded-2xl border transition-all ${done ? 'border-green-500/30 bg-green-950/20' : 'border-gray-700 bg-gray-900'}`}
    >
      {/* Top bar: drag handle + delete */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div
          {...attributes}
          {...listeners}
          className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none select-none px-1 py-0.5 rounded text-lg"
          title="Перетягнути"
        >
          ⠿
        </div>
        <button
          onClick={() => removeHabit(habit.id)}
          className="p-1 text-gray-700 hover:text-red-400 transition-colors cursor-pointer"
          title="Видалити звичку"
        >
          🗑️
        </button>
      </div>

      {/* Icon + title */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="text-4xl shrink-0">{habit.icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-base leading-snug break-words">{habit.name}</div>
          <div className="mt-1">
            {habit.streak > 0
              ? <StreakBadge streak={habit.streak} />
              : <span className="text-xs text-gray-600">Немає серії</span>
            }
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-gray-800 border-t border-gray-800 text-center text-xs">
        <div className="px-2 py-2">
          <div className="text-gray-500 mb-0.5">Вартість</div>
          <div className="font-bold text-yellow-400">🪙 {habit.coinValue}</div>
        </div>
        <div className="px-2 py-2">
          <div className="text-gray-500 mb-0.5">Бонус</div>
          <div className={`font-bold ${multiplier > 1 ? 'text-orange-400' : 'text-gray-500'}`}>×{multiplier}</div>
        </div>
        <div className="px-2 py-2">
          <div className="text-gray-500 mb-0.5">Заробіток</div>
          <div className="font-bold text-green-400">+{earned}</div>
        </div>
      </div>

      {/* Action */}
      <div className="px-4 py-3">
        {done ? (
          <div className="w-full py-2 text-center text-green-400 font-semibold text-sm bg-green-950/30 rounded-xl">
            ✓ Виконано сьогодні
          </div>
        ) : (
          <button
            onClick={() => completeHabit(habit.id)}
            className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm"
          >
            Готово ✓
          </button>
        )}
      </div>
    </div>
  )
}
