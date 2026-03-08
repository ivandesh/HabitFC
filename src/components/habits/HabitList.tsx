import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { HabitCard } from './HabitCard'
import { AddHabitModal } from './AddHabitModal'
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Твої Звички</h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors cursor-pointer"
        >
          + Додати
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4">📋</div>
          <div className="text-lg">Ще немає звичок</div>
          <div className="text-sm mt-1">Додай звичку, щоб заробляти монети!</div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={habits.map(h => h.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {habits.map(h => <HabitCard key={h.id} habit={h} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showModal && <AddHabitModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
