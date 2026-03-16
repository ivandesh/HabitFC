import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { fetchUnwatchedMatches } from '../lib/battleApi'
import { getWatchedSet } from '../lib/watchedMatches'

export function useUnwatchedCount() {
  const user = useAuthStore(s => s.user)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchUnwatchedMatches(user.id).then(matches => {
      const watched = getWatchedSet()
      setCount(matches.filter(m => !watched.has(m.id)).length)
    }).catch(() => {})
  }, [user])

  return count
}
