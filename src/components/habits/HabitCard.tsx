import type { Habit } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { StreakBadge } from '../ui/StreakBadge'
import { CoinIcon } from '../ui/CoinIcon'
import { isCompletedToday, streakMultiplier } from '../../lib/streaks'
import { playHabitComplete } from '../../lib/sounds'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  habit: Habit
  onEdit: (habit: Habit) => void
}

export function HabitCard({ habit, onEdit }: Props) {
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
            {habit.streak > 0
              ? <StreakBadge streak={habit.streak} />
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
          <div className="font-bold text-[#00E676]">+{earned}</div>
        </div>
      </div>

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
