import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { fetchUnwatchedMatches } from '../lib/battleApi'

const WATCHED_KEY = 'habitfc_watched_matches'

function getWatchedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

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
