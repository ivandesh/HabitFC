import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { CoinIcon } from '../ui/CoinIcon'
import { EmojiPicker } from '../ui/EmojiPicker'
import type { Habit } from '../../types'

interface Props {
  habit?: Habit   // present = edit mode, absent = add mode
  onClose: () => void
}

export function HabitFormModal({ habit, onClose }: Props) {
  const addHabit = useAppStore(state => state.addHabit)
  const updateHabit = useAppStore(state => state.updateHabit)
  const [name, setName] = useState(habit?.name ?? '')
  const [icon, setIcon] = useState(habit?.icon ?? '🧘')
  const [coinValue, setCoinValue] = useState(habit?.coinValue ?? 50)

  const isEdit = !!habit

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (isEdit) {
      updateHabit(habit.id, { name: name.trim(), icon, coinValue })
    } else {
      addHabit({ name: name.trim(), icon, coinValue })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">{isEdit ? 'Редагувати звичку' : 'Нова звичка'}</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Іконка</label>
            <EmojiPicker value={icon} onChange={setIcon} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Назва звички</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="напр. Ранкова йога"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Монет за виконання</label>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCoinValue(v)}
                  className={`px-3 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center gap-1 ${coinValue === v ? 'bg-yellow-500 text-black scale-105' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  <CoinIcon size={14} /> {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-medium transition-colors">
              Скасувати
            </button>
            <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold transition-colors">
              {isEdit ? 'Зберегти' : 'Додати'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
