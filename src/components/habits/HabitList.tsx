import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { HabitCard } from './HabitCard'
import { AddHabitModal } from './AddHabitModal'
import { EditHabitModal } from './EditHabitModal'
import type { Habit } from '../../types'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'

export function HabitList() {
  const habits = useAppStore(state => state.habits)
  const reorderHabits = useAppStore(state => state.reorderHabits)
  const [showModal, setShowModal] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = habits.findIndex(h => h.id === active.id)
    const newIndex = habits.findIndex(h => h.id === over.id)
    const reordered = arrayMove(habits, oldIndex, newIndex)
    reorderHabits(reordered.map(h => h.id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-oswald text-xs tracking-[0.2em] text-[#5A7090] uppercase mb-0.5">
            · Твої ·
          </div>
          <h2 className="font-oswald text-2xl font-bold uppercase tracking-wide text-white leading-none">
            Звички
          </h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="font-oswald px-5 py-2.5 bg-[#00E676] hover:bg-[#00FF87] text-[#04060A] font-bold uppercase tracking-widest text-sm rounded-xl transition-all cursor-pointer glow-green-btn"
        >
          + Додати
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[#1A2336] rounded-2xl">
          <div className="text-5xl mb-4 opacity-40">📋</div>
          <div className="font-oswald text-lg uppercase tracking-wide text-[#5A7090]">
            Ще немає звичок
          </div>
          <div className="text-sm mt-2 text-[#3A4A5A]">Додай звичку, щоб заробляти монети!</div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={habits.map(h => h.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {habits.map(h => <HabitCard key={h.id} habit={h} onEdit={setEditingHabit} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showModal && <AddHabitModal onClose={() => setShowModal(false)} />}
      {editingHabit && <EditHabitModal habit={editingHabit} onClose={() => setEditingHabit(null)} />}
    </div>
  )
}
