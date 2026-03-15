import { useState, useRef, useEffect } from 'react'

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Спорт',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '🤸', '🏋️', '🤺', '🏊', '🚴', '🏃', '💪', '🧘', '🤾', '⛷️', '🏂', '🏌️', '🤼', '🥅', '🏇', '⛸️', '🤿', '🛹'],
  },
  {
    name: 'Активності',
    emojis: ['📚', '✍️', '🎨', '🎵', '🎸', '🎹', '🎤', '🎬', '📷', '🎮', '🧩', '♟️', '🎯', '🎲', '🎭', '🪴', '🧶', '🪡', '🎻', '🥁', '📝', '📖', '🔬', '🔭', '💻', '⌨️', '🖊️', '🖌️', '✏️', '📐'],
  },
  {
    name: 'Їжа',
    emojis: ['🥗', '🍎', '🥑', '🥦', '🍳', '🥤', '💧', '🍵', '☕', '🧃', '🥛', '🫖', '🍊', '🍋', '🥕', '🌽', '🍇', '🫐', '🍌', '🥝', '🍒', '🥜', '🍯', '🧄', '🫑', '🥒', '🍆', '🥬', '🫘', '🌰'],
  },
  {
    name: 'Здоров\'я',
    emojis: ['❤️', '🧠', '😴', '🛏️', '🧘', '💊', '🩺', '🏥', '🧴', '🪥', '🧹', '🫁', '🦷', '👁️', '💆', '🧖', '🛀', '🌡️', '💉', '🩹', '😌', '🥰', '😊', '🧘‍♀️', '🧘‍♂️', '🫀', '🦴', '🙏', '🌸', '✨'],
  },
  {
    name: 'Природа',
    emojis: ['🌿', '🌳', '🌻', '🌺', '🍀', '🌈', '☀️', '🌙', '⭐', '🔥', '🌊', '❄️', '🦋', '🐝', '🌹', '🌷', '🍁', '🌾', '🪻', '🌵', '🪨', '🏔️', '🌅', '🌄', '🏖️', '🌤️', '⛅', '🌬️', '💨', '🫧'],
  },
  {
    name: 'Об\'єкти',
    emojis: ['🎒', '💼', '📱', '⏰', '🔔', '🗓️', '📋', '🗂️', '📊', '💡', '🔑', '🏠', '🚗', '✈️', '🚀', '🎁', '🏆', '🥇', '🎖️', '👑', '💎', '🛡️', '⚡', '🔧', '🧲', '🧪', '📦', '🗃️', '🎀', '🧸'],
  },
  {
    name: 'Символи',
    emojis: ['✅', '❌', '💯', '🔴', '🟢', '🔵', '🟡', '🟣', '⬛', '⬜', '🔶', '🔷', '▶️', '⏸️', '⏹️', '♻️', '💚', '💙', '💜', '🖤', '🤍', '💛', '🧡', '❤️‍🔥', '💝', '💗', '🫶', '👍', '🤙', '✌️'],
  },
]

const PRESET_ICONS = ['🧘', '🎸', '📚', '🏃', '💪', '🧠', '✍️', '🥗', '💧', '🎨', '🎯', '🌿', '🏊', '🚴', '🎵', '📖', '🛏️', '🧹']

interface Props {
  value: string
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRESET_ICONS.map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`text-2xl p-2 rounded-lg transition-all ${value === i ? 'bg-blue-600 scale-110' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            {i}
          </button>
        ))}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`text-2xl p-2 rounded-lg transition-all ${
              isOpen || (!PRESET_ICONS.includes(value))
                ? 'bg-blue-600 scale-110'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            title="Обрати емодзі"
          >
            {!PRESET_ICONS.includes(value) ? value : '➕'}
          </button>

          {isOpen && (
            <div className="absolute bottom-full mb-2 right-0 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl z-50 w-72">
              <div className="flex gap-1 p-2 border-b border-gray-700 overflow-x-auto scrollbar-hide">
                {EMOJI_CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setActiveCategory(idx)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeCategory === idx
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="p-2 h-48 overflow-y-auto">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_CATEGORIES[activeCategory].emojis.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onChange(emoji)
                        setIsOpen(false)
                      }}
                      className={`text-xl p-1.5 rounded-lg transition-all hover:bg-gray-700 ${
                        value === emoji ? 'bg-blue-600' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
