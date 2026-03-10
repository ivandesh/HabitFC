import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { saveState } from '../lib/stateSync'

const LOCAL_STORAGE_KEY = 'habit-tracker-store'

function readLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Zustand persist wraps state in { state: {...}, version: N }
    return parsed?.state ?? null
  } catch {
    return null
  }
}

export function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMigration, setShowMigration] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const { signIn, signUp } = useAuthStore()
  const importState = useAppStore(s => s.importState)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) { setError(err); return }
    navigate('/')
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Паролі не збігаються'); return }
    setLoading(true)
    const err = await signUp(email, password)
    setLoading(false)
    if (err) { setError(err); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }

    const localState = readLocalState()
    if (localState) {
      setPendingUserId(user.id)
      setShowMigration(true)
    } else {
      navigate('/')
    }
  }

  async function handleMigrate(yes: boolean) {
    if (yes && pendingUserId) {
      const localState = readLocalState()
      if (localState) {
        importState(localState)
        await saveState(pendingUserId, useAppStore.getState())
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    setShowMigration(false)
    navigate('/')
  }

  if (showMigration) {
    return (
      <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center p-4">
        <div className="bg-[#0D1526] border border-[#1A2336] rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">💾</div>
          <h2 className="font-oswald text-xl text-[#E8F0FF] mb-3">Знайдено дані на пристрої</h2>
          <p className="text-[#5A7090] text-sm mb-6">Перенести існуючий прогрес (звички, монети, картки) в акаунт?</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleMigrate(false)}
              className="flex-1 py-3 rounded-xl border border-[#1A2336] text-[#5A7090] font-oswald tracking-wider hover:border-[#5A7090] transition-colors cursor-pointer"
            >
              Ні
            </button>
            <button
              onClick={() => handleMigrate(true)}
              className="flex-1 py-3 rounded-xl bg-[#00E676] text-[#0A0F1A] font-oswald tracking-wider font-bold hover:bg-[#00FF84] transition-colors cursor-pointer"
            >
              Перенести
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center p-4">
      <div className="bg-[#0D1526] border border-[#1A2336] rounded-2xl p-8 max-w-sm w-full">
        <div className="text-center mb-8">
          <span className="font-oswald text-3xl font-bold tracking-wider">
            <span className="text-[#00E676]">⚽</span>{' '}
            <span className="text-white">HABIT<span className="text-[#00E676]">FC</span></span>
          </span>
        </div>

        <div className="flex mb-6 bg-[#0A0F1A] rounded-xl p-1">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2 rounded-lg font-oswald text-sm tracking-wider uppercase transition-colors cursor-pointer ${
                tab === t ? 'bg-[#1A2336] text-[#E8F0FF]' : 'text-[#5A7090] hover:text-[#E8F0FF]'
              }`}
            >
              {t === 'login' ? 'Увійти' : 'Реєстрація'}
            </button>
          ))}
        </div>

        <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl text-[#E8F0FF] placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl text-[#E8F0FF] placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
          />
          {tab === 'register' && (
            <input
              type="password"
              placeholder="Підтвердіть пароль"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl text-[#E8F0FF] placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
            />
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#00E676] text-[#0A0F1A] font-oswald font-bold tracking-wider rounded-xl hover:bg-[#00FF84] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? '...' : tab === 'login' ? 'Увійти' : 'Зареєструватись'}
          </button>
        </form>
      </div>
    </div>
  )
}
