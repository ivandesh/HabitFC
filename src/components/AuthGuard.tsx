import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore, syncSubscribe } from '../store/useAppStore'
import { loadState } from '../lib/stateSync'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, setUser, setLoading } = useAuthStore()
  const importState = useAppStore(s => s.importState)
  const navigate = useNavigate()
  const unsubscribeSyncRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setLoading(false)

      if (u) {
        loadState(u.id).then(state => {
          if (state) importState(state)
          unsubscribeSyncRef.current?.()
          unsubscribeSyncRef.current = syncSubscribe(u.id)
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)

      if (event === 'SIGNED_OUT') {
        unsubscribeSyncRef.current?.()
        unsubscribeSyncRef.current = null
        navigate('/login')
      } else if (u && !unsubscribeSyncRef.current) {
        loadState(u.id).then(state => {
          if (state) importState(state)
          unsubscribeSyncRef.current = syncSubscribe(u.id)
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [loading, user])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center">
        <span className="font-oswald text-2xl text-[#00E676] tracking-widest animate-pulse">HABITFC</span>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
