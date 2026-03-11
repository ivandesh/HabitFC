import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { saveUsername, saveAvatarUrl, saveAvatarEmoji, uploadAvatar } from '../../lib/profileSync'
import { supabase } from '../../lib/supabase'

const PRESET_EMOJIS = ['⚽', '🏆', '🥅', '🧤', '👟', '⭐', '🌟', '🔥', '💪', '🦁', '🐺', '🦅', '🎯', '🏅', '🎽']

interface Props {
  onClose: () => void
}

/** Renders avatar image, emoji, or default icon based on priority */
function Avatar({ url, emoji, size = 'lg' }: { url: string | null; emoji: string | null; size?: 'lg' | 'sm' }) {
  const dim = size === 'lg' ? 'w-16 h-16 text-3xl' : 'w-8 h-8 text-lg'
  if (url) {
    return <img src={url} alt="avatar" className={`${dim} rounded-full object-cover bg-[#0A0F1A]`} />
  }
  return (
    <div className={`${dim} rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center`}>
      {emoji ?? '👤'}
    </div>
  )
}

export function ProfileModal({ onClose }: Props) {
  const user = useAuthStore(state => state.user)
  const { signOut } = useAuthStore()

  // Profile state — loaded from DB on mount
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // UI state
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load current profile on mount
  useEffect(() => {
    if (!user) return
    supabase
      .from('user_state')
      .select('username, avatar_url, avatar_emoji')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username ?? '')
          setUsernameInput(data.username ?? '')
          setAvatarUrl(data.avatar_url ?? null)
          setAvatarEmoji(data.avatar_emoji ?? null)
        }
        setLoaded(true)
      })
  }, [user])

  async function handleSaveUsername() {
    if (!user || !usernameInput.trim()) return
    setUsernameLoading(true)
    setUsernameError(null)
    try {
      await saveUsername(user.id, usernameInput.trim())
      setUsername(usernameInput.trim())
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e?.code === '23505') {
        setUsernameError('Це ім\'я вже зайняте')
      } else {
        setUsernameError('Помилка збереження')
      }
    } finally {
      setUsernameLoading(false)
    }
  }

  async function handleSelectEmoji(emoji: string) {
    if (!user) return
    setAvatarLoading(true)
    try {
      await saveAvatarEmoji(user.id, emoji)
      setAvatarEmoji(emoji)
      setAvatarUrl(null)
    } finally {
      setAvatarLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarLoading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      await saveAvatarUrl(user.id, url)
      setAvatarUrl(url)
      setAvatarEmoji(null)
    } finally {
      setAvatarLoading(false)
    }
  }

  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="text-[#5A7090] font-oswald tracking-widest">ЗАВАНТАЖЕННЯ...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#04060A] border border-[#1A2336] rounded-2xl p-6 w-full max-w-sm space-y-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-oswald text-xl font-bold uppercase tracking-wider text-white">Профіль</h2>
          <button onClick={onClose} className="text-[#5A7090] hover:text-white transition-colors text-xl cursor-pointer">✕</button>
        </div>

        {/* Current avatar display */}
        <div className="flex justify-center">
          <Avatar url={avatarUrl} emoji={avatarEmoji} size="lg" />
        </div>

        {/* Username */}
        <div>
          <label className="block font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-2">Ім'я гравця</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={e => { setUsernameInput(e.target.value); setUsernameError(null) }}
              placeholder="Введіть ім'я"
              maxLength={24}
              className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-3 py-2 text-sm text-white placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
            />
            <button
              onClick={handleSaveUsername}
              disabled={usernameLoading || !usernameInput.trim() || usernameInput.trim() === username}
              className="px-4 py-2 bg-[#00E676] text-[#04060A] font-oswald font-bold text-sm rounded-xl disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-opacity"
            >
              {usernameLoading ? '...' : 'Зберегти'}
            </button>
          </div>
          {usernameError && (
            <p className="text-red-400 text-xs mt-1">{usernameError}</p>
          )}
        </div>

        {/* Avatar section */}
        <div>
          <label className="block font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-2">Аватар</label>

          {/* Preset emoji grid */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {PRESET_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleSelectEmoji(emoji)}
                disabled={avatarLoading}
                className={`text-xl p-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                  avatarEmoji === emoji && !avatarUrl
                    ? 'bg-[#00E676]/20 border border-[#00E676]'
                    : 'bg-[#0A0F1A] border border-[#1A2336] hover:border-[#00E676]/50'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Upload button */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarLoading}
            className="w-full py-2 border border-dashed border-[#1A2336] rounded-xl font-oswald text-xs text-[#5A7090] hover:border-[#00E676]/50 hover:text-[#00E676] transition-colors cursor-pointer disabled:opacity-50"
          >
            {avatarLoading ? 'Завантаження...' : '📷 Завантажити фото'}
          </button>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut()}
          className="w-full py-2.5 border border-red-500/30 rounded-xl font-oswald text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          Вийти з акаунту
        </button>
      </div>
    </div>
  )
}
